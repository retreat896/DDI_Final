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

app.get('/api/analytics/price-vs-reviews', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        name,
        CAST(NULLIF(price_final, '') AS REAL) / 100.0        AS price,
        CAST(NULLIF(positive_reviews, '') AS INTEGER)         AS positive_reviews,
        CAST(NULLIF(negative_reviews, '') AS INTEGER)         AS negative_reviews,
        CAST(NULLIF(owners_midpoint,  '') AS INTEGER)         AS owners_midpoint
      FROM  game_analytics
      WHERE price_final      IS NOT NULL AND price_final      <> '' AND price_final <> '0'
        AND positive_reviews IS NOT NULL AND positive_reviews <> ''
        AND negative_reviews IS NOT NULL AND negative_reviews <> ''
      ORDER BY RANDOM()
      LIMIT 500;
    `).all();

    const enriched = results
      .map(r => {
        const pos   = Number(r.positive_reviews) || 0;
        const neg   = Number(r.negative_reviews) || 0;
        const total = pos + neg;
        return {
          ...r,
          price:        Number(r.price),
          review_pct:   total > 0 ? Math.round((pos / total) * 1000) / 10 : null,
          total_reviews: total,
        };
      })
      .filter(r => r.price > 0 && r.review_pct !== null);

    return Response.json(enriched);
  } catch (e) {
    console.error('analytics/price-vs-reviews:', e);
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

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.all('*', () => new Response(null, { status: 404 }));

export default app;
