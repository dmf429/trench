const express = require('express')
const cors = require('cors')
const http = require('http')

const app = express()
const server = http.createServer(app)

app.use(cors({ origin: '*' }))
app.use(express.json())

// ── Health ────────────────────────────────────────────
app.get('/', (req, res) => res.json({ service: 'TRENCH', status: 'ok' }))
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'TRENCH backend', ts: new Date().toISOString() }))

// ── Rooms — pulls live data from DexScreener ─────────
app.get('/api/rooms', async (req, res) => {
  try {
    const { sort = 'volume', limit = '20', search = '' } = req.query

    // Fetch latest Solana memecoins from DexScreener
    const response = await fetch(
      'https://api.dexscreener.com/token-profiles/latest/v1',
      { headers: { 'Accept': 'application/json' } }
    )
    const profiles = await response.json()

    // Filter to Solana only
    let tokens = (Array.isArray(profiles) ? profiles : [])
      .filter(p => p.chainId === 'solana')
      .slice(0, 50)

    // Fetch pair data for these tokens
    if (tokens.length > 0) {
      const addresses = tokens.map(t => t.tokenAddress).slice(0, 30).join(',')
      const pairsRes = await fetch(
        `https://api.dexscreener.com/tokens/v1/solana/${addresses}`
      )
      const pairsData = await pairsRes.json()
      const pairs = pairsData.pairs ?? []

      // Build rooms from pair data
      let rooms = pairs
        .filter(p => p.baseToken && p.liquidity?.usd > 1000)
        .map((p, i) => ({
          id: p.pairAddress,
          token: {
            address: p.baseToken.address,
            name: p.baseToken.name,
            symbol: p.baseToken.symbol,
            logoUri: tokens.find(t => t.tokenAddress === p.baseToken.address)?.icon ?? null,
            decimals: 9,
            createdAt: new Date(p.pairCreatedAt ?? Date.now()),
          },
          price: parseFloat(p.priceUsd ?? '0'),
          priceChange24h: p.priceChange?.h24 ?? 0,
          volume24h: p.volume?.h24 ?? 0,
          liquidity: p.liquidity?.usd ?? 0,
          marketCap: p.marketCap ?? 0,
          healthScore: calculateHealthScore(p),
          kolSentiment: { total: 0, holding: 0, sold: 0, holdingPercent: 0, avgEntryPrice: 0, avgBagValueUsd: 0, avgBagValueSol: 0 },
          memberCount: Math.floor(Math.random() * 200) + 10,
          messageCount: Math.floor(Math.random() * 500),
          flagCount: 0,
          isActive: true,
          createdAt: new Date(p.pairCreatedAt ?? Date.now()),
          txns: p.txns,
        }))

      // Search filter
      if (search) {
        rooms = rooms.filter(r =>
          r.token.symbol.toLowerCase().includes(search.toLowerCase()) ||
          r.token.name.toLowerCase().includes(search.toLowerCase())
        )
      }

      // Sort
      if (sort === 'new') rooms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      else if (sort === 'health') rooms.sort((a, b) => b.healthScore - a.healthScore)
      else rooms.sort((a, b) => b.volume24h - a.volume24h)

      return res.json({ rooms: rooms.slice(0, parseInt(limit)), total: rooms.length })
    }

    res.json({ rooms: [], total: 0 })
  } catch (err) {
    console.error('[rooms]', err.message)
    res.json({ rooms: [], total: 0 })
  }
})

// ── Single Room ───────────────────────────────────────
app.get('/api/rooms/:id', async (req, res) => {
  try {
    const res2 = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${req.params.id}`)
    const data = await res2.json()
    const p = data.pair
    if (!p) return res.status(404).json({ error: 'Room not found' })

    res.json({
      id: p.pairAddress,
      token: {
        address: p.baseToken.address,
        name: p.baseToken.name,
        symbol: p.baseToken.symbol,
        decimals: 9,
        createdAt: new Date(p.pairCreatedAt ?? Date.now()),
      },
      price: parseFloat(p.priceUsd ?? '0'),
      priceChange24h: p.priceChange?.h24 ?? 0,
      volume24h: p.volume?.h24 ?? 0,
      liquidity: p.liquidity?.usd ?? 0,
      marketCap: p.marketCap ?? 0,
      healthScore: calculateHealthScore(p),
      kolSentiment: { total: 0, holding: 0, sold: 0, holdingPercent: 0, avgEntryPrice: 0, avgBagValueUsd: 0, avgBagValueSol: 0 },
      memberCount: 0,
      messageCount: 0,
      flagCount: 0,
      isActive: true,
      createdAt: new Date(p.pairCreatedAt ?? Date.now()),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Trending ──────────────────────────────────────────
app.get('/api/trending', async (req, res) => {
  try {
    const response = await fetch('https://api.dexscreener.com/token-boosts/top/v1')
    const data = await response.json()
    const solana = (Array.isArray(data) ? data : [])
      .filter(t => t.chainId === 'solana')
      .slice(0, 10)
    res.json({ trending: solana })
  } catch (err) {
    res.json({ trending: [] })
  }
})

// ── KOLs ─────────────────────────────────────────────
app.get('/api/kols', (req, res) => {
  res.json({ kols: KOL_WALLETS })
})

// ── Search ────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query
    if (!q) return res.json({ results: [] })
    const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`)
    const data = await response.json()
    const results = (data.pairs ?? [])
      .filter(p => p.chainId === 'solana')
      .slice(0, 10)
    res.json({ results })
  } catch (err) {
    res.json({ results: [] })
  }
})

// ── Health Score Calculator ───────────────────────────
function calculateHealthScore(pair) {
  let score = 50

  // Liquidity
  const liq = pair.liquidity?.usd ?? 0
  if (liq > 500000) score += 20
  else if (liq > 100000) score += 15
  else if (liq > 50000) score += 10
  else if (liq > 10000) score += 5
  else score -= 10

  // Volume/liquidity ratio
  const vol = pair.volume?.h24 ?? 0
  if (liq > 0 && vol / liq > 20) score -= 10 // suspicious

  // Age (newer = riskier)
  const ageHours = (Date.now() - (pair.pairCreatedAt ?? Date.now())) / 3600000
  if (ageHours < 1) score -= 15
  else if (ageHours < 24) score -= 5
  else if (ageHours > 168) score += 10

  // Price change
  const change = pair.priceChange?.h24 ?? 0
  if (change > 500) score -= 10 // pump warning
  if (change < -80) score -= 15 // dump warning

  return Math.max(0, Math.min(100, score))
}

// ── KOL Wallet List ───────────────────────────────────
const KOL_WALLETS = [
  { id: '1', address: 'GigaDegenWallet11111111111111111111111111111', displayName: 'Ansem', twitterHandle: 'blknoiz06', isVerified: true, reputationScore: 95, manipulationScore: 2, stats: { pnl24h: 14200, pnl7d: 84000, pnl30d: 420000, pnlAllTime: 2100000, winRate: 68, avgHoldTime: 12, totalTrades: 847, bestTrade: 180000, worstTrade: -12000, isStillHolding: true }, currentPositions: [], addedAt: new Date() },
  { id: '2', address: 'CobieWallet1111111111111111111111111111111111', displayName: 'Cobie', twitterHandle: 'cobie', isVerified: true, reputationScore: 91, manipulationScore: 1, stats: { pnl24h: -2400, pnl7d: 31000, pnl30d: 190000, pnlAllTime: 1400000, winRate: 72, avgHoldTime: 24, totalTrades: 412, bestTrade: 220000, worstTrade: -18000, isStillHolding: false }, currentPositions: [], addedAt: new Date() },
  { id: '3', address: 'MustardWallet111111111111111111111111111111111', displayName: 'Murad', twitterHandle: 'MustStopMurad', isVerified: true, reputationScore: 88, manipulationScore: 3, stats: { pnl24h: 8900, pnl7d: 54000, pnl30d: 280000, pnlAllTime: 980000, winRate: 61, avgHoldTime: 48, totalTrades: 223, bestTrade: 150000, worstTrade: -22000, isStillHolding: true }, currentPositions: [], addedAt: new Date() },
  { id: '4', address: 'NaomiWallet1111111111111111111111111111111111', displayName: 'Naomi', twitterHandle: 'naomibrockwell', isVerified: true, reputationScore: 82, manipulationScore: 1, stats: { pnl24h: 3200, pnl7d: 19000, pnl30d: 88000, pnlAllTime: 440000, winRate: 58, avgHoldTime: 36, totalTrades: 318, bestTrade: 92000, worstTrade: -8000, isStillHolding: true }, currentPositions: [], addedAt: new Date() },
  { id: '5', address: 'KookieMonsWallet111111111111111111111111111111', displayName: 'KookiesMons', twitterHandle: 'KookiesMons', isVerified: true, reputationScore: 79, manipulationScore: 5, stats: { pnl24h: -1200, pnl7d: 8400, pnl30d: 62000, pnlAllTime: 310000, winRate: 55, avgHoldTime: 8, totalTrades: 1204, bestTrade: 78000, worstTrade: -14000, isStillHolding: false }, currentPositions: [], addedAt: new Date() },
]

const PORT = parseInt(process.env.PORT) || 3000
server.listen(PORT, '0.0.0.0', () => console.log(`TRENCH backend running on port ${PORT}`))
