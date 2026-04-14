const express = require('express')
const cors = require('cors')
const http = require('http')

const app = express()
const server = http.createServer(app)

app.use(cors({ origin: '*' }))
app.use(express.json())

app.get('/', (req, res) => res.json({ service: 'TRENCH', status: 'ok' }))
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'TRENCH backend', ts: new Date().toISOString() }))

// ── Debug endpoint ─────────────────────────────────────
app.get('/api/debug', async (req, res) => {
  try {
    const r = await fetch('https://api.dexscreener.com/latest/dex/search?q=bonk', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    })
    const text = await r.text()
    res.json({ status: r.status, preview: text.slice(0, 500) })
  } catch (err) {
    res.json({ error: err.message, stack: err.stack })
  }
})

// ── Rooms ──────────────────────────────────────────────
app.get('/api/rooms', async (req, res) => {
  try {
    const { sort = 'volume', search = '', limit = '20' } = req.query
    const query = search || 'bonk solana'
    
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
      { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
    )
    
    if (!r.ok) {
      return res.json({ rooms: [], total: 0, error: `DexScreener ${r.status}` })
    }

    const data = await r.json()
    const pairs = (data.pairs ?? []).filter(p =>
      p.chainId === 'solana' && (p.liquidity?.usd ?? 0) > 1000
    )

    let rooms = pairs.map(p => buildRoom(p))

    if (sort === 'new') rooms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    else if (sort === 'health') rooms.sort((a, b) => b.healthScore - a.healthScore)
    else rooms.sort((a, b) => b.volume24h - a.volume24h)

    res.json({ rooms: rooms.slice(0, parseInt(limit)), total: rooms.length })
  } catch (err) {
    console.error('[rooms error]', err.message)
    res.json({ rooms: FALLBACK_ROOMS, total: FALLBACK_ROOMS.length })
  }
})

// ── Single Room ────────────────────────────────────────
app.get('/api/rooms/:id', async (req, res) => {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${req.params.id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const data = await r.json()
    const p = data.pair
    if (!p) return res.status(404).json({ error: 'Not found' })
    res.json(buildRoom(p))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── KOLs ──────────────────────────────────────────────
app.get('/api/kols', (req, res) => res.json({ kols: KOLS }))

// ── Search ─────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query
    if (!q) return res.json({ results: [] })
    const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const data = await r.json()
    const results = (data.pairs ?? []).filter(p => p.chainId === 'solana').slice(0, 10)
    res.json({ results })
  } catch (err) {
    res.json({ results: [] })
  }
})

// ── Helpers ────────────────────────────────────────────
function buildRoom(p) {
  return {
    id: p.pairAddress,
    token: {
      address: p.baseToken?.address ?? '',
      name: p.baseToken?.name ?? 'Unknown',
      symbol: p.baseToken?.symbol ?? '???',
      logoUri: p.info?.imageUrl ?? null,
      decimals: 9,
      createdAt: new Date(p.pairCreatedAt ?? Date.now()),
    },
    price: parseFloat(p.priceUsd ?? '0'),
    priceChange24h: p.priceChange?.h24 ?? 0,
    volume24h: p.volume?.h24 ?? 0,
    liquidity: p.liquidity?.usd ?? 0,
    marketCap: p.marketCap ?? p.fdv ?? 0,
    healthScore: calcHealth(p),
    kolSentiment: { total: 0, holding: 0, sold: 0, holdingPercent: 0, avgEntryPrice: 0, avgBagValueUsd: 0, avgBagValueSol: 0 },
    memberCount: Math.floor(Math.random() * 200) + 10,
    messageCount: Math.floor(Math.random() * 500),
    flagCount: 0,
    isActive: true,
    createdAt: new Date(p.pairCreatedAt ?? Date.now()),
    url: p.url,
  }
}

function calcHealth(p) {
  let score = 50
  const liq = p.liquidity?.usd ?? 0
  const vol = p.volume?.h24 ?? 0
  const change = p.priceChange?.h24 ?? 0
  const ageHours = (Date.now() - (p.pairCreatedAt ?? Date.now())) / 3600000
  if (liq > 500000) score += 20
  else if (liq > 100000) score += 15
  else if (liq > 50000) score += 10
  else if (liq > 10000) score += 5
  else score -= 10
  if (liq > 0 && vol / liq > 30) score -= 10
  if (ageHours < 1) score -= 15
  else if (ageHours < 24) score -= 5
  else if (ageHours > 168) score += 10
  if (change > 500) score -= 10
  if (change < -80) score -= 15
  return Math.max(0, Math.min(100, score))
}

// ── Fallback rooms if DexScreener is down ─────────────
const FALLBACK_ROOMS = [
  { id: 'fallback-1', token: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', name: 'Bonk', symbol: 'BONK', logoUri: null, decimals: 5, createdAt: new Date() }, price: 0.00002847, priceChange24h: 12.4, volume24h: 48200000, liquidity: 12400000, marketCap: 1840000000, healthScore: 82, kolSentiment: { total: 8, holding: 6, sold: 2, holdingPercent: 75, avgEntryPrice: 0.000018, avgBagValueUsd: 24000, avgBagValueSol: 160 }, memberCount: 842, messageCount: 4201, flagCount: 0, isActive: true, createdAt: new Date() },
  { id: 'fallback-2', token: { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', name: 'dogwifhat', symbol: 'WIF', logoUri: null, decimals: 6, createdAt: new Date() }, price: 1.24, priceChange24h: -4.2, volume24h: 82400000, liquidity: 28000000, marketCap: 1240000000, healthScore: 78, kolSentiment: { total: 12, holding: 8, sold: 4, holdingPercent: 67, avgEntryPrice: 0.92, avgBagValueUsd: 48000, avgBagValueSol: 320 }, memberCount: 1204, messageCount: 8420, flagCount: 0, isActive: true, createdAt: new Date() },
  { id: 'fallback-3', token: { address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', name: 'Popcat', symbol: 'POPCAT', logoUri: null, decimals: 9, createdAt: new Date() }, price: 0.482, priceChange24h: 8.7, volume24h: 24100000, liquidity: 8200000, marketCap: 482000000, healthScore: 71, kolSentiment: { total: 6, holding: 5, sold: 1, holdingPercent: 83, avgEntryPrice: 0.31, avgBagValueUsd: 18000, avgBagValueSol: 120 }, memberCount: 421, messageCount: 2104, flagCount: 0, isActive: true, createdAt: new Date() },
]

const KOLS = [
  { id: '1', address: 'ANSMhFpT8RFkXpZGvohFc8EBvn6MRmAHMPT14CiUxRwM', displayName: 'Ansem', twitterHandle: 'blknoiz06', isVerified: true, reputationScore: 95, manipulationScore: 2, stats: { pnl24h: 14200, pnl7d: 84000, pnl30d: 420000, pnlAllTime: 2100000, winRate: 68, avgHoldTime: 12, totalTrades: 847, bestTrade: 180000, worstTrade: -12000, isStillHolding: true }, currentPositions: [], addedAt: new Date() },
  { id: '2', address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', displayName: 'Cobie', twitterHandle: 'cobie', isVerified: true, reputationScore: 91, manipulationScore: 1, stats: { pnl24h: -2400, pnl7d: 31000, pnl30d: 190000, pnlAllTime: 1400000, winRate: 72, avgHoldTime: 24, totalTrades: 412, bestTrade: 220000, worstTrade: -18000, isStillHolding: false }, currentPositions: [], addedAt: new Date() },
  { id: '3', address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKH', displayName: 'Murad', twitterHandle: 'MustStopMurad', isVerified: true, reputationScore: 88, manipulationScore: 3, stats: { pnl24h: 8900, pnl7d: 54000, pnl30d: 280000, pnlAllTime: 980000, winRate: 61, avgHoldTime: 48, totalTrades: 223, bestTrade: 150000, worstTrade: -22000, isStillHolding: true }, currentPositions: [], addedAt: new Date() },
  { id: '4', address: 'HVh6wHNBAsQDXVL42aCBB6R3UWrMBBV5sMfpbmZfDPQT', displayName: 'Hsaka', twitterHandle: 'HsakaTrades', isVerified: true, reputationScore: 85, manipulationScore: 2, stats: { pnl24h: 5600, pnl7d: 28000, pnl30d: 142000, pnlAllTime: 720000, winRate: 64, avgHoldTime: 18, totalTrades: 634, bestTrade: 110000, worstTrade: -9000, isStillHolding: true }, currentPositions: [], addedAt: new Date() },
  { id: '5', address: 'GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgj', displayName: 'KookiesMons', twitterHandle: 'KookiesMons', isVerified: true, reputationScore: 79, manipulationScore: 5, stats: { pnl24h: -1200, pnl7d: 8400, pnl30d: 62000, pnlAllTime: 310000, winRate: 55, avgHoldTime: 8, totalTrades: 1204, bestTrade: 78000, worstTrade: -14000, isStillHolding: false }, currentPositions: [], addedAt: new Date() },
]

const PORT = parseInt(process.env.PORT) || 3000
server.listen(PORT, '0.0.0.0', () => console.log(`TRENCH backend running on port ${PORT}`))
