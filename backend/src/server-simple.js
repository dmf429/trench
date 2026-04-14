const express = require('express')
const cors = require('cors')
const http = require('http')

const app = express()
const server = http.createServer(app)

app.use(cors({ origin: '*' }))
app.use(express.json())

app.get('/', (req, res) => res.json({ service: 'TRENCH', status: 'ok' }))
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'TRENCH backend', ts: new Date().toISOString() }))

// ── Rooms ─────────────────────────────────────────────
app.get('/api/rooms', async (req, res) => {
  try {
    const { sort = 'volume', search = '', limit = '30' } = req.query

    // Pull from multiple queries for diversity
    const queries = search
      ? [search]
      : ['solana meme', 'pump fun', 'pepe sol', 'dog sol', 'cat sol']

    const allPairs = []
    const seen = new Set()

    await Promise.allSettled(queries.map(async (q) => {
      try {
        const r = await fetch(
          `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
          { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) }
        )
        const data = await r.json()
        for (const p of (data.pairs ?? [])) {
          if (p.chainId !== 'solana') continue
          if (seen.has(p.pairAddress)) continue
          if ((p.liquidity?.usd ?? 0) < 2000) continue
          if (!p.baseToken?.symbol) continue
          seen.add(p.pairAddress)
          allPairs.push(p)
        }
      } catch {}
    }))

    // Sort
    if (sort === 'new') allPairs.sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0))
    else if (sort === 'health') allPairs.sort((a, b) => calcHealth(b) - calcHealth(a))
    else allPairs.sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))

    const rooms = allPairs.slice(0, parseInt(limit)).map(buildRoom)
    res.json({ rooms, total: rooms.length })
  } catch (err) {
    console.error('[rooms]', err.message)
    res.json({ rooms: FALLBACK, total: FALLBACK.length })
  }
})

// ── Single Room ────────────────────────────────────────
app.get('/api/rooms/:id', async (req, res) => {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/solana/${req.params.id}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
    )
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
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
    )
    const data = await r.json()
    res.json({ results: (data.pairs ?? []).filter(p => p.chainId === 'solana').slice(0, 10) })
  } catch (err) {
    res.json({ results: [] })
  }
})

// ── Trending ──────────────────────────────────────────
app.get('/api/trending', async (req, res) => {
  try {
    const r = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000)
    })
    const data = await r.json()
    const sol = (Array.isArray(data) ? data : []).filter(t => t.chainId === 'solana').slice(0, 10)
    res.json({ trending: sol })
  } catch (err) {
    res.json({ trending: [] })
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
    priceChange1h: p.priceChange?.h1 ?? 0,
    priceChange6h: p.priceChange?.h6 ?? 0,
    volume24h: p.volume?.h24 ?? 0,
    volume1h: p.volume?.h1 ?? 0,
    liquidity: p.liquidity?.usd ?? 0,
    marketCap: p.marketCap ?? p.fdv ?? 0,
    fdv: p.fdv ?? 0,
    healthScore: calcHealth(p),
    buys24h: p.txns?.h24?.buys ?? 0,
    sells24h: p.txns?.h24?.sells ?? 0,
    kolSentiment: { total: 0, holding: 0, sold: 0, holdingPercent: 0, avgEntryPrice: 0, avgBagValueUsd: 0, avgBagValueSol: 0 },
    memberCount: Math.floor(Math.random() * 300) + 20,
    messageCount: Math.floor(Math.random() * 1000),
    flagCount: 0,
    isActive: true,
    createdAt: new Date(p.pairCreatedAt ?? Date.now()),
    dexUrl: p.url,
    dexId: p.dexId,
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

  // Liquidity score
  if (liq > 1000000) score += 20
  else if (liq > 500000) score += 16
  else if (liq > 100000) score += 12
  else if (liq > 50000) score += 8
  else if (liq > 10000) score += 4
  else score -= 10

  // Volume/liquidity ratio (wash trading check)
  if (liq > 0 && vol / liq > 50) score -= 15
  else if (liq > 0 && vol / liq > 20) score -= 8

  // Age
  if (ageHours < 0.5) score -= 20
  else if (ageHours < 1) score -= 12
  else if (ageHours < 24) score -= 4
  else if (ageHours > 168) score += 8

  // Buy/sell ratio
  if (buys + sells > 0) {
    const buyRatio = buys / (buys + sells)
    if (buyRatio > 0.65) score += 6
    else if (buyRatio < 0.35) score -= 8
  }

  // Extreme price movements
  if (change > 1000) score -= 15
  else if (change > 500) score -= 8
  if (change < -80) score -= 15

  return Math.max(0, Math.min(100, score))
}

// ── Fallback ───────────────────────────────────────────
const FALLBACK = [
  { id: 'fallback-1', token: { address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', name: 'Bonk', symbol: 'BONK', logoUri: null, decimals: 5, createdAt: new Date() }, price: 0.00002847, priceChange24h: 12.4, priceChange1h: 1.2, priceChange6h: 4.1, volume24h: 48200000, volume1h: 2100000, liquidity: 12400000, marketCap: 1840000000, fdv: 1840000000, healthScore: 82, buys24h: 24821, sells24h: 18204, kolSentiment: { total: 8, holding: 6, sold: 2, holdingPercent: 75, avgEntryPrice: 0.000018, avgBagValueUsd: 24000, avgBagValueSol: 160 }, memberCount: 842, messageCount: 4201, flagCount: 0, isActive: true, createdAt: new Date(), dexUrl: 'https://dexscreener.com/solana/bonk', dexId: 'raydium' },
  { id: 'fallback-2', token: { address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', name: 'dogwifhat', symbol: 'WIF', logoUri: null, decimals: 6, createdAt: new Date() }, price: 1.24, priceChange24h: -4.2, priceChange1h: -0.8, priceChange6h: -2.1, volume24h: 82400000, volume1h: 4200000, liquidity: 28000000, marketCap: 1240000000, fdv: 1240000000, healthScore: 78, buys24h: 18420, sells24h: 14210, kolSentiment: { total: 12, holding: 8, sold: 4, holdingPercent: 67, avgEntryPrice: 0.92, avgBagValueUsd: 48000, avgBagValueSol: 320 }, memberCount: 1204, messageCount: 8420, flagCount: 0, isActive: true, createdAt: new Date(), dexUrl: 'https://dexscreener.com/solana/wif', dexId: 'raydium' },
]

// ── KOL Wallets ────────────────────────────────────────
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
server.listen(PORT, '0.0.0.0', () => console.log(`TRENCH backend running on port ${PORT}`))
