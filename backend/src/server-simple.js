const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

const PORT = process.env.PORT || 3000
const server = require('http').createServer(app)

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'TRENCH backend', ts: new Date().toISOString() }))
app.get('/', (req, res) => res.json({ status: 'ok', service: 'TRENCH backend', ts: new Date().toISOString() }))

// ── Pump.fun Chart API (pump-v2 → pump-v1 → GeckoTerminal) ──────────────
app.get('/api/pump/candles/:mint', async (req, res) => {
  const { mint } = req.params
  const { tf = '1', limit = '300' } = req.query
  const headers = { accept: 'application/json', origin: 'https://pump.fun', referer: 'https://pump.fun/', 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }

  for (const base of ['https://frontend-api-v2.pump.fun', 'https://frontend-api.pump.fun']) {
    try {
      const r = await fetch(`${base}/candlesticks/${mint}?offset=0&limit=${limit}&timeframe=${tf}`, { headers })
      if (r.ok) {
        const data = await r.json()
        if (Array.isArray(data) && data.length > 0) {
          const candles = data.map(c => ({
            time: Math.floor((c.timestamp || c.time * 1000) / 1000),
            open: parseFloat(c.open) || 0, high: parseFloat(c.high) || 0,
            low: parseFloat(c.low) || 0, close: parseFloat(c.close) || 0,
            volume: parseFloat(c.volume) || 0
          })).filter(c => c.time > 0 && c.open > 0)
          if (candles.length > 0) return res.json({ candles, source: base.includes('v2') ? 'pump-v2' : 'pump-v1' })
        }
      }
    } catch(e) {}
  }

  // GeckoTerminal fallback
  try {
    const pr = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools?page=1`)
    const pd = await pr.json()
    const poolAddr = pd?.data?.[0]?.attributes?.address
    if (poolAddr) {
      const tfStr = ['60','240'].includes(tf) ? 'hour' : 'minute'
      const agg = {'1':1,'5':5,'15':15,'60':1,'240':4}[tf] || 1
      const cr = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddr}/ohlcv/${tfStr}?limit=${limit}&aggregate=${agg}&currency=usd`)
      const cd = await cr.json()
      const list = cd?.data?.attributes?.ohlcv_list ?? []
      if (list.length > 0) {
        const candles = list.reverse().map(([t,o,h,l,c,v]) => ({
          time: t, open: parseFloat(o)||0, high: parseFloat(h)||0,
          low: parseFloat(l)||0, close: parseFloat(c)||0, volume: parseFloat(v)||0
        })).filter(c => c.open > 0)
        if (candles.length > 0) return res.json({ candles, source: 'geckoterminal', poolAddr })
      }
    }
  } catch(e) {}

  res.json({ candles: [], source: 'none' })
})

// ── Pump.fun Real-Time Trades ────────────────────────────────────────────
app.get('/api/pump/trades/:mint', async (req, res) => {
  const { mint } = req.params
  const headers = { accept: 'application/json', origin: 'https://pump.fun', referer: 'https://pump.fun/', 'user-agent': 'Mozilla/5.0' }
  for (const base of ['https://frontend-api-v2.pump.fun', 'https://frontend-api.pump.fun']) {
    try {
      const r = await fetch(`${base}/trades/all/${mint}?limit=50&minimumSize=0`, { headers })
      if (r.ok) {
        const data = await r.json()
        if (Array.isArray(data) && data.length > 0) return res.json(data)
      }
    } catch(e) {}
  }
  res.json([])
})

// ── Axiom API Proxies (CORS bypass) ──────────────────────────────────────
const axiomHeaders = { accept: 'application/json', origin: 'https://axiom.trade', referer: 'https://axiom.trade/', 'user-agent': 'Mozilla/5.0' }
const axiomBases = ['https://api.axiom.trade','https://api2.axiom.trade','https://api3.axiom.trade','https://api4.axiom.trade']

app.get('/api/axiom/token-info/:pair', async (req, res) => {
  for (const base of axiomBases) {
    try {
      const r = await fetch(`${base}/token-info/${req.params.pair}`, { headers: axiomHeaders })
      if (r.ok) return res.json(await r.json())
    } catch(e) {}
  }
  res.json({ error: 'unavailable' })
})

app.get('/api/axiom/pair-info/:pair', async (req, res) => {
  for (const base of axiomBases) {
    try {
      const r = await fetch(`${base}/pair-info/${req.params.pair}`, { headers: axiomHeaders })
      if (r.ok) return res.json(await r.json())
    } catch(e) {}
  }
  res.json({ error: 'unavailable' })
})

app.get('/api/axiom/top-traders/:pair', async (req, res) => {
  for (const base of axiomBases) {
    try {
      const r = await fetch(`${base}/top-traders/${req.params.pair}`, { headers: axiomHeaders })
      if (r.ok) return res.json(await r.json())
    } catch(e) {}
  }
  res.json([])
})

app.get('/api/axiom/pair-stats/:pair', async (req, res) => {
  for (const base of axiomBases) {
    try {
      const r = await fetch(`${base}/pair-stats/${req.params.pair}`, { headers: axiomHeaders })
      if (r.ok) return res.json(await r.json())
    } catch(e) {}
  }
  res.json([])
})

// GeckoTerminal OHLCV proxy
app.get('/api/ohlcv/:mint', async (req, res) => {
  try {
    const { mint } = req.params, { tf = '1', limit = '300' } = req.query
    const pr = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools?page=1`)
    const pd = await pr.json()
    const poolAddr = pd?.data?.[0]?.attributes?.address
    if (!poolAddr) return res.json({ candles: [] })
    const tfStr = ['60','240'].includes(tf) ? 'hour' : 'minute'
    const agg = {'1':1,'5':5,'15':15,'60':1,'240':4}[tf] || 1
    const cr = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddr}/ohlcv/${tfStr}?limit=${limit}&aggregate=${agg}&currency=usd`)
    const cd = await cr.json()
    const list = cd?.data?.attributes?.ohlcv_list ?? []
    const candles = list.reverse().map(([t,o,h,l,c,v]) => ({ time: t, open: parseFloat(o)||0, high: parseFloat(h)||0, low: parseFloat(l)||0, close: parseFloat(c)||0, volume: parseFloat(v)||0 })).filter(c => c.open > 0)
    res.json({ candles, poolAddr })
  } catch(e) { res.json({ candles: [] }) }
})

server.listen(PORT, () => console.log(`TRENCH backend running on port ${PORT}`))
