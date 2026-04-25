/**
 * Steam Profile Analytics — Cloudflare Worker backend
 * =====================================================
 * Routes:
 *   Auth:      GET  /api/auth/login
 *              GET  /api/auth/callback
 *              POST /api/auth/resolve
 *   Games:     GET  /api/games/:steamid
 *   Analytics: GET  /api/analytics/genres
 *              GET  /api/analytics/review-distribution
 *              GET  /api/analytics/price-vs-reviews
 *              GET  /api/analytics/publisher-tiers
 *              GET  /api/analytics/top-owned
 *
 * Bindings required (wrangler.jsonc):
 *   env.DB            — D1 database
 *   env.STEAM_API_KEY — Worker secret  (wrangler secret put STEAM_API_KEY)
 *   env.FRONTEND_URL  — Worker var     (default: http://localhost:5173)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// ─── CORS ───────────────────────────────────────────────────────────────────
app.use('/api/*', cors({
  origin: (origin) => origin,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  credentials: true,
}));

// ─── Utility ─────────────────────────────────────────────────────────────────
const jsonErr = (msg, status = 500) => Response.json({ error: msg }, { status });

// ─── Steam helpers ────────────────────────────────────────────────────────────

function openIdParams(returnTo, realm) {
  return new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  }).toString();
}

async function resolveSteamId(input, apiKey) {
  input = input.trim();

  // 1. Raw 17-digit ID
  if (/^\d{17}$/.test(input)) return input;

  // 2. /profiles/<id64> URL
  const profileMatch = input.match(/\/profiles\/(\d{17})/);
  if (profileMatch) return profileMatch[1];

  // 3. Vanity URL (/id/<name> or bare word)
  let vanity = input;
  const idMatch = input.match(/\/id\/([^/]+)/);
  if (idMatch) vanity = idMatch[1];
  vanity = vanity.replace(/\/$/, '');

  const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${apiKey}&vanityurl=${encodeURIComponent(vanity)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.response?.success === 1 ? data.response.steamid : null;
}

async function fetchProfile(steamId, apiKey) {
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`;
  const res = await fetch(url);
  if (!res.ok) return { steamid: steamId };
  const data = await res.json();
  const p = data?.response?.players?.[0];
  if (!p) return { steamid: steamId };
  return {
    steamid: steamId,
    persona_name: p.personaname,
    profile_url: p.profileurl,
    avatar_url: p.avatarfull,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/auth/steam', (c) => {
  const origin = new URL(c.req.url).origin;
  const params = openIdParams(`${origin}/api/auth/callback`, origin);
  return Response.redirect(`https://steamcommunity.com/openid/login?${params}`, 302);
});

// Alias — keeps parity with the Python Flask backend at localhost:5000
app.get('/api/auth/login', (c) => {
  const origin = new URL(c.req.url).origin;
  const params = openIdParams(`${origin}/api/auth/callback`, origin);
  return Response.redirect(`https://steamcommunity.com/openid/login?${params}`, 302);
});


app.get('/api/auth/callback', async (c) => {
  const env = c.env;
  const frontendUrl = env.FRONTEND_URL || new URL(c.req.url).origin;
  const params = new URL(c.req.url).searchParams;

  // Verify with Steam
  const verifyParams = new URLSearchParams(params);
  verifyParams.set('openid.mode', 'check_authentication');
  const verifyRes = await fetch('https://steamcommunity.com/openid/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: verifyParams.toString(),
  });

  if (!(await verifyRes.text()).includes('is_valid:true')) {
    return Response.redirect(`${frontendUrl}?error=authentication_failed`, 302);
  }

  const claimedId = params.get('openid.claimed_id') || '';
  const match = claimedId.match(/https:\/\/steamcommunity\.com\/openid\/id\/(\d+)/);
  if (!match) return Response.redirect(`${frontendUrl}?error=authentication_failed`, 302);

  const steamId = match[1];
  const profile = env.STEAM_API_KEY
    ? await fetchProfile(steamId, env.STEAM_API_KEY)
    : { steamid: steamId };

  const maxAge = 86400 * 30;
  const opts = `Max-Age=${maxAge}; Path=/; SameSite=Lax`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: frontendUrl,
      'Set-Cookie': [
        `steamid=${steamId}; ${opts}`,
        `user_profile=${encodeURIComponent(JSON.stringify(profile))}; ${opts}`,
      ].join(', '),
    },
  });
});

app.post('/api/auth/resolve', async (c) => {
  const env = c.env;
  let body;
  try { body = await c.req.json(); }
  catch { return jsonErr('Invalid JSON body', 400); }

  const input = (body?.input || '').trim();
  if (!input) return jsonErr('Input is required', 400);
  if (!env.STEAM_API_KEY) return jsonErr('STEAM_API_KEY not configured', 500);

  const steamId = await resolveSteamId(input, env.STEAM_API_KEY);
  if (!steamId) return jsonErr('Could not resolve that Steam profile. Make sure it is correct and public.', 404);

  const profile = await fetchProfile(steamId, env.STEAM_API_KEY);
  return Response.json({ steamid: steamId, ...profile });
});

// ═══════════════════════════════════════════════════════════════════════════
//  GAMES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/games/:steamid', async (c) => {
  const env = c.env;
  if (!env.STEAM_API_KEY) return jsonErr('Steam API key not configured', 500);

  const { steamid } = c.req.param();
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${env.STEAM_API_KEY}&steamid=${steamid}&format=json&include_appinfo=1`;
  const res = await fetch(url);
  if (!res.ok) return jsonErr('Failed to fetch games from Steam', 500);
  return Response.json(await res.json());
});

// ═══════════════════════════════════════════════════════════════════════════
//  ANALYTICS  — all read from D1 (SQLite)
//
//  D1 API:  env.DB.prepare(sql).all()               → { results: [...] }
//           env.DB.prepare(sql).bind(...).all()      → parameterized
//
//  SQLite vs Postgres notes:
//    • CAST(x AS INTEGER) not BIGINT
//    • CAST(x AS REAL)    not NUMERIC
//    • Parameters use ?  not $1
//    • RANDOM() works the same
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/analytics/genres', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT genre_primary AS genre, COUNT(*) AS count
      FROM   game_analytics
      WHERE  genre_primary IS NOT NULL AND genre_primary <> ''
      GROUP  BY genre_primary
      ORDER  BY count DESC
      LIMIT  20;
    `).all();
    return Response.json(results);
  } catch (e) {
    console.error('analytics/genres:', e);
    return jsonErr(e.message);
  }
});

app.get('/api/analytics/review-distribution', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        CAST(FLOOR(CAST(NULLIF(overall_review__, '') AS REAL) / 5) * 5 AS INTEGER) AS bucket,
        COUNT(*) AS count
      FROM   steam_games
      WHERE  overall_review__ IS NOT NULL AND overall_review__ <> ''
      GROUP  BY bucket
      ORDER  BY bucket;
    `).all();
    return Response.json(results);
  } catch (e) {
    console.error('analytics/review-distribution:', e);
    return jsonErr(e.message);
  }
});

app.get('/api/analytics/price-distribution', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        CASE
          WHEN CAST(NULLIF(price_final,'') AS REAL) =   0 THEN 'Free'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <   1 THEN 'Under $1'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <   2 THEN '$1'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <   3 THEN '$2'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <   4 THEN '$3'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <   5 THEN '$4'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <   6 THEN '$5'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <   7 THEN '$6'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <   8 THEN '$7'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <   9 THEN '$8'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  10 THEN '$9'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  11 THEN '$10'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  12 THEN '$11'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  13 THEN '$12'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  14 THEN '$13'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  15 THEN '$14'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  16 THEN '$15'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  17 THEN '$16'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  18 THEN '$17'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  19 THEN '$18'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  20 THEN '$19'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  30 THEN '$20-$29'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  40 THEN '$30-$39'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  50 THEN '$40-$49'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  60 THEN '$50-$59'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  70 THEN '$60-$69'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  80 THEN '$70-$79'
          WHEN CAST(NULLIF(price_final,'') AS REAL) <  90 THEN '$80-$89'
          WHEN CAST(NULLIF(price_final,'') AS REAL) < 100 THEN '$90-$99'
          ELSE '$100+'
        END AS bucket,
        COUNT(*) AS count
      FROM  game_analytics
      WHERE price_final IS NOT NULL AND price_final <> ''
      GROUP BY bucket
      ORDER BY MIN(CAST(NULLIF(price_final,'') AS REAL));
    `).all();
    return Response.json(results);
  } catch (e) {
    console.error('analytics/price-distribution:', e);
    return jsonErr(e.message);
  }
});



app.get('/api/analytics/publisher-tiers', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        publisher_tier AS tier,
        COUNT(*)       AS game_count,
        ROUND(AVG(
          CASE
            WHEN (CAST(NULLIF(positive_reviews,'') AS REAL)
                + CAST(NULLIF(negative_reviews,'') AS REAL)) > 0
            THEN CAST(NULLIF(positive_reviews,'') AS REAL)
               / (CAST(NULLIF(positive_reviews,'') AS REAL)
                + CAST(NULLIF(negative_reviews,'') AS REAL)) * 100
          END
        ), 1) AS avg_positive_pct,
        ROUND(AVG(CAST(NULLIF(owners_midpoint,'') AS REAL))) AS avg_owners
      FROM  game_analytics
      WHERE publisher_tier IS NOT NULL AND publisher_tier <> ''
      GROUP BY publisher_tier
      ORDER BY
        CASE publisher_tier
          WHEN 'Indie' THEN 1
          WHEN 'AA'    THEN 2
          WHEN 'AAA'   THEN 3
          ELSE 4
        END;
    `).all();
    return Response.json(results);
  } catch (e) {
    console.error('analytics/publisher-tiers:', e);
    return jsonErr(e.message);
  }
});

app.get('/api/analytics/top-owned', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 50);
    const { results } = await c.env.DB.prepare(`
      SELECT
        appid,
        name,
        CAST(NULLIF(owners_midpoint,'') AS INTEGER) AS owners_midpoint,
        genre_primary,
        CAST(NULLIF(positive_reviews,'') AS INTEGER) AS positive_reviews,
        CAST(NULLIF(negative_reviews,'') AS INTEGER) AS negative_reviews
      FROM  game_analytics
      WHERE owners_midpoint IS NOT NULL
        AND owners_midpoint <> '0'
        AND owners_midpoint <> ''
      ORDER BY CAST(NULLIF(owners_midpoint,'') AS INTEGER) DESC
      LIMIT ?;
    `).bind(limit).all();
    return Response.json(results);
  } catch (e) {
    console.error('analytics/top-owned:', e);
    return jsonErr(e.message);
  }
});

app.get('/api/analytics/releases-by-year', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        SUBSTR(release_date, 1, 4) AS year, 
        COUNT(*) AS count 
      FROM game_analytics 
      WHERE release_date IS NOT NULL 
        AND release_date <> '' 
        AND CAST(SUBSTR(release_date, 1, 4) AS INTEGER) BETWEEN 2000 AND 2025
      GROUP BY year 
      ORDER BY year ASC;
    `).all();
    return Response.json(results);
  } catch (e) {
    console.error('analytics/releases-by-year:', e);
    return jsonErr(e.message);
  }
});

app.get('/api/analytics/peak-ccu', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') ?? '25', 10), 100);
    const { results } = await c.env.DB.prepare(`
      SELECT 
        appid,
        name, 
        CAST(NULLIF(peak_ccu, '') AS INTEGER) AS peak_ccu,
        genre_primary
      FROM game_analytics 
      WHERE peak_ccu IS NOT NULL AND peak_ccu <> '0' AND peak_ccu <> ''
      ORDER BY CAST(NULLIF(peak_ccu, '') AS INTEGER) DESC 
      LIMIT ?;
    `).bind(limit).all();
    return Response.json(results);
  } catch (e) {
    console.error('analytics/peak-ccu:', e);
    return jsonErr(e.message);
  }
});

app.get('/api/analytics/game-features', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        SUM(CASE WHEN LOWER(is_free) = 'true' THEN 1 ELSE 0 END) AS free_games, 
        SUM(CASE WHEN LOWER(is_early_access) = 'true' THEN 1 ELSE 0 END) AS early_access_games, 
        SUM(CASE WHEN LOWER(controller_support) = 'true' THEN 1 ELSE 0 END) AS controller_support_games,
        SUM(CASE WHEN CAST(NULLIF(achievement_count,'') AS INTEGER) > 0 THEN 1 ELSE 0 END) AS has_achievements,
        SUM(CASE WHEN CAST(NULLIF(dlc_count,'') AS INTEGER) > 0 THEN 1 ELSE 0 END) AS has_dlc,
        SUM(CASE WHEN CAST(NULLIF(languages_count,'') AS INTEGER) >= 10 THEN 1 ELSE 0 END) AS multilingual,
        SUM(CASE WHEN CAST(NULLIF(required_age,'') AS INTEGER) > 0 THEN 1 ELSE 0 END) AS age_restricted,
        COUNT(*) AS total_games 
      FROM game_analytics;
    `).all();
    return Response.json(results[0] || {});
  } catch (e) {
    console.error('analytics/game-features:', e);
    return jsonErr(e.message);
  }
});

// ─── Export ───────────────────────────────────────────────────────────────────
// For routes Hono doesn't handle (i.e. non-/api/* paths like /, /dashboard),
// fall through to Cloudflare's static asset service so the React SPA is served.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only route /api/* through Hono — everything else goes to static assets
    if (url.pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx);
    }

    // Serve static assets (React SPA) for all other routes
    return env.ASSETS.fetch(request);
  },
};

