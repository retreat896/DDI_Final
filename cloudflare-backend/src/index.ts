import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
  STEAM_API_KEY: string
  FRONTEND_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}))

const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login"

app.get('/api/auth/login', (c) => {
  const url = new URL(c.req.url)
  const host = url.origin
  
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': `${host}/api/auth/callback`,
    'openid.realm': host,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  })
  
  return c.redirect(`${STEAM_OPENID_URL}?${params.toString()}`)
})

app.get('/api/auth/callback', async (c) => {
  const url = new URL(c.req.url)
  const searchParams = url.searchParams
  
  const params = new URLSearchParams()
  searchParams.forEach((value, key) => {
    params.append(key, value)
  })
  params.set('openid.mode', 'check_authentication')

  const response = await fetch(STEAM_OPENID_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  })
  
  const text = await response.text()
  
  if (text.includes('is_valid:true')) {
    const claimedId = searchParams.get('openid.claimed_id') || ''
    const match = claimedId.match(/https:\/\/steamcommunity\.com\/openid\/id\/(\d+)/)
    
    if (match) {
      const steamId = match[1]
      
      // Fire off cache function without blocking the redirect
      c.executionCtx.waitUntil(fetchAndStoreProfile(steamId, c.env))
      
      return c.redirect(`${c.env.FRONTEND_URL}?steamid=${steamId}`)
    }
  }
  
  return c.redirect(`${c.env.FRONTEND_URL}?error=authentication_failed`)
})

async function fetchAndStoreProfile(steamId: string, env: Bindings) {
  if (!env.STEAM_API_KEY) return
  
  const url = `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${env.STEAM_API_KEY}&steamids=${steamId}`
  const response = await fetch(url)
  
  if (response.ok) {
    const data = await response.json() as any
    const players = data?.response?.players || []
    
    if (players.length > 0) {
      const p = players[0]
      try {
        await env.DB.prepare(`
          INSERT INTO users (steam_id, persona_name, profile_url, avatar_url, last_login)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(steam_id) DO UPDATE SET
            persona_name=excluded.persona_name,
            profile_url=excluded.profile_url,
            avatar_url=excluded.avatar_url,
            last_login=CURRENT_TIMESTAMP
        `).bind(steamId, p.personaname, p.profileurl, p.avatarfull).run()
      } catch (err) {
        console.error("Error storing profile", err)
      }
    }
  }
}

app.get('/api/player/:steamid', async (c) => {
  const steamid = c.req.param('steamid')
  
  try {
    const result = await c.env.DB
      .prepare("SELECT * FROM users WHERE steam_id = ?")
      .bind(steamid)
      .first()
      
    if (result) {
      return c.json(result)
    }
  } catch (err) {
    console.error(err);
  }
  
  return c.json({ error: "Player not found" }, 404)
})

app.get('/api/games/:steamid', async (c) => {
  const steamid = c.req.param('steamid')
  
  if (!c.env.STEAM_API_KEY) {
    return c.json({ error: "Steam API key not configured" }, 500)
  }
  
  const url = `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${c.env.STEAM_API_KEY}&steamid=${steamid}&format=json&include_appinfo=1`
  const req = await fetch(url)
  
  if (req.ok) {
    const data = await req.json()
    return c.json(data)
  }
  
  return c.json({ error: "Failed to fetch games" }, 500)
})

export default app
