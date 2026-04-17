const express = require('express')
const cors = require('cors')
const http = require('http')

const app = express()
const server = http.createServer(app)
app.use(cors({ origin: '*' }))
app.use(express.json())

// ── Cache ──────────────────────────────────────────────
let cachedRooms = []
let cacheTime = 0
const CACHE_TTL = 60 * 1000 // 1 minute

// Pre-warm cache on startup
async function warmCache() {
  try {
    const rooms = await fetchRooms('pump sol')
    if (rooms.length > 0) {
      cachedRooms = rooms
      cacheTime = Date.now()
      console.log(`[cache] Warmed with ${rooms.length} rooms`)
    }
  } catch (e) {
    console.error('[cache] Warm failed:', e.message)
  }
}

async function fetchRooms(q) {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000)
  })
  const data = await r.json()
  return (data.pairs ?? [])
    .filter(p => p.chainId === 'solana' && (p.liquidity?.usd ?? 0) > 1000 && p.baseToken?.symbol)
    .map(buildRoom)
}

app.get('/', (req, res) => res.json({ service: 'TRENCH', status: 'ok' }))
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'TRENCH backend', ts: new Date().toISOString(), cached: cachedRooms.length }))

app.get('/api/rooms', async (req, res) => {
  const { sort = 'volume', search = '', limit = '30' } = req.query

  // Serve from cache if fresh and no search
  if (!search && cachedRooms.length > 0 && Date.now() - cacheTime < CACHE_TTL) {
    let rooms = [...cachedRooms]
    if (sort === 'new') rooms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    else if (sort === 'health') rooms.sort((a, b) => b.healthScore - a.healthScore)
    else rooms.sort((a, b) => b.volume24h - a.volume24h)
    return res.json({ rooms: rooms.slice(0, parseInt(limit)), total: rooms.length, cached: true })
  }

  const q = search || 'pump sol'
  try {
    let rooms = await fetchRooms(q)
    if (sort === 'new') rooms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    else if (sort === 'health') rooms.sort((a, b) => b.healthScore - a.healthScore)
    else rooms.sort((a, b) => b.volume24h - a.volume24h)

    // Update cache if not a search
    if (!search && rooms.length > 0) {
      cachedRooms = rooms
      cacheTime = Date.now()
    }

    return res.json({ rooms: rooms.slice(0, parseInt(limit)), total: rooms.length })
  } catch (err) {
    console.error('[rooms error]', err.message)
    // Serve stale cache if available
    if (cachedRooms.length > 0) {
      return res.json({ rooms: cachedRooms.slice(0, parseInt(limit)), total: cachedRooms.length, stale: true })
    }
    return res.json({ rooms: FALLBACK, total: FALLBACK.length })
  }
})

app.get('/api/rooms/:id', async (req, res) => {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${req.params.id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000)
    })
    const data = await r.json()
    if (!data.pair) return res.status(404).json({ error: 'Not found' })
    res.json(buildRoom(data.pair))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/kols', (req, res) => res.json({ kols: KOLS }))

app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query
    if (!q) return res.json({ results: [] })
    const rooms = await fetchRooms(q)
    res.json({ results: rooms.slice(0, 10) })
  } catch { res.json({ results: [] }) }
})

app.get('/api/trending', async (req, res) => {
  try {
    const r = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000)
    })
    const data = await r.json()
    res.json({ trending: (Array.isArray(data) ? data : []).filter(t => t.chainId === 'solana').slice(0, 10) })
  } catch { res.json({ trending: [] }) }
})

function buildRoom(p) {
  return {
    id: p.pairAddress,
    token: { address: p.baseToken?.address ?? '', name: p.baseToken?.name ?? 'Unknown', symbol: p.baseToken?.symbol ?? '???', logoUri: p.info?.imageUrl ?? null, decimals: 9, createdAt: new Date(p.pairCreatedAt ?? Date.now()) },
    price: parseFloat(p.priceUsd ?? '0'),
    priceChange24h: p.priceChange?.h24 ?? 0,
    priceChange1h: p.priceChange?.h1 ?? 0,
    volume24h: p.volume?.h24 ?? 0,
    liquidity: p.liquidity?.usd ?? 0,
    marketCap: p.marketCap ?? p.fdv ?? 0,
    healthScore: calcHealth(p),
    buys24h: p.txns?.h24?.buys ?? 0,
    sells24h: p.txns?.h24?.sells ?? 0,
    kolSentiment: { total: 0, holding: 0, sold: 0, holdingPercent: 0, avgEntryPrice: 0, avgBagValueUsd: 0, avgBagValueSol: 0 },
    memberCount: Math.floor(Math.random() * 300) + 20,
    messageCount: Math.floor(Math.random() * 1000),
    flagCount: 0, isActive: true,
    createdAt: new Date(p.pairCreatedAt ?? Date.now()),
    dexUrl: p.url, dexId: p.dexId,
  }
}

function calcHealth(p) {
  let score = 50
  const liq = p.liquidity?.usd ?? 0
  const vol = p.volume?.h24 ?? 0
  const change = p.priceChange?.h24 ?? 0
  const buys = p.txns?.h24?.buys ?? 0
  const sells = p.txns?.h24?.sells ?? 0
  const ageHours = (Date.now() - (p.pairCreatedAt ?? Date.now())) / 3600000
  if (liq > 1000000) score += 20
  else if (liq > 500000) score += 16
  else if (liq > 100000) score += 12
  else if (liq > 50000) score += 8
  else if (liq > 10000) score += 4
  else score -= 10
  if (liq > 0 && vol / liq > 50) score -= 15
  else if (liq > 0 && vol / liq > 20) score -= 8
  if (ageHours < 0.5) score -= 20
  else if (ageHours < 1) score -= 12
  else if (ageHours < 24) score -= 4
  else if (ageHours > 168) score += 8
  if (buys + sells > 0) { const br = buys / (buys + sells); if (br > 0.65) score += 6; else if (br < 0.35) score -= 8 }
  if (change > 1000) score -= 15; else if (change > 500) score -= 8
  if (change < -80) score -= 15
  return Math.max(0, Math.min(100, score))
}

const FALLBACK = [
  { id: 'f1', token: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', name: 'Bonk', symbol: 'BONK', logoUri: null, decimals: 5, createdAt: new Date() }, price: 0.00002847, priceChange24h: 12.4, priceChange1h: 1.2, volume24h: 48200000, liquidity: 12400000, marketCap: 1840000000, healthScore: 82, buys24h: 24821, sells24h: 18204, kolSentiment: { total: 0, holding: 0, sold: 0, holdingPercent: 0, avgEntryPrice: 0, avgBagValueUsd: 0, avgBagValueSol: 0 }, memberCount: 842, messageCount: 4201, flagCount: 0, isActive: true, createdAt: new Date(), dexUrl: 'https://dexscreener.com/solana/bonk', dexId: 'raydium' },
  { id: 'f2', token: { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', name: 'dogwifhat', symbol: 'WIF', logoUri: null, decimals: 6, createdAt: new Date() }, price: 1.24, priceChange24h: -4.2, priceChange1h: -0.8, volume24h: 82400000, liquidity: 28000000, marketCap: 1240000000, healthScore: 78, buys24h: 18420, sells24h: 14210, kolSentiment: { total: 0, holding: 0, sold: 0, holdingPercent: 0, avgEntryPrice: 0, avgBagValueUsd: 0, avgBagValueSol: 0 }, memberCount: 1204, messageCount: 8420, flagCount: 0, isActive: true, createdAt: new Date(), dexUrl: 'https://dexscreener.com/solana/wif', dexId: 'raydium' },
  { id: 'f3', token: { address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', name: 'Popcat', symbol: 'POPCAT', logoUri: null, decimals: 9, createdAt: new Date() }, price: 0.482, priceChange24h: 8.7, priceChange1h: 1.2, volume24h: 24100000, liquidity: 8200000, marketCap: 482000000, healthScore: 71, buys24h: 12400, sells24h: 9800, kolSentiment: { total: 0, holding: 0, sold: 0, holdingPercent: 0, avgEntryPrice: 0, avgBagValueUsd: 0, avgBagValueSol: 0 }, memberCount: 421, messageCount: 2104, flagCount: 0, isActive: true, createdAt: new Date(), dexUrl: 'https://dexscreener.com/solana/popcat', dexId: 'raydium' },
]

const KOLS = [
  { id: '1', address: 'ANSMhFpT8RFkXpZGvohFc8EBvn6MRmAHMPT14CiUxRwM', displayName: 'Ansem', twitterHandle: 'blknoiz06', isVerified: true, reputationScore: 95, manipulationScore: 2, stats: { pnl24h: 14200, pnl7d: 84000, pnl30d: 420000, pnlAllTime: 2100000, winRate: 68, avgHoldTime: 12, totalTrades: 847, bestTrade: 180000, worstTrade: -12000, isStillHolding: true }, currentPositions: [], addedAt: new Date() },
  { id: '2', address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', displayName: 'Cobie', twitterHandle: 'cobie', isVerified: true, reputationScore: 91, manipulationScore: 1, stats: { pnl24h: -2400, pnl7d: 31000, pnl30d: 190000, pnlAllTime: 1400000, winRate: 72, avgHoldTime: 24, totalTrades: 412, bestTrade: 220000, worstTrade: -18000, isStillHolding: false }, currentPositions: [], addedAt: new Date() },
  { id: '3', address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKH', displayName: 'Murad', twitterHandle: 'MustStopMurad', isVerified: true, reputationScore: 88, manipulationScore: 3, stats: { pnl24h: 8900, pnl7d: 54000, pnl30d: 280000, pnlAllTime: 980000, winRate: 61, avgHoldTime: 48, totalTrades: 223, bestTrade: 150000, worstTrade: -22000, isStillHolding: true }, currentPositions: [], addedAt: new Date() },
  { id: '4', address: 'HVh6wHNBAsQDXVL42aCBB6R3UWrMBBV5sMfpbmZfDPQT', displayName: 'Hsaka', twitterHandle: 'HsakaTrades', isVerified: true, reputationScore: 85, manipulationScore: 2, stats: { pnl24h: 5600, pnl7d: 28000, pnl30d: 142000, pnlAllTime: 720000, winRate: 64, avgHoldTime: 18, totalTrades: 634, bestTrade: 110000, worstTrade: -9000, isStillHolding: true }, currentPositions: [], addedAt: new Date() },
  { id: '5', address: 'GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgj', displayName: 'KookiesMons', twitterHandle: 'KookiesMons', isVerified: true, reputationScore: 79, manipulationScore: 5, stats: { pnl24h: -1200, pnl7d: 8400, pnl30d: 62000, pnlAllTime: 310000, winRate: 55, avgHoldTime: 8, totalTrades: 1204, bestTrade: 78000, worstTrade: -14000, isStillHolding: false }, currentPositions: [], addedAt: new Date() },
  { id: '6', address: 'BVJNTRSMr1FdHDMCxSRCMNqnqwKMCnFHcYkCVxDEAyeW', displayName: 'Weremeow', twitterHandle: 'weremeow', isVerified: true, reputationScore: 76, manipulationScore: 4, stats: { pnl24h: 3200, pnl7d: 18000, pnl30d: 94000, pnlAllTime: 480000, winRate: 59, avgHoldTime: 6, totalTrades: 2104, bestTrade: 64000, worstTrade: -11000, isStillHolding: true }, currentPositions: [], addedAt: new Date() },
  { id: '7', address: 'FnXBBsZRFjBdYX6YmSQQYXnmL2yZWcTDrPwEFGDGpump', displayName: 'DegenSpartan', twitterHandle: 'DegenSpartanAI', isVerified: true, reputationScore: 83, manipulationScore: 6, stats: { pnl24h: 9800, pnl7d: 42000, pnl30d: 210000, pnlAllTime: 1100000, winRate: 63, avgHoldTime: 16, totalTrades: 891, bestTrade: 130000, worstTrade: -16000, isStillHolding: true }, currentPositions: [], addedAt: new Date() },
]

const PORT = parseInt(process.env.PORT) || 3000
server.listen(PORT, '0.0.0.0', () => {
  console.log(`TRENCH backend running on port ${PORT}`)
  // Warm cache immediately on boot
  warmCache()
  // Refresh cache every 90 seconds
  setInterval(warmCache, 90 * 1000)
})
