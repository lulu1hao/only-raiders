import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const OFFICIAL_MAP_NAME_TO_ID = {
  'Dam Battlegrounds': 'dam-battlegrounds',
  'Buried City': 'buried-city',
  Spaceport: 'spaceport',
  'The Blue Gate': 'blue-gate',
  'Stella Montis': 'stella-montis',
  'Riven Tides': 'riven-tides',
  'Pendola Pass': 'pendola-pass',
}

const OFFICIAL_COND_NAME_TO_ID = {
  'ARC Frigate': 'arc-frigate',
  Beachcombing: 'buried-treasure',
  'Bird City': 'bird-city',
  'Close Scrutiny': 'close-scrutiny',
  'Cold Snap': 'cold-snap',
  'Electromagnetic Storm': 'electromagnetic-storm',
  Harvester: 'harvester',
  'Hidden Bunker': 'hidden-bunker',
  Hurricane: 'hurricane',
  'Husk Graveyard': 'husk-graveyard',
  'Launch Tower Loot': 'launch-tower-loot',
  'Locked Gate': 'locked-gate',
  'Lush Blooms': 'lush-blooms',
  Matriarch: 'matriarch',
  'Night Raid': 'night-raid',
  'Prospecting Probes': 'prospecting-probes',
  Redirection: 'fallen-emperor',
  'Uncovered Caches': 'uncovered-caches',
}

const OFFICIAL_MAJOR_IDS = new Set([
  'arc-frigate',
  'close-scrutiny',
  'cold-snap',
  'electromagnetic-storm',
  'hidden-bunker',
  'hurricane',
  'locked-gate',
  'night-raid',
])

function officialScheduleMiddlewarePlugin() {
  let cachedPayload = null
  let cachedAt = 0
  const CACHE_TTL_MS = 5 * 60 * 1000

  const handler = async (req, res, next) => {
    if (!req.url || !req.url.startsWith('/api/official-schedule')) {
      return next()
    }
    const force = req.url.includes('force=1')
    if (!force && cachedPayload && Date.now() - cachedAt < CACHE_TTL_MS) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(cachedPayload))
      return
    }
    try {
      const url = 'https://arcraiders.com/map-conditions'
      const upstream = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      })
      if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`)
      const html = await upstream.text()
      const match = html.match(/\{\\"conditionItems\\":\[[\s\S]*?\\"serverNow\\":\d+\}/)
      if (!match) throw new Error('conditionItems payload not found')
      const data = JSON.parse(JSON.parse(`"${match[0]}"`))
      const typeByCond = new Map((data.conditionItems || []).map((c) => [c.name, c.type]))

      const entries = []
      for (const raw of data.liveEntries || []) {
        const mapId = OFFICIAL_MAP_NAME_TO_ID[raw.mapDisplayName]
        const eventId = OFFICIAL_COND_NAME_TO_ID[raw.conditionName]
        if (!mapId || !eventId) continue
        entries.push({
          mapId,
          eventId,
          conditionName: raw.conditionName,
          mapDisplayName: raw.mapDisplayName,
          officialType:
            typeByCond.get(raw.conditionName) ||
            (OFFICIAL_MAJOR_IDS.has(eventId) ? 'major' : 'minor'),
          durationInSeconds: raw.durationInSeconds || 3600,
          startTimestamp: raw.startTimestamp,
          endTimestamp: raw.endTimestamp,
          regionTimestamps: raw.regionTimestamps || null,
        })
      }

      const payload = {
        ok: true,
        sourceUrl: url,
        fetchedAt: Date.now(),
        serverNow: data.serverNow || Date.now(),
        windowDurationMs: 3600000,
        minStartTimestamp: Math.min(...entries.map((e) => e.startTimestamp)),
        maxEndTimestamp: Math.max(...entries.map((e) => e.endTimestamp)),
        entries,
      }
      cachedPayload = payload
      cachedAt = Date.now()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(payload))
    } catch (err) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: err.message }))
    }
  }

  return {
    name: 'official-arc-schedule-api',
    configureServer(server) {
      server.middlewares.use(handler)
    },
      configurePreviewServer(server) {
        server.middlewares.use(handler)
      },
    }
  }

function arcTrackerSyncMiddlewarePlugin() {
  const pendingPkceByState = new Map()
  const completedOAuthByState = new Map()

  const openSystemBrowser = (url) => {
    try {
      execFile('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Start-Process '${String(url).replace(/'/g, "''")}'`,
      ])
    } catch {
      // ignore fallback
    }
  }

  const parseMcpResponse = async (res) => {
    const text = await res.text()
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      const lines = text
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .filter(Boolean)
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          return JSON.parse(lines[i])
        } catch {
          // continue
        }
      }
      return null
    }
  }

  const fetchViaMcp = async (bearerToken) => {
    const mcpUrl = 'https://mcp.arctracker.io/mcp'
    const baseHeaders = {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    }

    const initRes = await fetch(mcpUrl, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'arc-map', version: '1.0.0' },
        },
      }),
    })

    if (!initRes.ok) {
      const errBody = await initRes.json().catch(() => ({}))
      throw new Error(errBody.error_description || errBody.error || `MCP HTTP ${initRes.status}`)
    }

    const sessionId = initRes.headers.get('mcp-session-id')
    if (sessionId) baseHeaders['Mcp-Session-Id'] = sessionId
    await parseMcpResponse(initRes)

    await fetch(mcpUrl, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    }).catch(() => {})

    const listRes = await fetch(mcpUrl, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    })
    const listJson = await parseMcpResponse(listRes)
    const tools = listJson?.result?.tools || []

    const callTool = async (name, args = {}) => {
      const r = await fetch(mcpUrl, {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Math.floor(Math.random() * 100000) + 10,
          method: 'tools/call',
          params: { name, arguments: args },
        }),
      })
      const j = await parseMcpResponse(r)
      const resObj = j?.result
      if (!resObj) return null
      if (resObj.structuredContent) return resObj.structuredContent
      const texts = (resObj.content || [])
        .filter((c) => c.type === 'text' && c.text)
        .map((c) => c.text)
      for (const t of texts) {
        try {
          return JSON.parse(t)
        } catch {
          // not raw JSON
        }
      }
      return texts.join('\n') || resObj
    }

    const result = {
      profile: null,
      quests: null,
      hideout: null,
      projects: null,
      blueprints: null,
    }

    const readTools = tools.filter((t) => {
      const n = String(t.name || '').toLowerCase()
      if (/update|set_|mark_|write|mutate|delete|add_|create|log_/.test(n)) return false
      return /profile|account|user|quest|hideout|workshop|project|expedition|blueprint|progress/.test(
        n,
      )
    })

    await Promise.all(
      readTools.map(async (t) => {
        const n = String(t.name || '').toLowerCase()
        const data = await callTool(t.name, {}).catch(() => null)
        if (!data) return
        if (/profile|account|user/.test(n) && !result.profile) result.profile = data
        if (/quest/.test(n)) result.quests = data.quests || data
        if (/hideout|workshop/.test(n)) result.hideout = data.hideout || data.modules || data
        if (/project|expedition/.test(n)) result.projects = data.projects || data
        if (/blueprint/.test(n)) result.blueprints = data.blueprints || data
        if (/progress/.test(n) && typeof data === 'object') {
          if (data.quests && !result.quests) result.quests = data.quests
          if ((data.hideout || data.modules) && !result.hideout)
            result.hideout = data.hideout || data.modules
          if (data.projects && !result.projects) result.projects = data.projects
          if (data.blueprints && !result.blueprints) result.blueprints = data.blueprints
          if ((data.user || data.profile) && !result.profile)
            result.profile = data.user || data.profile
        }
      }),
    )

    return result
  }

  const fetchViaRest = async (appKey, userKey) => {
    const reqHeaders = {
      Authorization: `Bearer ${userKey}`,
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    }
    if (appKey) reqHeaders['X-App-Key'] = appKey

    const fetchEndpoint = async (ep) => {
      try {
        const r = await fetch(`https://arctracker.io${ep}`, { headers: reqHeaders })
        const data = await r.json().catch(() => null)
        return { status: r.status, ok: r.ok, data }
      } catch (e) {
        return { status: 502, ok: false, error: e.message }
      }
    }

    const [profile, quests, hideout, projects, blueprints] = await Promise.all([
      fetchEndpoint('/api/v2/user/profile'),
      fetchEndpoint('/api/v2/user/quests?locale=en&filter=completed'),
      fetchEndpoint('/api/v2/user/hideout?locale=en'),
      fetchEndpoint('/api/v2/user/projects?locale=en'),
      fetchEndpoint('/api/v2/user/blueprints?locale=en&filter=learned'),
    ])

    const anyOk = [profile, quests, hideout, projects, blueprints].some((x) => x.ok)
    if (!anyOk) {
      const extractErr = (r) =>
        r?.data?.error?.message || r?.data?.error || r?.data?.message || null
      throw new Error(
        extractErr(profile) ||
          extractErr(quests) ||
          extractErr(blueprints) ||
          `HTTP ${profile.status}`,
      )
    }

    return {
      profile: profile.ok ? profile.data?.data || profile.data : null,
      quests: quests.ok ? quests.data?.data || quests.data : null,
      hideout: hideout.ok ? hideout.data?.data || hideout.data : null,
      projects: projects.ok ? projects.data?.data || projects.data : null,
      blueprints: blueprints.ok ? blueprints.data?.data || blueprints.data : null,
    }
  }

  const handler = async (req, res, next) => {
    if (!req.url) return next()

    // 1. Initialize OAuth 2.0 PKCE & open default system browser via OS
    if (req.url.startsWith('/api/arctracker-oauth/init') || req.url.startsWith('/api/arctracker-oauth/start')) {
      const isJsonInit = req.url.startsWith('/api/arctracker-oauth/init')
      try {
        const host = req.headers.host || 'localhost:5180'
        const redirectUri = `http://${host}/api/arctracker-oauth/callback`

        const regRes = await fetch('https://arctracker.io/api/auth/oauth2/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name: 'ARC Map Local',
            redirect_uris: [redirectUri],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
            scope: 'game:read progress:read inventory:read offline_access',
          }),
        })
        const reg = await regRes.json()
        if (!reg.client_id) throw new Error('OAuth 客户端注册失败')

        const verifier = crypto.randomBytes(32).toString('base64url')
        const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
        const state = crypto.randomBytes(16).toString('hex')

        pendingPkceByState.set(state, {
          clientId: reg.client_id,
          verifier,
          redirectUri,
          createdAt: Date.now(),
        })

        const authQuery = new URLSearchParams({
          response_type: 'code',
          client_id: reg.client_id,
          redirect_uri: redirectUri,
          scope: 'game:read progress:read inventory:read offline_access',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state,
          resource: 'https://mcp.arctracker.io/mcp',
        })

        const authInitUrl = `https://arctracker.io/api/auth/oauth2/authorize?${authQuery.toString()}`
        const authRes = await fetch(authInitUrl, { redirect: 'manual' })
        let targetUrl = authRes.headers.get('location')
        if (!targetUrl) {
          const j = await authRes.json().catch(() => null)
          if (j?.url) {
            targetUrl = j.url.startsWith('http') ? j.url : `https://arctracker.io${j.url}`
          }
        }
        if (!targetUrl) targetUrl = authInitUrl

        if (isJsonInit) {
          openSystemBrowser(targetUrl)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: true, state, authUrl: targetUrl }))
        } else {
          res.statusCode = 302
          res.setHeader('Location', targetUrl)
          res.end()
        }
      } catch (err) {
        if (isJsonInit) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, error: err.message }))
        } else {
          res.statusCode = 500
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(`<div>${err.message}</div>`)
        }
      }
      return
    }

    // 1.5 Poll OAuth completion state (no window.opener needed, immune to COOP & popup blockers)
    if (req.url.startsWith('/api/arctracker-oauth/poll')) {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:5180'}`)
      const state = urlObj.searchParams.get('state') || ''
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (completedOAuthByState.has(state)) {
        const result = completedOAuthByState.get(state)
        completedOAuthByState.delete(state)
        res.end(JSON.stringify({ status: 'done', ...result }))
      } else if (pendingPkceByState.has(state)) {
        res.end(JSON.stringify({ status: 'pending' }))
      } else {
        res.end(JSON.stringify({ status: 'expired', ok: false, error: '授权会话已过期' }))
      }
      return
    }

    // 2. OAuth 2.0 PKCE callback
    if (req.url.startsWith('/api/arctracker-oauth/callback')) {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:5180'}`)
      const code = urlObj.searchParams.get('code')
      const state = urlObj.searchParams.get('state')
      const oauthErr = urlObj.searchParams.get('error_description') || urlObj.searchParams.get('error')

      const finishCallback = (payload) => {
        if (state) completedOAuthByState.set(state, payload)
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(`<!doctype html><html><body style="background:#0d0f17;color:#f5ebd6;font-family:sans-serif;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="font-size:18px;font-weight:700;color:#ffbc13">${payload.ok ? '✓ 数据同步完成' : '授权失败'}</div>
          <div style="font-size:13px;color:#9ca3af">${payload.ok ? '请切回 ARC Map 界面，此页面可直接关闭' : payload.error || ''}</div>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage(${JSON.stringify({ type: 'ARC_TRACKER_OAUTH_RESULT', ...payload })}, '*');
              }
              window.close();
            } catch (e) {}
          </script>
        </body></html>`)
      }

      if (oauthErr || !code || !state || !pendingPkceByState.has(state)) {
        finishCallback({ ok: false, error: oauthErr || '无效的授权状态' })
        return
      }

      const pkce = pendingPkceByState.get(state)
      pendingPkceByState.delete(state)

      try {
        const tokenRes = await fetch('https://arctracker.io/api/auth/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: pkce.clientId,
            code,
            redirect_uri: pkce.redirectUri,
            code_verifier: pkce.verifier,
            resource: 'https://mcp.arctracker.io/mcp',
          }).toString(),
        })
        const tokenJson = await tokenRes.json().catch(() => ({}))
        const accessToken = tokenJson.access_token
        if (!accessToken) {
          throw new Error(tokenJson.error_description || tokenJson.error || '未能获取访问令牌')
        }

        let data
        try {
          data = await fetchViaMcp(accessToken)
        } catch {
          data = await fetchViaRest('', accessToken)
        }

        finishCallback({
          ok: true,
          syncedAt: Date.now(),
          accessToken,
          refreshToken: tokenJson.refresh_token || '',
          clientId: pkce.clientId,
          ...data,
        })
      } catch (err) {
        finishCallback({ ok: false, error: err.message })
      }
      return
    }

    // 3. Direct sync endpoint (supports single token via MCP OR appKey+userKey via REST)
    if (!req.url.startsWith('/api/arctracker-sync')) {
      return next()
    }

    const appKey = String(req.headers['x-app-key'] || '').trim()
    const userKey = String(req.headers['x-user-key'] || '').trim()

    if (!userKey) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: '请先点击一键授权或填入密钥' }))
      return
    }

    try {
      let data
      if (appKey) {
        data = await fetchViaRest(appKey, userKey)
      } else {
        try {
          data = await fetchViaMcp(userKey)
        } catch {
          data = await fetchViaRest('', userKey)
        }
      }

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(
        JSON.stringify({
          ok: true,
          syncedAt: Date.now(),
          ...data,
        }),
      )
    } catch (err) {
      res.statusCode = 401
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: err.message }))
    }
  }

  return {
    name: 'arc-tracker-sync-api',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

export default defineConfig({
  plugins: [vue(), officialScheduleMiddlewarePlugin(), arcTrackerSyncMiddlewarePlugin()],
  base: '/',
  server: { port: 5180, strictPort: true },
  optimizeDeps: { include: ['gsap'] },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three-engine'
          if (id.includes('node_modules/gsap')) return 'gsap-anim'
          if (
            id.includes('node_modules/vue') ||
            id.includes('node_modules/@vue') ||
            id.includes('node_modules/pinia') ||
            id.includes('node_modules/vue-router')
          ) {
            return 'vue-vendor'
          }
          if (id.includes('/src/data/mapsWikiData.json')) return 'data-maps-wiki'
          if (id.includes('/src/data/questsData.json')) return 'data-quests'
          if (id.includes('/src/data/questResourcesData.json')) return 'data-quest-resources'
          if (id.includes('/src/data/outpostVerifiedData.json')) return 'data-outpost'
          if (id.includes('/src/data/weaponsData.json')) return 'data-weapons'
          if (id.includes('/src/data/raiderSkillsData.json')) return 'data-raider'
        },
      },
    },
  },
})
