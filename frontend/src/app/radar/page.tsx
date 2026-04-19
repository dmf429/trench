// @ts-nocheck
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Nav from '../../components/Nav'
import * as web3 from '@solana/web3.js'

// ── Constants ───────────────────────────────────────────────────────────
const BACKEND = 'https://trench-production-cd7b.up.railway.app'
const HELIUS_KEY = '870dfde6-09ec-48bd-95b8-202303d15c5b'
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
const DEVNET_RPC = 'https://api.devnet.solana.com'
const MOBULA_WS = 'wss://api.mobula.io'
const MOBULA_KEY = '0c618a08-8d56-430f-a814-80ab2142fe7f'
const BULLX_WS = 'wss://stream.bullx.io/app/prowess-frail-sensitive?protocol=7&client=js&version=8.4.0-rc2&flash=false'
const BULLX_CHANNEL = 'new-pairsv2-1399811149'
let cachedSolPrice = 150

// ── Exact Axiom Color Palette ────────────────────────────────────────────
const C = {
  bg:      '#06070b',   // body background
  bg2:     '#0c0c10',   // card background  
  bg3:     '#1a1b23',   // border / divider
  bg4:     '#22242d',   // hover state
  bg5:     '#12131a',   // column header bg
  text1:   '#fcfcfc',   // primary text
  text2:   '#6b6b7a',   // secondary text
  text3:   '#d4d4d8',   // tertiary text
  accent:  '#526fff',   // blue accent / buy button
  green:   '#16a34a',   // price up / green
  green2:  '#14f195',   // Solana green dot
  red:     '#ef4444',   // price down / red
  yellow:  '#eab308',   // warning / bonding
  orange:  '#f97316',   // orange
  purple:  '#a855f7',   // insiders
  border:  '#1a1b23',   // standard border
  border2: '#2a2a38',   // stronger border
}

// ── Formatters (exact Axiom style) ──────────────────────────────────────
const fmt = (n) => {
  if (!n || n === 0) return '$0'
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n/1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}
const fmtV = (n) => { // volume without $ for V label
  if (!n || n === 0) return '$0'
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n/1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}
const fmtC = (n) => {
  if (!n) return '0'
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n/1e3).toFixed(1)}K`
  return `${Math.round(n)}`
}
const fmtSol = (n) => !n ? '0◎' : n < 0.001 ? `${n.toFixed(6)}◎` : n < 1 ? `${n.toFixed(4)}◎` : `${n.toFixed(3)}◎`
const elapsed = (ts) => {
  if (!ts) return '?'
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 2) return 'just now'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s/60)}m`
  if (s < 86400) return `${Math.floor(s/3600)}h`
  return `${Math.floor(s/86400)}d`
}
const tr = (a, n = 4) => a ? `${a.slice(0,n)}...${a.slice(-n)}` : ''
const getMcColor = (mc) => mc > 2e6 ? C.green : mc > 1e6 ? C.yellow : C.accent
const holderPct = (count, total) => (!count || !total) ? 0 : Math.min(Math.round((count/total)*100), 100)

const COLORS = ['#f43f5e','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899','#6366f1','#14b8a6','#84cc16','#fb923c']
const tokenColor = (addr) => COLORS[Math.abs((addr?.charCodeAt(0)||0)+(addr?.charCodeAt(1)||0))%COLORS.length]

// ── Data fetching ────────────────────────────────────────────────────────
async function fetchSolPrice() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
    const d = await r.json()
    cachedSolPrice = d?.solana?.usd ?? 150
  } catch {}
  return cachedSolPrice
}

function pairToToken(p, stage) {
  const mcap = p.marketCap ?? p.fdv ?? 0
  const addr = p.baseToken?.address ?? ''
  const bc = p.dexId === 'pumpfun' ? Math.min(99, Math.round((mcap / 69000) * 100)) : 100
  return {
    id: p.pairAddress, symbol: p.baseToken?.symbol ?? '???', name: p.baseToken?.name ?? 'Unknown',
    address: addr, pairAddress: p.pairAddress, color: tokenColor(addr),
    price: parseFloat(p.priceUsd ?? '0'), marketCap: mcap, liquidity: p.liquidity?.usd ?? 0,
    volume5m: p.volume?.m5 ?? 0, volume1h: p.volume?.h1 ?? 0,
    priceChange5m: p.priceChange?.m5 ?? 0, priceChange1h: p.priceChange?.h1 ?? 0,
    buys5m: p.txns?.m5?.buys ?? 0, sells5m: p.txns?.m5?.sells ?? 0,
    buys1h: p.txns?.h1?.buys ?? 0, sells1h: p.txns?.h1?.sells ?? 0,
    age: Date.now() - (p.pairCreatedAt ?? Date.now()), bondingCurve: bc,
    holders: 0, stage, logoUri: p.info?.imageUrl ?? null, dexId: p.dexId,
    website: p.info?.websites?.[0]?.url ?? null,
    twitter: p.info?.socials?.find(s => s.type === 'twitter')?.url ?? null,
    telegram: p.info?.socials?.find(s => s.type === 'telegram')?.url ?? null,
    pairCreatedAt: p.pairCreatedAt, source: 'dexscreener',
    smartTraders: 0, snipers: 0, insiders: 0, freshTraders: 0,
  }
}

async function dexSearch(q) {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`)
    return (await r.json()).pairs ?? []
  } catch { return [] }
}

async function loadPairs() {
  const [r1,r2,r3,r4,r5] = await Promise.all([
    dexSearch('pumpfun'), dexSearch('pump sol'), dexSearch('solana pump new'),
    dexSearch('pumpswap'), dexSearch('solana meme')
  ])
  const all = [...r1,...r2,...r3,...r4,...r5].filter(p => p.chainId === 'solana')
  all.sort((a,b) => (b.pairCreatedAt??0) - (a.pairCreatedAt??0))
  const seenP = new Set(), seenA = new Set(), newP = [], stretchP = [], migratedP = []
  for (const p of all) {
    if (seenP.has(p.pairAddress)) continue
    seenP.add(p.pairAddress)
    const mcap = p.marketCap ?? p.fdv ?? 0, dex = p.dexId
    if (dex === 'pumpfun') {
      const addr = p.baseToken?.address
      if (addr && seenA.has(addr)) continue
      if (addr) seenA.add(addr)
      if (mcap >= 55000) stretchP.push(pairToToken(p, 'stretch'))
      else if (mcap > 0) newP.push(pairToToken(p, 'new'))
    } else if (['pumpswap','raydium','meteora','orca'].includes(dex)) {
      if ((p.liquidity?.usd ?? 0) < 500) continue
      migratedP.push(pairToToken(p, 'migrated'))
    }
  }
  return { newP: newP.slice(0,20), stretchP: stretchP.slice(0,20), migratedP: migratedP.slice(0,20) }
}

async function fetchPumpTrades(mint, mcap) {
  try {
    const r = await fetch(`${BACKEND}/api/pump/trades/${mint}`)
    const data = await r.json()
    if (Array.isArray(data) && data.length > 0) {
      const now = Date.now() / 1000
      return data.slice(0, 30).map((t, i) => ({
        id: i, sig: t.signature ?? '',
        age: Math.floor(now - (t.timestamp ?? now)),
        type: t.is_buy ? 'Buy' : 'Sell', isBuy: !!t.is_buy,
        mc: mcap,
        solAmount: ((t.sol_amount ?? 0) / 1e9).toFixed(4),
        usdValue: (((t.sol_amount ?? 0) / 1e9) * cachedSolPrice).toFixed(2),
        wallet: t.user ?? t.traderPublicKey ?? '', source: 'pump.fun'
      }))
    }
  } catch {}
  // Helius fallback
  try {
    const r = await fetch(`https://api.helius.xyz/v0/addresses/${mint}/transactions?api-key=${HELIUS_KEY}&limit=25&type=SWAP`)
    const txns = await r.json()
    if (!Array.isArray(txns)) return []
    const now = Date.now() / 1000
    return txns.slice(0,20).map((t,i) => {
      const xfers = t.tokenTransfers??[], nx = t.nativeTransfers??[]
      const tx = xfers.find(x => x.mint === mint)
      const isBuy = tx ? tx.toUserAccount === t.feePayer : true
      const sol = (nx.reduce((m,x) => x.amount > m.amount ? x : m, {amount:0}).amount) / 1e9
      const age = Math.floor(now - (t.timestamp ?? now))
      return { id: i, sig: t.signature, age, type: isBuy?'Buy':'Sell', isBuy, mc: mcap, solAmount: sol.toFixed(4), usdValue: (sol*cachedSolPrice).toFixed(2), wallet: t.feePayer??'', source: t.source??'' }
    })
  } catch { return [] }
}

async function fetchHolders(mint) {
  try {
    const res = await fetch(HELIUS_RPC, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({jsonrpc:'2.0',id:1,method:'getTokenAccounts',params:{mint,limit:1000}}) })
    const data = await res.json()
    const accounts = (data?.result?.token_accounts ?? []).filter(a => parseFloat(a.amount) > 0)
    const total = accounts.reduce((s,a) => s + parseFloat(a.amount), 0)
    return {
      count: accounts.length,
      holders: accounts.slice(0,15).map((acc,i) => ({
        rank: i+1, wallet: acc.address,
        pct: ((parseFloat(acc.amount)/total)*100).toFixed(2),
        tokens: parseFloat(acc.amount), type: i===0?'LP':''
      }))
    }
  } catch { return { count: 0, holders: [] } }
}

async function fetchTopTraders(mint) {
  try {
    const r = await fetch(`${BACKEND}/api/axiom/top-traders/${mint}`)
    const data = await r.json()
    if (Array.isArray(data) && data.length > 0) {
      return data.slice(0,10).map((t,i) => ({
        rank: i+1, wallet: t[0]??'', buys: t[1]??0, sells: t[2]??0,
        solSpent: parseFloat(t[5])||0, solReceived: parseFloat(t[6])||0,
        pnlSol: (parseFloat(t[6])||0) - (parseFloat(t[5])||0),
        isProfitable: (t[6]||0) > (t[5]||0)
      }))
    }
  } catch {}
  return []
}

async function fetchAxiomTokenInfo(pairAddress) {
  try {
    const r = await fetch(`${BACKEND}/api/axiom/token-info/${pairAddress}`)
    if (!r.ok) return null
    const d = await r.json()
    if (d.error) return null
    return {
      numHolders: d.numHolders||0,
      top10: d.top10HoldersPercent||0,
      dev: d.devHoldsPercent||0,
      insiders: d.insidersHoldPercent||0,
      bundlers: d.bundlersHoldPercent||0,
      snipers: d.snipersHoldPercent||0,
      dexPaid: d.dexPaid||false,
      fees: d.totalPairFeesPaid||0,
    }
  } catch { return null }
}

// ── Main Component ───────────────────────────────────────────────────────
export default function RadarPage() {
  const [newPairs, setNewPairs] = useState([])
  const [stretch, setStretch] = useState([])
  const [migrated, setMigrated] = useState([])
  const [selected, setSelected] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [solPrice, setSolPrice] = useState(150)
  const [buyAmount, setBuyAmount] = useState('0.1')
  const [positions, setPositions] = useState([])
  const [txStatus, setTxStatus] = useState(null)
  const [txMsg, setTxMsg] = useState('')
  const [bottomTab, setBottomTab] = useState('trades')
  const [sideTab, setSideTab] = useState('buy')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [loading, setLoading] = useState(true)
  const [holders, setHolders] = useState([])
  const [trades, setTrades] = useState([])
  const [topTraders, setTopTraders] = useState([])
  const [tokenInfo, setTokenInfo] = useState(null)
  const [pnlInSol, setPnlInSol] = useState(true)
  const [chartTf, setChartTf] = useState('1')
  const [chartSource, setChartSource] = useState('loading')
  const [liveConns, setLiveConns] = useState(0)
  const [panelHeight, setPanelHeight] = useState(240)
  const [flashMap, setFlashMap] = useState({})
  const [filterPreset, setFilterPreset] = useState(null) // null | {id,min,max}
  const [presetTab, setPresetTab] = useState(null) // which column preset is active per col
  const [bubbleView, setBubbleView] = useState(0)
  const chartRef = useRef(null)
  const mobulaTradeWs = useRef(null)
  const mobulaOhlcvWs = useRef(null)
  const [liveTradesActive, setLiveTradesActive] = useState(false)
  const chartInstance = useRef(null)
  const candleSeries = useRef(null)
  const searchTimeout = useRef(null)
  const conn = useRef(new web3.Connection(DEVNET_RPC, 'confirmed'))

  // SOL price
  useEffect(() => {
    fetchSolPrice().then(p => setSolPrice(p))
    const iv = setInterval(() => fetchSolPrice().then(p => setSolPrice(p)), 30000)
    return () => clearInterval(iv)
  }, [])

  // Wallet
  useEffect(() => {
    const saved = localStorage.getItem('trench_radar_wallet')
    if (!saved) return
    const data = JSON.parse(saved)
    setWallet(data)
    conn.current.getBalance(new web3.PublicKey(data.publicKey))
      .then(b => setWallet(w => w ? {...w, balance: b / web3.LAMPORTS_PER_SOL} : null))
      .catch(() => {})
  }, [])

  // Pump.fun WebSocket
  useEffect(() => {
    let ws, rt
    const connect = () => {
      try {
        ws = new WebSocket('wss://pumpportal.fun/api/data')
        ws.onopen = () => {
          setLiveConns(n => n + 1)
          ws.send(JSON.stringify({method:'subscribeNewToken'}))
          ws.send(JSON.stringify({method:'subscribeMigration'}))
        }
        ws.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data)
            if (d.txType === 'create' && d.mint) {
              const t = {
                id: d.mint, symbol: d.symbol||'???', name: d.name||'New Token',
                address: d.mint, pairAddress: d.mint, color: tokenColor(d.mint),
                price: 0, marketCap: (d.marketCapSol||0)*cachedSolPrice, liquidity: 0,
                volume5m:0, volume1h:0, priceChange5m:0, priceChange1h:0,
                buys5m:0, sells5m:0, buys1h:0, sells1h:0,
                age:0, bondingCurve:0, holders:0, stage:'new',
                logoUri: d.image||null, dexId:'pumpfun',
                website:d.website||null, twitter:d.twitter||null, telegram:d.telegram||null,
                pairCreatedAt: Date.now(), source:'pumpportal',
                smartTraders:0, snipers:0, insiders:0, freshTraders:0,
              }
              setNewPairs(prev => [t, ...prev.filter(x => x.id !== d.mint)].slice(0,20))
            } else if (d.txType === 'migrate' && d.mint) {
              setNewPairs(prev => prev.filter(t => t.address !== d.mint))
              setStretch(prev => prev.filter(t => t.address !== d.mint))
            }
          } catch {}
        }
        ws.onclose = () => { setLiveConns(n => Math.max(0, n-1)); rt = setTimeout(connect, 3000) }
        ws.onerror = () => ws.close()
      } catch {}
    }
    connect()
    return () => { clearTimeout(rt); if (ws) ws.close() }
  }, [])

  // Mobula WebSocket
  useEffect(() => {
    let ws, rt, ping
    const v2s = {new:'new', bonding:'stretch', bonded:'migrated'}
    const xform = (data, view) => {
      const t = data.token||{}, mcap = data.market_cap||data.latest_market_cap||t.marketCap||0, addr = t.address||''
      return {
        id: addr, symbol: t.symbol||'???', name: t.name||'Unknown',
        address: addr, pairAddress: addr, color: tokenColor(addr),
        price: data.latest_price||t.price||0, marketCap: mcap, liquidity: t.liquidity||0,
        volume5m: data.volume_5min||0, volume1h: data.volume_1h||0,
        priceChange5m: data.price_change_5min||0, priceChange1h: data.price_change_1h||0,
        buys5m: data.trades_5min||0, sells5m: 0,
        buys1h: data.buys_1h||0, sells1h: data.sells_1h||0,
        age: data.created_at ? Date.now()-new Date(data.created_at).getTime() : 0,
        bondingCurve: t.bondingPercentage||(t.bonded?100:Math.min(99,Math.round((mcap/69000)*100))),
        holders: t.holdersCount||0, stage: v2s[view]||'new',
        logoUri: t.logo||null, dexId: v2s[view]==='migrated'?'pumpswap':'pumpfun',
        website: data.socials?.website||null, twitter: data.socials?.twitter||null, telegram: data.socials?.telegram||null,
        pairCreatedAt: data.created_at?new Date(data.created_at).getTime():Date.now(),
        smartTraders: t.smartTradersCount||0, snipers: t.snipersCount||0,
        insiders: t.insidersCount||0, freshTraders: t.freshTradersCount||0,
        source: 'mobula'
      }
    }
    const connect = () => {
      try {
        ws = new WebSocket(MOBULA_WS)
        ws.onopen = () => {
          setLiveConns(n => n+1)
          ws.send(JSON.stringify({type:'pulse-v2', authorization: MOBULA_KEY, payload:{model:'default',assetMode:true,chainId:['solana:solana'],poolTypes:['pumpfun'],compressed:false}}))
          ping = setInterval(() => { if (ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({event:'ping'})) }, 15000)
        }
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.event === 'pong') return
            if (msg.type === 'init') {
              for (const [vn,vd] of Object.entries(msg.payload||{})) {
                if (!vd?.data) continue
                const stage = v2s[vn]; if (!stage) continue
                const tokens = vd.data.map(d => xform(d,vn)).filter(t => t.address)
                if (stage==='new') setNewPairs(prev => { const s=new Set(prev.map(t=>t.id)); return [...tokens.filter(t=>!s.has(t.id)),...prev].slice(0,20) })
                else if (stage==='stretch') setStretch(prev => { const s=new Set(prev.map(t=>t.id)); return [...tokens.filter(t=>!s.has(t.id)),...prev].slice(0,20) })
                else setMigrated(prev => { const s=new Set(prev.map(t=>t.id)); return [...tokens.filter(t=>!s.has(t.id)),...prev].slice(0,20) })
              }
              setLoading(false)
            } else if (msg.type === 'new-token') {
              const {viewName,token:td} = msg.payload||{}; if (!td) return
              const t = xform(td,viewName); if (!t.address) return
              const stage = v2s[viewName]
              if (stage==='new') setNewPairs(prev => [t,...prev.filter(x=>x.id!==t.id)].slice(0,20))
              else if (stage==='stretch') setStretch(prev => [t,...prev.filter(x=>x.id!==t.id)].slice(0,20))
              else setMigrated(prev => [t,...prev.filter(x=>x.id!==t.id)].slice(0,20))
            } else if (msg.type==='update-token'||msg.type==='update') {
              const updates = msg.type==='update-token'
                ? [{viewName:msg.payload?.viewName,data:msg.payload?.token}]
                : Object.entries(msg.payload||{}).flatMap(([vn,vd]) => (vd.data||[]).map(d=>({viewName:vn,data:d})))
              updates.forEach(({viewName,data}) => {
                if (!data) return
                const t = xform(data,viewName); if (!t.address) return
                const stage = v2s[viewName]
                const upd = prev => prev.map(x => x.id===t.id ? {...x,...t} : x)
                if (stage==='new') setNewPairs(upd)
                else if (stage==='stretch') setStretch(upd)
                else setMigrated(upd)
                setSelected(s => s?.id===t.id ? {...s,...t} : s)
                // Price flash
                if (data.price_change_5min !== 0) {
                  setFlashMap(f => ({...f,[t.id]:(data.price_change_5min||0)>0?'up':'down'}))
                  setTimeout(() => setFlashMap(f => {const n={...f};delete n[t.id];return n}), 800)
                }
              })
            } else if (msg.type==='remove-token') {
              const addr = msg.payload?.token?.token?.address; if (!addr) return
              setNewPairs(prev => prev.filter(t => t.id!==addr))
              setStretch(prev => prev.filter(t => t.id!==addr))
            }
          } catch {}
        }
        ws.onclose = () => { setLiveConns(n=>Math.max(0,n-1)); clearInterval(ping); rt=setTimeout(connect,2000) }
        ws.onerror = () => ws.close()
      } catch {}
    }
    connect()
    return () => { clearTimeout(rt); clearInterval(ping); if (ws) ws.close() }
  }, [])

  // DexScreener fallback
  const refreshPairs = useCallback(async () => {
    const {newP,stretchP,migratedP} = await loadPairs()
    setNewPairs(prev => { const s=new Set(prev.map(t=>t.id)); return [...prev,...newP.filter(t=>!s.has(t.id))].slice(0,20) })
    setStretch(prev => { const s=new Set(prev.map(t=>t.id)); return [...prev,...stretchP.filter(t=>!s.has(t.id))].slice(0,20) })
    setMigrated(prev => { const s=new Set(prev.map(t=>t.id)); return [...prev,...migratedP.filter(t=>!s.has(t.id))].slice(0,20) })
    setLoading(false)
  }, [])
  useEffect(() => { refreshPairs(); const iv=setInterval(refreshPairs,20000); return()=>clearInterval(iv) }, [refreshPairs])

  // Live price updates
  useEffect(() => {
    if (!selected) return
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${selected.pairAddress}`)
        const d = await r.json(); const p = d.pair; if (!p) return
        setSelected(s => s ? {...s, price:parseFloat(p.priceUsd??'0'), marketCap:p.marketCap??p.fdv??s.marketCap, liquidity:p.liquidity?.usd??s.liquidity, volume1h:p.volume?.h1??s.volume1h, buys1h:p.txns?.h1?.buys??s.buys1h, sells1h:p.txns?.h1?.sells??s.sells1h} : null)
      } catch {}
    }, 5000)
    return () => clearInterval(iv)
  }, [selected?.pairAddress])

  // Chart via backend (pump.fun → GeckoTerminal)
  useEffect(() => {
    if (!selected || !chartRef.current) return
    let cancelled = false
    setChartSource('loading')
    const init = async () => {
      if (!window.LightweightCharts) {
        await new Promise((res,rej) => {
          const s = document.createElement('script')
          s.src = 'https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js'
          s.onload = res; s.onerror = rej; document.head.appendChild(s)
        })
      }
      if (cancelled || !chartRef.current) return
      if (chartInstance.current) { try{chartInstance.current.remove()}catch{}; chartInstance.current=null; candleSeries.current=null }
      const chart = window.LightweightCharts.createChart(chartRef.current, {
        layout: {background:{color:C.bg}, textColor:C.text2},
        grid: {vertLines:{color:C.bg3}, horzLines:{color:C.bg3}},
        crosshair: {mode:1},
        rightPriceScale: {borderColor:C.bg3, textColor:C.text2, minimumWidth:70},
        timeScale: {borderColor:C.bg3, timeVisible:true, secondsVisible:true, barSpacing:6},
        width: chartRef.current.clientWidth,
        height: chartRef.current.clientHeight,
      })
      chartInstance.current = chart
      const cs = chart.addCandlestickSeries({
        upColor: C.green, downColor: C.red,
        borderUpColor: C.green, borderDownColor: C.red,
        wickUpColor: C.green, wickDownColor: C.red,
      })
      candleSeries.current = cs
      const fetchCandles = async () => {
        const r = await fetch(`${BACKEND}/api/pump/candles/${selected.address}?tf=${chartTf}&limit=300`)
        const d = await r.json()
        return {candles: d.candles||[], source: d.source||'none'}
      }
      const {candles, source} = await fetchCandles()
      if (cancelled) return
      if (candles.length > 0) {
        const seen = new Set()
        const unique = candles.filter(c => { if(seen.has(c.time)) return false; seen.add(c.time); return true }).sort((a,b) => a.time-b.time)
        cs.setData(unique)
        chart.timeScale().fitContent()
        setChartSource(source)
      } else {
        setChartSource('none')
      }
      const ro = new ResizeObserver(() => {
        if (chartRef.current && chartInstance.current) chartInstance.current.applyOptions({width:chartRef.current.clientWidth, height:chartRef.current.clientHeight})
      })
      ro.observe(chartRef.current)
      const iv = setInterval(async () => {
        if (cancelled || !candleSeries.current) return
        try {
          const {candles:fresh} = await fetchCandles()
          if (fresh.length > 0 && candleSeries.current) try{candleSeries.current.update(fresh[fresh.length-1])}catch{}
        } catch {}
      }, 3000)
      return () => { ro.disconnect(); clearInterval(iv) }
    }
    init()
    return () => {
      cancelled = true
      if (chartInstance.current) { try{chartInstance.current.remove()}catch{}; chartInstance.current=null; candleSeries.current=null }
    }
  }, [selected?.id, chartTf])

  // Trades + holders + top traders + token info
  useEffect(() => {
    if (!selected?.address) return
    let cancelled = false
    const load = async () => {
      const [tData,hData,trData,tiData] = await Promise.allSettled([
        fetchPumpTrades(selected.address, selected.marketCap),
        fetchHolders(selected.address),
        fetchTopTraders(selected.address),
        fetchAxiomTokenInfo(selected.address),
      ])
      if (cancelled) return
      if (tData.status==='fulfilled' && tData.value.length>0) setTrades(tData.value)
      if (hData.status==='fulfilled' && hData.value.count>0) { setHolders(hData.value.holders); setSelected(s=>s?{...s,holders:hData.value.count}:null) }
      if (trData.status==='fulfilled') setTopTraders(trData.value)
      if (tiData.status==='fulfilled' && tiData.value) setTokenInfo(tiData.value)
    }
    load()
    const iv = setInterval(() => {
      if (!cancelled) fetchPumpTrades(selected.address, selected.marketCap).then(t => { if (!cancelled && t.length>0) setTrades(t) })
    }, 5000)
    return () => { cancelled=true; clearInterval(iv) }
  }, [selected?.id])

  // Search
  useEffect(() => {
    clearTimeout(searchTimeout.current)
    if (searchQuery.length >= 2) {
      searchTimeout.current = setTimeout(async () => {
        setSearching(true)
        try {
          const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(searchQuery)}`)
          const d = await r.json()
          setSearchResults((d.pairs??[]).filter(p=>p.chainId==='solana').slice(0,8))
        } catch { setSearchResults([]) }
        setSearching(false)
      }, 200)
    } else { setSearchResults([]) }
  }, [searchQuery])

  // Subscribe to Mobula fast-trade and ohlcv for selected token
  useEffect(() => {
    if (!selected?.address) return
    let cancelled = false

    // Close existing trade WS
    if (mobulaTradeWs.current) { try{mobulaTradeWs.current.close()}catch{} }
    if (mobulaOhlcvWs.current) { try{mobulaOhlcvWs.current.close()}catch{} }

    // ── Fast-Trade WebSocket ─────────────────────────────────────────
    const tradeWs = new WebSocket(MOBULA_WS)
    mobulaTradeWs.current = tradeWs
    tradeWs.onopen = () => {
      tradeWs.send(JSON.stringify({
        type: 'fast-trade',
        authorization: MOBULA_KEY,
        payload: {
          assetMode: true,
          filterOutliers: true,
          items: [{ blockchain: 'solana', address: selected.address }],
          subscriptionTracking: true
        }
      }))
    }
    tradeWs.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)
        if (d.type !== 'fast-trade') return
        const isBuy = d.type_trade === 'buy' || d.trade_type === 'buy' || (d.type && d.type.toLowerCase() === 'buy')
        const trade = {
          id: d.hash || Math.random().toString(36),
          sig: d.hash || '',
          age: 0, // just now
          type: isBuy ? 'Buy' : 'Sell',
          isBuy,
          mc: d.tokenMarketCapUSD || 0,
          solAmount: (d.tokenNativePrice * d.tokenAmount || 0).toFixed(4),
          usdValue: (d.tokenAmountUsd || 0).toFixed(2),
          wallet: d.sender || '',
          source: d.platform || 'mobula',
          labels: d.labels || [],
          platform: d.platform,
          platformMeta: d.platformMetadata,
          walletMeta: d.walletMetadata,
          fees: d.totalFeesUSD || 0,
        }
        if (!cancelled) setTrades(prev => [trade, ...prev].slice(0, 50))
      } catch {}
    }
    tradeWs.onerror = () => {}
    tradeWs.onclose = () => {}

    // ── OHLCV WebSocket — live candles ───────────────────────────────
    const ohlcvWs = new WebSocket(MOBULA_WS)
    mobulaOhlcvWs.current = ohlcvWs
    ohlcvWs.onopen = () => {
      ohlcvWs.send(JSON.stringify({
        type: 'ohlcv',
        authorization: MOBULA_KEY,
        payload: {
          asset: selected.address,
          chainId: 'solana:solana',
          period: chartTf === '1' ? '1m' : chartTf === '5' ? '5m' : chartTf === '15' ? '15m' : chartTf === '60' ? '1h' : '4h',
          subscriptionTracking: true,
          maxUpdatesPerMinute: 60
        }
      }))
      setChartSource('mobula-live')
    }
    ohlcvWs.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)
        if (d.type !== 'ohlcv' || !d.open) return
        if (!cancelled && candleSeries.current) {
          try {
            candleSeries.current.update({
              time: Math.floor(d.time / 1000),
              open: d.open, high: d.high, low: d.low, close: d.close
            })
          } catch {}
        }
      } catch {}
    }
    ohlcvWs.onerror = () => {}
    ohlcvWs.onclose = () => {}

    // Ping both every 30s
    const ping = setInterval(() => {
      if (tradeWs.readyState === WebSocket.OPEN) tradeWs.send(JSON.stringify({event:'ping'}))
      if (ohlcvWs.readyState === WebSocket.OPEN) ohlcvWs.send(JSON.stringify({event:'ping'}))
    }, 30000)

    return () => {
      cancelled = true
      clearInterval(ping)
      try{tradeWs.close()}catch{}
      try{ohlcvWs.close()}catch{}
    }
  }, [selected?.id, chartTf])

  const selectToken = (token) => {
    setSelected(token); setSideTab('buy'); setBottomTab('trades')
    setShowSearch(false); setSearchQuery(''); setTokenInfo(null)
    setTrades([]); setHolders([]); setTopTraders([])
  }

  const generateWallet = async () => {
    const kp = web3.Keypair.generate()
    const ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    function b58(bytes){let d=[0];for(let i=0;i<bytes.length;i++){let c=bytes[i];for(let j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=(c/58)|0}while(c>0){d.push(c%58);c=(c/58)|0}}let r='';for(let i=0;i<bytes.length&&bytes[i]===0;i++)r+='1';for(let i=d.length-1;i>=0;i--)r+=ALPHA[d[i]];return r}
    const data = {publicKey:kp.publicKey.toString(),secretKey:Array.from(kp.secretKey),privateKeyBase58:b58(kp.secretKey),balance:0,network:'devnet'}
    localStorage.setItem('trench_radar_wallet', JSON.stringify(data))
    setWallet(data)
  }

  const airdrop = async () => {
    if (!wallet) return
    setTxStatus('pending'); setTxMsg('REQUESTING AIRDROP...')
    for (const rpc of ['https://api.devnet.solana.com','https://rpc.ankr.com/solana_devnet']) {
      try {
        const c = new web3.Connection(rpc, {commitment:'confirmed'})
        const pk = new web3.PublicKey(wallet.publicKey)
        await c.requestAirdrop(pk, 2*web3.LAMPORTS_PER_SOL)
        setTxMsg('CONFIRMING...')
        for (let i=0;i<20;i++) {
          await new Promise(r=>setTimeout(r,1500))
          const bal = await c.getBalance(pk).catch(()=>0)
          if (bal > 0) { setWallet(w=>({...w,balance:bal/web3.LAMPORTS_PER_SOL})); setTxStatus('success'); setTxMsg('2 SOL AIRDROPPED!'); setTimeout(()=>{setTxStatus(null);setTxMsg('')},3000); return }
        }
        break
      } catch {}
    }
    setTxStatus('error'); setTxMsg('USE faucet.solana.com'); setTimeout(()=>{setTxStatus(null);setTxMsg('')},5000)
  }

  const buy = async () => {
    if (!wallet||!selected) return
    const amt = parseFloat(buyAmount)
    if (isNaN(amt)||amt<=0||amt>(wallet.balance||0)) { setTxStatus('error'); setTxMsg('INSUFFICIENT SOL'); setTimeout(()=>{setTxStatus(null);setTxMsg('')},2000); return }
    setTxStatus('pending'); setTxMsg('SIMULATING...')
    await new Promise(r=>setTimeout(r,800))
    const tokens = (amt / Math.max(selected.price,1e-12)) * 0.97
    setPositions(prev => [{id:Math.random().toString(36).slice(2),token:{...selected},entryPrice:selected.price,tokensHeld:tokens,solSpent:amt,usdSpent:amt*solPrice,currentPrice:selected.price},...prev])
    setWallet(w=>({...w,balance:(w.balance||0)-amt}))
    setTxStatus('success'); setTxMsg(`BOUGHT ${tokens.toExponential(2)} ${selected.symbol}`)
    setSideTab('sell'); setTimeout(()=>{setTxStatus(null);setTxMsg('')},3000)
  }

  useEffect(() => {
    if (!selected) return
    setPositions(prev => prev.map(pos => {
      if (pos.token.id!==selected.id) return pos
      const curVal=pos.tokensHeld*selected.price, pnlUsd=curVal-pos.usdSpent, pnlSol=pnlUsd/solPrice
      return {...pos,currentPrice:selected.price,pnlUsd,pnlSol,pnlPct:pos.usdSpent>0?(pnlUsd/pos.usdSpent)*100:0}
    }))
  }, [selected?.price, solPrice])

  const sellPosition = (posId, pct=100) => {
    const pos = positions.find(p=>p.id===posId); if (!pos) return
    const frac = pct/100, sol = (pos.tokensHeld*frac*pos.currentPrice)/solPrice*0.97
    setWallet(w=>({...w,balance:(w.balance||0)+sol}))
    if (pct===100) setPositions(prev=>prev.filter(p=>p.id!==posId))
    else setPositions(prev=>prev.map(p=>p.id===posId?{...p,tokensHeld:p.tokensHeld*(1-frac),solSpent:p.solSpent*(1-frac),usdSpent:p.usdSpent*(1-frac)}:p))
  }

  const pos = positions.find(p => p.token.id===selected?.id)
  const posPnlUsd = pos?.pnlUsd||0, posPnlSol = pos?.pnlSol||0, posPnlPct = pos?.pnlPct||0

  // ── Token Card — exact Axiom layout ─────────────────────────────────
  const TokenCard = ({token}) => {
    const isSel = selected?.id === token.id
    const flash = flashMap[token.id]
    const netChange = token.priceChange1h ?? token.priceChange5m ?? 0
    const buys = token.buys1h||token.buys5m||0
    const sells = token.sells1h||token.sells5m||0
    const txTotal = buys+sells||1
    const greenPct = Math.round((buys/txTotal)*100)
    const totalHolders = token.holders||0
    const smartPct = holderPct(token.smartTraders, totalHolders)
    const sniperPct = holderPct(token.snipers, totalHolders)
    const insiderPct = holderPct(token.insiders, totalHolders)
    const freshPct = holderPct(token.freshTraders, totalHolders)
    const regularPct = totalHolders>0 ? Math.max(0, 100-smartPct-sniperPct-insiderPct-freshPct) : 100
    const mcColor = getMcColor(token.marketCap)
    const bgColor = flash==='up' ? 'rgba(22,163,74,0.08)' : flash==='down' ? 'rgba(239,68,68,0.08)' : isSel ? `${C.accent}11` : 'transparent'

    return (
      <div
        onClick={() => selectToken(token)}
        style={{background:bgColor, borderBottom:`1px solid ${C.bg3}`, padding:'8px 14px', cursor:'pointer', transition:'background 0.15s', borderLeft:`2px solid ${isSel?C.accent:'transparent'}`}}
        onMouseEnter={e => { if(!flash) e.currentTarget.style.background = isSel ? `${C.accent}11` : C.bg4 }}
        onMouseLeave={e => { e.currentTarget.style.background = bgColor }}
      >
        {/* Row 1: Avatar + Name/Symbol + MC/Vol */}
        <div style={{display:'flex', alignItems:'flex-start', gap:'10px', marginBottom:'5px'}}>
          {/* Avatar with exchange badge */}
          <div style={{position:'relative', flexShrink:0}}>
            {token.logoUri ? (
              <img src={token.logoUri} alt="" style={{width:'44px',height:'44px',borderRadius:'8px',objectFit:'cover',display:'block'}} onError={e=>e.target.style.display='none'}/>
            ) : (
              <div style={{width:'44px',height:'44px',borderRadius:'8px',background:token.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:'bold',color:'#fff'}}>{token.symbol[0]}</div>
            )}
            {/* Pump badge */}
            <div style={{position:'absolute',bottom:'-4px',right:'-4px',width:'16px',height:'16px',borderRadius:'50%',background:'#1a1b23',border:`1.5px solid ${C.bg3}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div style={{width:'8px',height:'8px',borderRadius:'50%',background:token.dexId==='pumpfun'?'#00ff88':'#526fff'}}/>
            </div>
            {/* Deployer abbreviated under avatar */}
            <div style={{fontFamily:'monospace',fontSize:'8px',color:C.text2,textAlign:'center',marginTop:'3px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'44px'}}>{tr(token.address,3)}</div>
          </div>

          {/* Main info */}
          <div style={{flex:1, minWidth:0}}>
            {/* Name + symbol + copy */}
            <div style={{display:'flex',alignItems:'center',gap:'5px',marginBottom:'3px'}}>
              <span style={{fontSize:'13px',fontWeight:'600',color:C.text1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'140px'}}>{token.name}</span>
              <span style={{fontSize:'10px',color:C.text2,fontWeight:'500',flexShrink:0}}>{token.symbol}</span>
              <button onClick={e=>{e.stopPropagation();navigator.clipboard.writeText(token.address)}} style={{background:'none',border:'none',cursor:'pointer',color:C.text2,padding:'0',flexShrink:0,fontSize:'11px',lineHeight:1}}>⎘</button>
            </div>
            {/* Age + holders + smart/snipers */}
            <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
              <span style={{fontSize:'9.8px',color:C.green,fontWeight:'500'}}>{elapsed(token.age)}</span>
              {totalHolders>0 && <span style={{fontSize:'9.8px',color:C.text2,display:'flex',alignItems:'center',gap:'2px'}}>👤<span style={{color:C.text3}}>{fmtC(totalHolders)}</span></span>}
              {(token.smartTraders||0)>0 && <span style={{fontSize:'9.8px',color:'#eab308',display:'flex',alignItems:'center',gap:'1px'}}>⭐<span style={{color:C.text3}}>{token.smartTraders}</span></span>}
              {(token.snipers||0)>0 && <span style={{fontSize:'9.8px',color:C.red,display:'flex',alignItems:'center',gap:'1px'}}>🎯<span style={{color:C.text3}}>{token.snipers}</span></span>}
              {(token.insiders||0)>0 && <span style={{fontSize:'9.8px',color:'#a855f7',display:'flex',alignItems:'center',gap:'1px'}}>🕵<span style={{color:C.text3}}>{token.insiders}</span></span>}
            </div>
            {/* Liquidity · Net change */}
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontSize:'9.8px',color:C.text2,display:'flex',alignItems:'center',gap:'2px'}}>
                <span style={{color:'#38bdf8'}}>💧</span>
                <span style={{color:C.text1,fontWeight:'500'}}>{fmtV(token.liquidity)}</span>
              </span>
              <span style={{fontSize:'9.8px',color:C.text2}}>N</span>
              <span style={{fontSize:'9.8px',color:netChange>=0?C.green:C.red,fontWeight:'600'}}>{netChange>=0?'+':''}{netChange.toFixed(2)}%</span>
            </div>
          </div>

          {/* MC + Vol right side */}
          <div style={{textAlign:'right',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',gap:'4px',justifyContent:'flex-end',marginBottom:'2px'}}>
              <span style={{fontSize:'10px',color:C.text2}}>MC</span>
              <span style={{fontSize:'13px',fontWeight:'700',color:mcColor}}>{fmt(token.marketCap)}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'4px',justifyContent:'flex-end'}}>
              <span style={{fontSize:'10px',color:C.text2}}>V</span>
              <span style={{fontSize:'12px',fontWeight:'600',color:C.text1}}>{fmtV(token.volume1h||token.volume5m)}</span>
            </div>
          </div>
        </div>

        {/* Row 2: TX bar + holder % + BUY button */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}}>
          {/* TX count + green/red bar */}
          <div style={{display:'flex',alignItems:'center',gap:'6px',flex:1,minWidth:0}}>
            <span style={{fontSize:'9.8px',color:C.text2,flexShrink:0}}>TX <span style={{color:C.text3,fontWeight:'600'}}>{fmtC(buys+sells)}</span></span>
            <div style={{flex:1,height:'3px',borderRadius:'2px',overflow:'hidden',background:C.bg3,maxWidth:'80px'}}>
              <div style={{display:'flex',height:'100%'}}>
                <div style={{background:C.green,width:greenPct+'%'}}/>
                <div style={{background:C.red,width:(100-greenPct)+'%'}}/>
              </div>
            </div>
          </div>

          {/* Holder breakdown percentages */}
          <div style={{display:'flex',alignItems:'center',gap:'5px',fontSize:'9.8px',flexShrink:0}}>
            <span style={{color:C.green}}>👤{regularPct}%</span>
            {smartPct>0 && <span style={{color:'#eab308'}}>⭐{smartPct}%</span>}
            {sniperPct>0 && <span style={{color:C.red}}>🎯{sniperPct}%</span>}
            <span style={{color:'#38bdf8'}}>🛡{token.bondingCurve||0}%</span>
            {insiderPct>0 && <span style={{color:'#a855f7'}}>🕵{insiderPct}%</span>}
          </div>

          {/* BUY button — exact Axiom style */}
          <button
            onClick={e=>{e.stopPropagation();selectToken(token);setSideTab('buy')}}
            style={{background:C.accent,border:'none',color:'#fff',fontSize:'11px',fontWeight:'700',padding:'5px 12px',cursor:'pointer',borderRadius:'8px',display:'flex',alignItems:'center',gap:'4px',flexShrink:0,letterSpacing:'-0.2px'}}
          >
            ⚡ 0.1 SOL
          </button>
        </div>
      </div>
    )
  }

  // ── Skeleton card ────────────────────────────────────────────────────
  const SkeletonCard = () => (
    <div style={{padding:'8px 14px',borderBottom:`1px solid ${C.bg3}`,display:'flex',gap:'10px'}}>
      <div style={{width:'44px',height:'44px',borderRadius:'8px',background:C.bg3,flexShrink:0,animation:'shimmer 1.5s infinite',backgroundImage:`linear-gradient(90deg,${C.bg3} 25%,${C.bg4} 50%,${C.bg3} 75%)`,backgroundSize:'200% 100%'}}/>
      <div style={{flex:1}}>
        <div style={{height:'13px',borderRadius:'3px',background:C.bg3,marginBottom:'6px',width:'55%',animation:'shimmer 1.5s infinite',backgroundImage:`linear-gradient(90deg,${C.bg3} 25%,${C.bg4} 50%,${C.bg3} 75%)`,backgroundSize:'200% 100%'}}/>
        <div style={{height:'10px',borderRadius:'3px',background:C.bg3,marginBottom:'4px',width:'35%',animation:'shimmer 1.5s infinite',backgroundImage:`linear-gradient(90deg,${C.bg3} 25%,${C.bg4} 50%,${C.bg3} 75%)`,backgroundSize:'200% 100%'}}/>
        <div style={{height:'9px',borderRadius:'3px',background:C.bg3,width:'60%',animation:'shimmer 1.5s infinite',backgroundImage:`linear-gradient(90deg,${C.bg3} 25%,${C.bg4} 50%,${C.bg3} 75%)`,backgroundSize:'200% 100%'}}/>
      </div>
      <div style={{width:'60px'}}>
        <div style={{height:'14px',borderRadius:'3px',background:C.bg3,marginBottom:'5px',animation:'shimmer 1.5s infinite',backgroundImage:`linear-gradient(90deg,${C.bg3} 25%,${C.bg4} 50%,${C.bg3} 75%)`,backgroundSize:'200% 100%'}}/>
        <div style={{height:'11px',borderRadius:'3px',background:C.bg3,animation:'shimmer 1.5s infinite',backgroundImage:`linear-gradient(90deg,${C.bg3} 25%,${C.bg4} 50%,${C.bg3} 75%)`,backgroundSize:'200% 100%'}}/>
      </div>
    </div>
  )

  // ── Filter presets per column ────────────────────────────────────────
  const PRESETS = {
    new:     [{id:'p1',label:'P1',min:0,max:50000},{id:'p2',label:'P2',min:50000,max:100000},{id:'p3',label:'P3',min:100000}],
    stretch: [{id:'p1',label:'P1',minBond:80},{id:'p2',label:'P2',minBond:90},{id:'p3',label:'P3',minBond:95}],
    migrated:[{id:'p1',label:'P1',min:100000},{id:'p2',label:'P2',min:500000},{id:'p3',label:'P3',min:1000000}],
  }
  const [colPresets, setColPresets] = useState({new:null, stretch:null, migrated:null})
  const applyPreset = (tokens, colKey) => {
    const p = colPresets[colKey]; if (!p) return tokens
    return tokens.filter(t => {
      if (p.min && t.marketCap < p.min) return false
      if (p.max && t.marketCap > p.max) return false
      if (p.minBond && t.bondingCurve < p.minBond) return false
      return true
    })
  }

  const columns = [
    {key:'new', label:'New Pairs', color:C.green, tokens:newPairs, desc:'Pump.fun · Bonding Curve'},
    {key:'stretch', label:'Final Stretch', color:C.yellow, tokens:stretch, desc:'Near $69K Graduation'},
    {key:'migrated', label:'Migrated', color:C.accent, tokens:migrated, desc:'PumpSwap / Raydium'},
  ]

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:C.bg,color:C.text1,overflow:'hidden',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"}}>
      <Nav active="/radar"/>

      {/* Toast notification */}
      {txStatus && (
        <div style={{position:'fixed',top:'60px',right:'16px',zIndex:9999,padding:'10px 16px',background:txStatus==='success'?'rgba(22,163,74,0.15)':txStatus==='error'?'rgba(239,68,68,0.15)':'rgba(12,12,16,0.95)',border:`1px solid ${txStatus==='success'?'rgba(22,163,74,0.4)':txStatus==='error'?'rgba(239,68,68,0.4)':C.bg3}`,borderRadius:'8px',fontSize:'12px',fontWeight:'600',color:txStatus==='success'?C.green:txStatus==='error'?C.red:C.text2,letterSpacing:'0.3px',boxShadow:'0 4px 24px rgba(0,0,0,0.6)',fontFamily:'monospace'}}>
          {txStatus==='pending'?`⟳ ${txMsg}`:txStatus==='success'?`✓ ${txMsg}`:`✗ ${txMsg}`}
        </div>
      )}

      {/* Search overlay */}
      {showSearch && (
        <div style={{position:'fixed',inset:0,zIndex:500,background:'rgba(6,7,11,0.85)',backdropFilter:'blur(8px)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'80px'}} onClick={()=>{setShowSearch(false);setSearchQuery('')}}>
          <div style={{width:'640px',background:C.bg2,border:`1px solid ${C.border2}`,borderRadius:'12px',overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.8)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:'10px',borderBottom:`1px solid ${C.bg3}`}}>
              <span style={{color:C.text2,fontSize:'16px'}}>⌕</span>
              <input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Escape'&&(setShowSearch(false),setSearchQuery(''))} placeholder="Search by token or CA..." style={{flex:1,background:'transparent',border:'none',color:C.text1,fontSize:'14px',outline:'none',fontFamily:'inherit'}}/>
              {searching && <span style={{color:C.text2,fontSize:'11px',fontFamily:'monospace'}}>searching...</span>}
              <kbd style={{background:C.bg3,border:`1px solid ${C.border2}`,borderRadius:'4px',padding:'2px 6px',fontSize:'10px',color:C.text2,fontFamily:'monospace'}}>/</kbd>
            </div>
            <div style={{maxHeight:'440px',overflowY:'auto'}}>
              {searchResults.length===0&&searchQuery.length>=2&&!searching && (
                <div style={{padding:'32px',textAlign:'center',color:C.text2,fontSize:'13px'}}>No results for "{searchQuery}"</div>
              )}
              {searchResults.map(p => {
                const t = pairToToken(p, ['raydium','meteora','orca','pumpswap'].includes(p.dexId)?'migrated':(p.marketCap??0)>55000?'stretch':'new')
                return (
                  <div key={p.pairAddress} onClick={()=>selectToken(t)} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 16px',cursor:'pointer',borderBottom:`1px solid ${C.bg3}`}} onMouseEnter={e=>e.currentTarget.style.background=C.bg4} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {p.info?.imageUrl ? (<img src={p.info.imageUrl} alt="" style={{width:'40px',height:'40px',borderRadius:'8px',objectFit:'cover',flexShrink:0}} onError={e=>e.target.style.display='none'}/>) : (<div style={{width:'40px',height:'40px',borderRadius:'8px',background:t.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:'bold',color:'#fff',flexShrink:0}}>{t.symbol[0]}</div>)}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px'}}>
                        <span style={{fontSize:'14px',fontWeight:'600',color:C.text1}}>{p.baseToken?.symbol}</span>
                        <span style={{fontSize:'11px',color:C.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.baseToken?.name}</span>
                        <span style={{fontSize:'9px',padding:'2px 6px',background:`${C.accent}22`,color:C.accent,border:`1px solid ${C.accent}44`,borderRadius:'4px',flexShrink:0,marginLeft:'auto'}}>{p.dexId}</span>
                      </div>
                      <div style={{display:'flex',gap:'14px'}}>
                        <span style={{fontSize:'11px',color:C.text2}}>MC {fmt(p.marketCap??p.fdv)}</span>
                        <span style={{fontSize:'11px',color:C.text2}}>Vol {fmtV(p.volume?.h24)}</span>
                        <span style={{fontSize:'11px',color:(p.priceChange?.h24??0)>=0?C.green:C.red}}>{(p.priceChange?.h24??0)>=0?'+':''}{(p.priceChange?.h24??0).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',flex:1,overflow:'hidden',marginTop:'52px'}}>
        {!selected ? (
          // ── PULSE FEED VIEW (exact Axiom layout) ─────────────────────
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Toolbar */}
            <div style={{padding:'8px 16px',borderBottom:`1px solid ${C.bg3}`,background:C.bg,display:'flex',alignItems:'center',gap:'12px',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
                <span style={{fontSize:'18px',fontWeight:'700',color:C.text1,letterSpacing:'-0.5px'}}>Pulse</span>
                <div style={{width:'20px',height:'20px',borderRadius:'50%',border:`2px solid ${C.bg3}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                  <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#06b6d4'}}/>
                </div>
              </div>
              {/* Search bar */}
              <div onClick={()=>setShowSearch(true)} style={{flex:1,maxWidth:'420px',display:'flex',alignItems:'center',gap:'8px',background:C.bg2,border:`1px solid ${C.bg3}`,padding:'7px 12px',cursor:'text',borderRadius:'8px'}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.border2} onMouseLeave={e=>e.currentTarget.style.borderColor=C.bg3}>
                <span style={{color:C.text2,fontSize:'14px'}}>⌕</span>
                <span style={{fontSize:'13px',color:C.text2}}>Search by token or CA...</span>
                <span style={{marginLeft:'auto',background:C.bg3,borderRadius:'4px',padding:'2px 5px',fontSize:'10px',color:C.text2,fontFamily:'monospace'}}>/</span>
              </div>
              <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'12px',flexShrink:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
                  <div style={{width:'7px',height:'7px',borderRadius:'50%',background:liveConns>0?C.green2:C.red,boxShadow:liveConns>0?`0 0 6px ${C.green2}`:undefined}}/>
                  <span style={{fontSize:'11px',color:liveConns>0?C.green2:C.red,fontWeight:'500'}}>{liveConns>0?`LIVE ×${liveConns}`:'OFFLINE'}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'6px',background:C.bg2,border:`1px solid ${C.bg3}`,padding:'5px 10px',borderRadius:'8px'}}>
                  <div style={{width:'14px',height:'14px',borderRadius:'50%',background:'linear-gradient(135deg,#9945FF,#14f195)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px'}}>◎</div>
                  <span style={{fontSize:'12px',color:C.text1,fontWeight:'600'}}>SOL</span>
                  <span style={{fontSize:'12px',color:C.text2}}>${solPrice.toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* Three columns */}
            <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',overflow:'hidden'}}>
              {columns.map((col, ci) => {
                const filtered = applyPreset(col.tokens, col.key)
                const activePreset = colPresets[col.key]
                return (
                  <div key={col.label} style={{display:'flex',flexDirection:'column',overflow:'hidden',borderRight:ci<2?`1px solid ${C.bg3}`:'none'}}>
                    {/* Column header — exact Axiom style */}
                    <div style={{padding:'10px 14px 8px',borderBottom:`1px solid ${C.bg3}`,background:C.bg,flexShrink:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <span style={{fontSize:'15px',fontWeight:'700',color:C.text1}}>{col.label}</span>
                        {/* Count badge */}
                        <div style={{display:'flex',alignItems:'center',gap:'4px',background:C.bg2,border:`1px solid ${C.bg3}`,borderRadius:'20px',padding:'2px 8px'}}>
                          <span style={{fontSize:'10px',color:C.text2}}>⚡</span>
                          <span style={{fontSize:'11px',color:C.text3,fontWeight:'600'}}>{filtered.length}</span>
                        </div>
                        {/* Sort icon */}
                        <button style={{background:'none',border:'none',color:C.text2,cursor:'pointer',padding:'2px',fontSize:'14px',marginLeft:'2px'}}>≡</button>
                        {/* P1 P2 P3 presets — exact Axiom */}
                        <div style={{display:'flex',gap:'2px',marginLeft:'2px'}}>
                          {PRESETS[col.key].map(p => (
                            <button key={p.id} onClick={()=>setColPresets(prev=>({...prev,[col.key]:prev[col.key]?.id===p.id?null:p}))} style={{fontSize:'11px',fontWeight:'700',padding:'2px 8px',background:activePreset?.id===p.id?C.accent:'transparent',border:`1px solid ${activePreset?.id===p.id?C.accent:C.bg3}`,color:activePreset?.id===p.id?'#fff':C.text2,cursor:'pointer',borderRadius:'4px',letterSpacing:'0.3px'}}>{p.label}</button>
                          ))}
                        </div>
                        {/* Adjust icon */}
                        <button style={{background:'none',border:'none',color:C.text2,cursor:'pointer',padding:'2px',fontSize:'13px',marginLeft:'auto'}}>⊞</button>
                        {/* Live dot */}
                        <div style={{width:'8px',height:'8px',borderRadius:'50%',background:col.color,boxShadow:`0 0 6px ${col.color}88`}}/>
                      </div>
                    </div>
                    {/* Token list */}
                    <div style={{flex:1,overflowY:'auto'}}>
                      {loading && col.tokens.length===0
                        ? Array.from({length:7}).map((_,i) => <SkeletonCard key={i}/>)
                        : filtered.length===0
                          ? <div style={{padding:'48px 16px',textAlign:'center',color:C.text2,fontSize:'13px'}}>No pairs{activePreset?` matching ${activePreset.label}`:''}</div>
                          : filtered.map(t => <TokenCard key={t.id} token={t}/>)
                      }
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bottom status bar — exact Axiom style */}
            <div style={{height:'30px',borderTop:`1px solid ${C.bg3}`,background:C.bg,display:'flex',alignItems:'center',padding:'0 16px',gap:'14px',flexShrink:0,overflowX:'auto'}}>
              <div style={{display:'flex',alignItems:'center',gap:'6px',flexShrink:0,background:`${C.accent}22`,border:`1px solid ${C.accent}44`,padding:'2px 8px',borderRadius:'4px'}}>
                <span style={{fontSize:'10px',color:C.accent,fontWeight:'700'}}>≡ PRESET 1</span>
              </div>
              {[{icon:'🗂',val:'1'},{icon:'≡',val:'0'},{icon:'▼',val:''}].map((x,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:'3px',color:C.text2,fontSize:'10px',flexShrink:0}}>
                  <span>{x.icon}</span><span>{x.val}</span>
                </div>
              ))}
              <div style={{width:'1px',height:'14px',background:C.bg3,flexShrink:0}}/>
              {['Wallet','Twitter','Discover','Pulse','PnL'].map(x=>(
                <span key={x} style={{fontSize:'10px',color:C.text2,cursor:'pointer',flexShrink:0}} onMouseEnter={e=>e.target.style.color=C.text1} onMouseLeave={e=>e.target.style.color=C.text2}>{x==='Wallet'?'⬡':x==='Twitter'?'𝕏':x==='Discover'?'◎':x==='Pulse'?'∿':'📊'} {x}</span>
              ))}
              <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'14px',flexShrink:0}}>
                <span style={{fontSize:'10px',color:C.text2}}>${(50200).toLocaleString()}</span>
                <span style={{fontSize:'10px',color:C.text2}}>₿ 0.062,1</span>
                <span style={{fontSize:'10px',color:C.text2}}>◎ 0:00,38</span>
                <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                  <div style={{width:'7px',height:'7px',borderRadius:'50%',background:liveConns>0?C.green2:C.red}}/>
                  <span style={{fontSize:'10px',color:liveConns>0?C.green2:C.text2}}>{liveConns>0?'Connection is stable':'Connecting'}</span>
                </div>
                <span style={{fontSize:'10px',color:C.text2,fontWeight:'600'}}>GLOBAL ▾</span>
              </div>
            </div>
          </div>
        ) : (
          // ── TOKEN DETAIL VIEW ─────────────────────────────────────────
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Top detail bar */}
            <div style={{padding:'8px 14px',borderBottom:`1px solid ${C.bg3}`,background:C.bg,display:'flex',alignItems:'center',gap:'10px',flexShrink:0,overflowX:'auto'}}>
              <button onClick={()=>setSelected(null)} style={{fontSize:'12px',color:C.text2,background:C.bg2,border:`1px solid ${C.bg3}`,padding:'5px 10px',cursor:'pointer',borderRadius:'6px',flexShrink:0,fontWeight:'600'}}>← Back</button>
              {selected.logoUri ? (<img src={selected.logoUri} alt="" style={{width:'24px',height:'24px',borderRadius:'6px',objectFit:'cover',flexShrink:0}} onError={e=>e.target.style.display='none'}/>) : (<div style={{width:'24px',height:'24px',borderRadius:'6px',background:selected.color,flexShrink:0}}/>)}
              <button onClick={()=>{navigator.clipboard.writeText(selected.address);setTxMsg('CA COPIED');setTxStatus('success');setTimeout(()=>{setTxStatus(null);setTxMsg('')},1500)}} style={{background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:0,flexShrink:0}}>
                <div style={{fontSize:'15px',fontWeight:'700',color:C.text1,lineHeight:1}}>${selected.symbol}</div>
                <div style={{fontSize:'9px',color:C.text2}}>click to copy CA</div>
              </button>
              <div style={{display:'flex',gap:'4px',flexShrink:0}}>
                {selected.website&&<a href={selected.website} target="_blank" rel="noreferrer" style={{fontSize:'10px',color:C.text2,background:C.bg2,border:`1px solid ${C.bg3}`,padding:'3px 7px',textDecoration:'none',borderRadius:'4px'}}>WEB</a>}
                {selected.twitter&&<a href={selected.twitter} target="_blank" rel="noreferrer" style={{fontSize:'10px',color:C.text2,background:C.bg2,border:`1px solid ${C.bg3}`,padding:'3px 7px',textDecoration:'none',borderRadius:'4px'}}>𝕏</a>}
                {selected.telegram&&<a href={selected.telegram} target="_blank" rel="noreferrer" style={{fontSize:'10px',color:C.text2,background:C.bg2,border:`1px solid ${C.bg3}`,padding:'3px 7px',textDecoration:'none',borderRadius:'4px'}}>TG</a>}
                <a href={`https://pump.fun/${selected.address}`} target="_blank" rel="noreferrer" style={{fontSize:'10px',color:'#00ff88',background:'rgba(0,255,136,0.08)',border:'1px solid rgba(0,255,136,0.25)',padding:'3px 7px',textDecoration:'none',borderRadius:'4px'}}>pump</a>
              </div>
              <div style={{display:'flex',gap:'14px',marginLeft:'4px',overflowX:'auto'}}>
                {[['PRICE',`$${selected.price.toExponential(2)}`,C.text1],['MCAP',fmt(selected.marketCap),'#eab308'],['LIQ',fmt(selected.liquidity),'#38bdf8'],['CURVE',`${selected.bondingCurve}%`,C.text1],['VOL 1H',fmt(selected.volume1h),C.text1],['BUYS',selected.buys1h,C.green],['SELLS',selected.sells1h,C.red]].map(([l,v,c])=>(
                  <div key={l} style={{flexShrink:0}}>
                    <div style={{fontSize:'9px',color:C.text2,letterSpacing:'0.5px',marginBottom:'1px'}}>{l}</div>
                    <div style={{fontSize:'12px',color:c,fontWeight:'700'}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{marginLeft:'auto',flexShrink:0}}>
                <div style={{background:C.bg2,border:`1px solid ${C.bg3}`,padding:'4px 10px',borderRadius:'8px',display:'flex',alignItems:'center',gap:'5px'}}>
                  <span style={{fontSize:'10px',color:'#9945FF'}}>◎</span>
                  <span style={{fontSize:'12px',color:C.text1,fontWeight:'600'}}>${solPrice.toFixed(0)}</span>
                </div>
              </div>
            </div>

            <div style={{flex:1,display:'flex',overflow:'hidden'}}>
              {/* Chart + bottom panel */}
              <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                {/* Chart timeframe bar */}
                <div style={{display:'flex',gap:'2px',padding:'5px 10px',background:C.bg,borderBottom:`1px solid ${C.bg3}`,alignItems:'center',flexShrink:0}}>
                  {[['1','1m'],['5','5m'],['15','15m'],['60','1h'],['240','4h']].map(([tf,label])=>(
                    <button key={tf} onClick={()=>setChartTf(tf)} style={{fontSize:'11px',padding:'4px 10px',background:chartTf===tf?C.bg2:'transparent',border:`1px solid ${chartTf===tf?C.border2:'transparent'}`,color:chartTf===tf?C.text1:C.text2,cursor:'pointer',borderRadius:'6px',fontWeight:chartTf===tf?'600':'400'}}>{label}</button>
                  ))}
                  <div style={{marginLeft:'auto',fontSize:'10px',color:chartSource==='pump-v2'||chartSource==='pump-v1'?C.green:chartSource==='geckoterminal'?'#eab308':chartSource==='loading'?C.text2:C.red,fontFamily:'monospace'}}>
                    {chartSource==='mobula-live'?'● Mobula · Live':chartSource==='pump-v2'?'● Pump V2 · Live':chartSource==='pump-v1'?'● Pump V1 · Live':chartSource==='geckoterminal'?'● GeckoTerminal':chartSource==='loading'?'⟳ Loading...':'● No data'}
                  </div>
                </div>
                {/* Chart canvas */}
                {chartSource==='none' ? (
                  <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:C.bg,gap:'10px'}}>
                    <div style={{fontSize:'14px',color:C.text2}}>No chart data available yet</div>
                    <a href={`https://pump.fun/${selected.address}`} target="_blank" rel="noreferrer" style={{fontSize:'12px',color:'#00ff88',border:'1px solid rgba(0,255,136,0.3)',padding:'7px 16px',textDecoration:'none',borderRadius:'8px'}}>View on Pump.fun ↗</a>
                  </div>
                ) : (
                  <div ref={chartRef} style={{flex:1,width:'100%'}}/>
                )}

                {/* Draggable bottom panel */}
                <div style={{height:panelHeight+'px',borderTop:`1px solid ${C.bg3}`,flexShrink:0,display:'flex',flexDirection:'column',position:'relative'}}>
                  <div onMouseDown={e=>{e.preventDefault();const sY=e.clientY,sH=panelHeight;const mv=e=>setPanelHeight(Math.max(160,Math.min(550,sH+(sY-e.clientY))));const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up)};document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up)}} style={{position:'absolute',top:0,left:0,right:0,height:'6px',cursor:'ns-resize',zIndex:10}} onMouseEnter={e=>e.target.style.background='rgba(82,111,255,0.2)'} onMouseLeave={e=>e.target.style.background='transparent'}/>
                  {/* Tab bar */}
                  <div style={{display:'flex',borderBottom:`1px solid ${C.bg3}`,background:C.bg,flexShrink:0,alignItems:'center'}}>
                    {[['trades','TRADES'],['positions','POSITIONS'],['holders','HOLDERS'+(selected.holders>0?` (${selected.holders})`:'')],['top_traders','TOP TRADERS'],['dev_tokens','DEV TOKENS']].map(([v,l])=>(
                      <button key={v} onClick={()=>setBottomTab(v)} style={{fontSize:'11px',letterSpacing:'0.3px',padding:'8px 14px',background:'none',border:'none',borderBottom:`2px solid ${bottomTab===v?C.accent:'transparent'}`,color:bottomTab===v?C.text1:C.text2,cursor:'pointer',whiteSpace:'nowrap',fontWeight:bottomTab===v?'600':'400'}}>{l}</button>
                    ))}
                    <div style={{marginLeft:'auto',padding:'0 10px'}}>
                      <button style={{fontSize:'11px',padding:'4px 12px',background:C.accent,border:'none',color:'#fff',cursor:'pointer',borderRadius:'6px',fontWeight:'600',display:'flex',alignItems:'center',gap:'4px'}}>⚡ TRADE</button>
                    </div>
                  </div>
                  <div style={{flex:1,overflow:'hidden',display:'flex'}}>
                    {/* TRADES */}
                    {bottomTab==='trades' && (
                      <div style={{flex:1,overflowY:'auto'}}>
                        <div style={{display:'grid',gridTemplateColumns:'42px 46px 80px 80px 80px 80px 1fr',padding:'4px 14px',background:C.bg,fontFamily:'monospace',fontSize:'10px',color:C.text2,position:'sticky',top:0,borderBottom:`1px solid ${C.bg3}`,letterSpacing:'0.3px'}}>
                          <span>AGE</span><span>TYPE</span><span>SOL</span><span>USD</span><span>LABELS</span><span>PLATFORM</span><span>WALLET</span>
                        </div>
                        {trades.length===0 ? (
                          <div style={{padding:'24px',textAlign:'center',color:C.text2,fontSize:'12px'}}>Waiting for trades...</div>
                        ) : trades.map(t => {
                          const labelColors = {sniper:C.red,insider:'#a855f7',bundler:'#f97316',proTrader:C.accent,smartTrader:'#eab308',freshTrader:'#06b6d4',dev:'#f43f5e'}
                          const topLabel = (t.labels||[])[0]
                          return (
                          <div key={t.id} style={{display:'grid',gridTemplateColumns:'42px 46px 80px 80px 80px 80px 1fr',padding:'5px 14px',borderBottom:`1px solid ${C.bg}`,alignItems:'center',background:t.isBuy?'rgba(22,163,74,0.03)':'rgba(239,68,68,0.03)'}} onMouseEnter={e=>e.currentTarget.style.background=C.bg4} onMouseLeave={e=>e.currentTarget.style.background=t.isBuy?'rgba(22,163,74,0.03)':'rgba(239,68,68,0.03)'}>
                            <span style={{fontFamily:'monospace',fontSize:'10px',color:C.text2}}>{typeof t.age==='number'?t.age<60?`${t.age}s`:t.age<3600?`${Math.floor(t.age/60)}m`:`${Math.floor(t.age/3600)}h`:'0s':t.age}</span>
                            <span style={{fontFamily:'monospace',fontSize:'11px',color:t.isBuy?C.green:C.red,fontWeight:'700'}}>{t.type}</span>
                            <span style={{fontFamily:'monospace',fontSize:'11px',color:C.text1}}>◎{t.solAmount}</span>
                            <span style={{fontFamily:'monospace',fontSize:'11px',color:t.isBuy?C.green:C.red,fontWeight:'700'}}>${t.usdValue}</span>
                            <span style={{fontFamily:'monospace',fontSize:'9px',color:topLabel?labelColors[topLabel]||C.text2:C.text2,fontWeight:topLabel?'700':'400'}}>{topLabel||'-'}</span>
                            <span style={{fontFamily:'monospace',fontSize:'9px',color:C.accent}}>{t.platform||'-'}</span>
                            <span style={{fontFamily:'monospace',fontSize:'10px',color:C.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.walletMeta?.entityName||tr(t.wallet,5)}</span>
                          </div>
                        )})}
                      </div>
                    )}
                    {/* HOLDERS */}
                    {bottomTab==='holders' && (
                      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
                        <div style={{flex:1,overflowY:'auto'}}>
                          <div style={{display:'grid',gridTemplateColumns:'28px 160px 100px 80px 60px',padding:'4px 14px',background:C.bg,fontFamily:'monospace',fontSize:'10px',color:C.text2,position:'sticky',top:0,borderBottom:`1px solid ${C.bg3}`}}>
                            <span>#</span><span>WALLET</span><span>TOKENS</span><span>%</span><span>TYPE</span>
                          </div>
                          {holders.length===0 ? <div style={{padding:'24px',textAlign:'center',color:C.text2,fontSize:'12px'}}>Loading...</div>
                          : holders.map((h,i) => (
                            <div key={i} style={{display:'grid',gridTemplateColumns:'28px 160px 100px 80px 60px',padding:'6px 14px',borderBottom:`1px solid ${C.bg}`,alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.background=C.bg4} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              <span style={{fontFamily:'monospace',fontSize:'10px',color:C.text2}}>{h.rank}</span>
                              <span style={{fontFamily:'monospace',fontSize:'10px',color:C.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tr(h.wallet,6)}</span>
                              <span style={{fontFamily:'monospace',fontSize:'10px',color:C.text1}}>{h.tokens>1e9?(h.tokens/1e9).toFixed(1)+'B':h.tokens>1e6?(h.tokens/1e6).toFixed(1)+'M':(h.tokens/1e3).toFixed(0)+'K'}</span>
                              <span style={{fontFamily:'monospace',fontSize:'11px',color:'#eab308',fontWeight:'600'}}>{h.pct}%</span>
                              <span style={{fontFamily:'monospace',fontSize:'9px',color:h.type==='LP'?'#38bdf8':C.red}}>{h.type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* TOP TRADERS */}
                    {bottomTab==='top_traders' && (
                      <div style={{flex:1,overflowY:'auto'}}>
                        <div style={{display:'grid',gridTemplateColumns:'28px 160px 90px 90px 100px 60px',padding:'4px 14px',background:C.bg,fontFamily:'monospace',fontSize:'10px',color:C.text2,position:'sticky',top:0,borderBottom:`1px solid ${C.bg3}`}}>
                          <span>#</span><span>WALLET</span><span>◎ IN</span><span>◎ OUT</span><span>PNL</span><span>TXS</span>
                        </div>
                        {topTraders.length===0 ? <div style={{padding:'24px',textAlign:'center',color:C.text2,fontSize:'12px'}}>Loading top traders...</div>
                        : topTraders.map(t => (
                          <div key={t.rank} style={{display:'grid',gridTemplateColumns:'28px 160px 90px 90px 100px 60px',padding:'6px 14px',borderBottom:`1px solid ${C.bg}`,alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.background=C.bg4} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <span style={{fontFamily:'monospace',fontSize:'10px',color:C.text2}}>{t.rank}</span>
                            <button onClick={()=>navigator.clipboard.writeText(t.wallet)} style={{fontFamily:'monospace',fontSize:'10px',color:C.text2,background:'none',border:'none',cursor:'pointer',textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tr(t.wallet,6)}</button>
                            <span style={{fontFamily:'monospace',fontSize:'11px',color:C.green}}>{fmtSol(t.solSpent)}</span>
                            <span style={{fontFamily:'monospace',fontSize:'11px',color:C.red}}>{fmtSol(t.solReceived)}</span>
                            <span style={{fontFamily:'monospace',fontSize:'12px',color:t.isProfitable?C.green:C.red,fontWeight:'700'}}>{t.isProfitable?'+':''}{fmtSol(t.pnlSol)}</span>
                            <span style={{fontFamily:'monospace',fontSize:'10px',color:C.text2}}>{(t.buys||0)+(t.sells||0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {bottomTab==='dev_tokens' && <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:C.text2,fontSize:'13px'}}>Dev token history coming soon</div>}
                    {bottomTab==='positions' && (
                      <div style={{flex:1,overflowY:'auto',padding:'12px'}}>
                        {positions.length===0 ? <div style={{textAlign:'center',padding:'24px',color:C.text2,fontSize:'12px'}}>No open positions</div>
                        : positions.map(p => {
                          const pnlU=p.tokensHeld*p.currentPrice-p.usdSpent,pnlS=pnlU/solPrice,pnlP=p.usdSpent>0?(pnlU/p.usdSpent)*100:0
                          return (
                            <div key={p.id} style={{background:C.bg2,border:`1px solid ${pnlU>=0?'rgba(22,163,74,0.3)':'rgba(239,68,68,0.3)'}`,padding:'12px',marginBottom:'8px',borderRadius:'8px'}}>
                              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}><span style={{fontSize:'13px',fontWeight:'700'}}>${p.token.symbol}</span><span style={{fontSize:'13px',color:pnlU>=0?C.green:C.red,fontWeight:'700'}}>{pnlU>=0?'+':''}{pnlP.toFixed(1)}%</span></div>
                              <div style={{fontSize:'11px',color:C.text2,marginBottom:'8px'}}>{fmtSol(p.solSpent)} in · {pnlU>=0?'+':''}{fmtSol(pnlS)} PNL</div>
                              <button onClick={()=>sellPosition(p.id,100)} style={{width:'100%',fontSize:'12px',color:C.red,background:'rgba(239,68,68,0.08)',border:`1px solid rgba(239,68,68,0.3)`,padding:'7px',cursor:'pointer',borderRadius:'6px',fontWeight:'700'}}>SELL ALL</button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right BUY/SELL panel */}
              <div style={{width:'268px',flexShrink:0,display:'flex',flexDirection:'column',borderLeft:`1px solid ${C.bg3}`,overflow:'hidden'}}>
                <div style={{display:'flex',borderBottom:`1px solid ${C.bg3}`,flexShrink:0}}>
                  {[['buy','BUY',C.green],['sell','SELL',C.red]].map(([v,l,c])=>(
                    <button key={v} onClick={()=>setSideTab(v)} style={{flex:1,fontSize:'13px',letterSpacing:'1px',padding:'12px',background:sideTab===v?`${c}11`:'transparent',border:'none',borderBottom:`2px solid ${sideTab===v?c:'transparent'}`,color:sideTab===v?c:C.text2,cursor:'pointer',fontWeight:'700'}}>{l}</button>
                  ))}
                </div>
                <div style={{flex:1,overflowY:'auto',padding:'14px'}}>
                  {sideTab==='buy' && (
                    <div>
                      {!wallet ? (
                        <button onClick={generateWallet} style={{width:'100%',fontSize:'12px',letterSpacing:'1px',color:'#000',background:C.accent,border:'none',padding:'12px',cursor:'pointer',marginBottom:'12px',borderRadius:'8px',fontWeight:'700'}}>⚡ GENERATE DEVNET WALLET</button>
                      ) : (
                        <div style={{background:C.bg2,border:`1px solid ${C.bg3}`,padding:'12px',marginBottom:'12px',borderRadius:'8px'}}>
                          <div style={{fontSize:'10px',color:C.text2,marginBottom:'4px',fontFamily:'monospace'}}>DEVNET WALLET</div>
                          <div style={{display:'flex',alignItems:'baseline',gap:'5px',marginBottom:'4px'}}>
                            <span style={{fontSize:'26px',fontWeight:'700',color:C.green,letterSpacing:'-1px'}}>{(wallet.balance||0).toFixed(4)}</span>
                            <span style={{fontSize:'12px',color:C.text2}}>SOL</span>
                          </div>
                          <div style={{fontFamily:'monospace',fontSize:'10px',color:C.text2,marginBottom:'8px'}}>{tr(wallet.publicKey,7)}</div>
                          <button onClick={airdrop} disabled={txStatus==='pending'} style={{width:'100%',fontSize:'11px',color:'#eab308',background:'rgba(234,179,8,0.06)',border:'1px solid rgba(234,179,8,0.25)',padding:'6px',cursor:'pointer',borderRadius:'6px',fontWeight:'600'}}>🪂 Airdrop 2 SOL</button>
                        </div>
                      )}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'8px'}}>
                        {['0.05','0.1','0.5','1'].map(amt=>(
                          <button key={amt} onClick={()=>setBuyAmount(amt)} style={{fontSize:'12px',padding:'8px',background:buyAmount===amt?`${C.accent}22`:C.bg2,border:`1px solid ${buyAmount===amt?C.accent:C.bg3}`,color:buyAmount===amt?C.accent:C.text2,cursor:'pointer',borderRadius:'6px',fontWeight:buyAmount===amt?'700':'400'}}>◎{amt}</button>
                        ))}
                      </div>
                      <div style={{display:'flex',marginBottom:'6px',borderRadius:'8px',overflow:'hidden',border:`1px solid ${C.bg3}`}}>
                        <input value={buyAmount} onChange={e=>setBuyAmount(e.target.value)} style={{flex:1,background:C.bg2,border:'none',color:C.text1,fontSize:'15px',padding:'10px 12px',outline:'none',fontFamily:'inherit'}}/>
                        <div style={{background:C.bg,padding:'10px 12px',fontSize:'12px',color:'#9945FF',fontWeight:'700',borderLeft:`1px solid ${C.bg3}`}}>◎ SOL</div>
                      </div>
                      <div style={{fontSize:'11px',color:C.text2,marginBottom:'12px'}}>≈ ${(parseFloat(buyAmount||0)*solPrice).toFixed(2)} USD</div>
                      <button onClick={buy} disabled={!wallet||txStatus==='pending'} style={{width:'100%',fontSize:'14px',letterSpacing:'1px',color:'#fff',background:!wallet?C.bg3:C.accent,border:'none',padding:'13px',cursor:wallet?'pointer':'not-allowed',borderRadius:'8px',marginBottom:'14px',fontWeight:'700'}}>
                        {txStatus==='pending'?txMsg:'BUY'}
                      </button>
                      {/* PNL */}
                      {pos && (
                        <div style={{borderTop:`1px solid ${C.bg3}`,paddingTop:'12px',marginBottom:'12px'}}>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px',marginBottom:'8px'}}>
                            {[['Bought',`◎${pos.solSpent.toFixed(4)}`,C.text2],['Sold','◎0',C.text2],['Holding',`$${(pos.tokensHeld*(selected?.price??0)).toFixed(2)}`,C.text1],['PnL',pnlInSol?`◎${posPnlSol.toFixed(4)}`:`$${posPnlUsd.toFixed(2)}`,posPnlUsd>=0?C.green:C.red]].map(([l,v,c])=>(
                              <div key={l} style={{background:C.bg2,border:`1px solid ${C.bg3}`,padding:'7px',textAlign:'center',borderRadius:'6px'}}>
                                <div style={{fontSize:'9px',color:C.text2,marginBottom:'2px',fontFamily:'monospace'}}>{l}</div>
                                <div style={{fontSize:'12px',color:c,fontWeight:'700'}}>{v}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{textAlign:'center',fontSize:'20px',color:posPnlUsd>=0?C.green:C.red,fontWeight:'700',marginBottom:'5px'}}>{posPnlUsd>=0?'+':''}{posPnlPct.toFixed(2)}%</div>
                          <button onClick={()=>setPnlInSol(s=>!s)} style={{width:'100%',fontSize:'11px',color:C.text2,background:C.bg2,border:`1px solid ${C.bg3}`,padding:'5px',cursor:'pointer',borderRadius:'6px',marginBottom:'6px'}}>SHOW {pnlInSol?'USD':'SOL ◎'}</button>
                        </div>
                      )}
                      {/* Token info */}
                      <div style={{borderTop:`1px solid ${C.bg3}`,paddingTop:'12px'}}>
                        <div style={{fontSize:'11px',color:C.text2,marginBottom:'10px',fontFamily:'monospace',letterSpacing:'0.5px'}}>TOKEN INFO {tokenInfo?'✓':''}</div>
                        {tokenInfo ? (
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'5px',marginBottom:'10px'}}>
                            {[
                              ['Top 10',tokenInfo.top10.toFixed(1)+'%',tokenInfo.top10>20?C.red:C.green],
                              ['Dev',tokenInfo.dev.toFixed(1)+'%',tokenInfo.dev>5?C.red:C.green],
                              ['Snipers',tokenInfo.snipers.toFixed(1)+'%',tokenInfo.snipers>5?C.red:C.green],
                              ['Insiders',tokenInfo.insiders.toFixed(1)+'%',tokenInfo.insiders>10?C.red:C.green],
                              ['Bundlers',tokenInfo.bundlers.toFixed(1)+'%',tokenInfo.bundlers>5?'#f97316':C.green],
                              ['Dex',tokenInfo.dexPaid?'PAID':'NO',tokenInfo.dexPaid?C.green:C.red],
                              ['Holders',tokenInfo.numHolders,C.text1],
                              ['Fees',`◎${tokenInfo.fees.toFixed(3)}`,C.accent],
                            ].map(([l,v,c])=>(
                              <div key={l} style={{background:C.bg2,border:`1px solid ${C.bg3}`,padding:'6px',textAlign:'center',borderRadius:'6px'}}>
                                <div style={{fontSize:'8px',color:C.text2,marginBottom:'2px',fontFamily:'monospace'}}>{l}</div>
                                <div style={{fontSize:'12px',color:c,fontWeight:'700'}}>{v}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{fontSize:'11px',color:C.text2,textAlign:'center',padding:'10px',fontFamily:'monospace'}}>Loading security data...</div>
                        )}
                        <div style={{display:'flex',flexDirection:'column',gap:'3px'}}>
                          {[['Market Cap',fmt(selected.marketCap)],['Liquidity',fmt(selected.liquidity)],['Bonding',`${selected.bondingCurve}%`],['Age',elapsed(selected.age)]].map(([k,v])=>(
                            <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${C.bg3}`}}>
                              <span style={{fontSize:'11px',color:C.text2}}>{k}</span>
                              <span style={{fontSize:'11px',color:C.text1,fontWeight:'600'}}>{v}</span>
                            </div>
                          ))}
                        </div>
                        <button onClick={()=>{navigator.clipboard.writeText(selected.address);setTxMsg('CA COPIED');setTxStatus('success');setTimeout(()=>{setTxStatus(null);setTxMsg('')},1500)}} style={{width:'100%',marginTop:'10px',fontSize:'10px',color:C.text2,background:C.bg2,border:`1px solid ${C.bg3}`,padding:'8px',cursor:'pointer',textAlign:'left',borderRadius:'6px',wordBreak:'break-all',fontFamily:'monospace'}}>⎘ {selected.address.slice(0,26)}...</button>
                      </div>
                    </div>
                  )}
                  {sideTab==='sell' && (
                    <div>
                      {!pos ? (
                        <div style={{textAlign:'center',padding:'40px 20px',color:C.text2,fontSize:'13px'}}>No position<br/><span style={{fontSize:'11px',color:C.bg3}}>Buy first</span></div>
                      ) : (
                        <div>
                          <div style={{background:C.bg2,border:`1px solid ${C.bg3}`,padding:'14px',marginBottom:'12px',borderRadius:'8px'}}>
                            <div style={{fontSize:'11px',color:C.text2,marginBottom:'6px',fontFamily:'monospace'}}>CURRENT POSITION</div>
                            <div style={{fontSize:'30px',color:posPnlUsd>=0?C.green:C.red,fontWeight:'700',letterSpacing:'-1px',marginBottom:'4px'}}>{posPnlUsd>=0?'+':''}{posPnlPct.toFixed(2)}%</div>
                            <div style={{fontSize:'12px',color:C.text2}}>{fmtSol(pos.solSpent)} in · {posPnlUsd>=0?'+':''}{fmtSol(posPnlSol)} PNL</div>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'10px'}}>
                            {['25','50','75','100'].map(pct=>(
                              <button key={pct} onClick={()=>sellPosition(pos.id,parseInt(pct))} style={{fontSize:'12px',padding:'10px',background:`${C.red}11`,border:`1px solid ${C.red}44`,color:C.red,cursor:'pointer',borderRadius:'6px',fontWeight:'700'}}>SELL {pct}%</button>
                            ))}
                          </div>
                          <button onClick={()=>sellPosition(pos.id,100)} style={{width:'100%',fontSize:'14px',letterSpacing:'1px',color:'#fff',background:C.red,border:'none',padding:'13px',cursor:'pointer',borderRadius:'8px',fontWeight:'700'}}>SELL ALL</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes rp{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.bg3};border-radius:2px}
        ::-webkit-scrollbar-thumb:hover{background:${C.border2}}
        *{box-sizing:border-box}
      `}</style>
    </div>
  )
}
