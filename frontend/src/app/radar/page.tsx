// @ts-nocheck
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Nav from '../../components/Nav'
import * as web3 from '@solana/web3.js'

const BACKEND = 'https://trench-production-cd7b.up.railway.app'
const HELIUS_KEY = '870dfde6-09ec-48bd-95b8-202303d15c5b'
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
const DEVNET_RPC = 'https://api.devnet.solana.com'
const MOBULA_WS = 'wss://api.mobula.io'
const BULLX_WS = 'wss://stream.bullx.io/app/prowess-frail-sensitive?protocol=7&client=js&version=8.4.0-rc2&flash=false'
const SOLANA_CHAIN_ID = '1399811149'
let cachedSolPrice = 150

// ── Formatters ───────────────────────────────────────────
const fmt = (n) => { if(!n||n===0) return '$0'; if(n>=1e9) return `$${(n/1e9).toFixed(2)}B`; if(n>=1e6) return `$${(n/1e6).toFixed(2)}M`; if(n>=1e3) return `$${(n/1e3).toFixed(1)}K`; return `$${n.toFixed(2)}` }
const fmtC = (n) => { if(!n) return '0'; if(n>=1e6) return `${(n/1e6).toFixed(1)}M`; if(n>=1e3) return `${(n/1e3).toFixed(1)}K`; return Math.round(n).toString() }
const fmtSol = (n) => !n?'0 ◎':n<0.001?`${n.toFixed(6)} ◎`:n<1?`${n.toFixed(4)} ◎`:`${n.toFixed(3)} ◎`
const elapsed = (ts) => { if(!ts) return '?'; const s=Math.floor((Date.now()-ts)/1000); if(s<2) return 'just now'; const m=Math.floor(s/60),h=Math.floor(m/60),d=Math.floor(h/24); return d>0?`${d}d`:h>0?`${h}h`:m>0?`${m}m`:`${s}s` }
const tr = (a,n=4) => a?`${a.slice(0,n)}...${a.slice(-n)}`:''
const getMcColor = (mc) => mc>2e6?'#22c55e':mc>1e6?'#eab308':'#38bdf8'
const getBondColor = (p) => p<=30?'#22c55e':p<=60?'#eab308':p<=80?'#f97316':'#ef4444'
const COLORS = ['#f43f5e','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899','#6366f1','#14b8a6','#84cc16','#fb923c']

async function fetchSolPrice() {
  try { const r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'); const d=await r.json(); cachedSolPrice=d?.solana?.usd??150 } catch {}
  return cachedSolPrice
}

function pairToToken(p, stage) {
  const mcap=p.marketCap??p.fdv??0
  const bc=p.dexId==='pumpfun'?Math.min(99,Math.round((mcap/69000)*100)):100
  const addr=p.baseToken?.address??''
  return {
    id:p.pairAddress, symbol:p.baseToken?.symbol??'???', name:p.baseToken?.name??'Unknown',
    address:addr, pairAddress:p.pairAddress,
    color:COLORS[Math.abs((addr.charCodeAt(0)||0)+(addr.charCodeAt(1)||0))%COLORS.length],
    price:parseFloat(p.priceUsd??'0'), marketCap:mcap, liquidity:p.liquidity?.usd??0,
    volume5m:p.volume?.m5??0, volume1h:p.volume?.h1??0,
    priceChange5m:p.priceChange?.m5??0, priceChange1h:p.priceChange?.h1??0,
    buys5m:p.txns?.m5?.buys??0, sells5m:p.txns?.m5?.sells??0,
    buys1h:p.txns?.h1?.buys??0, sells1h:p.txns?.h1?.sells??0,
    age:Date.now()-(p.pairCreatedAt??Date.now()), bondingCurve:bc,
    holders:0, stage, logoUri:p.info?.imageUrl??null, dexId:p.dexId, supply:'1B',
    website:p.info?.websites?.[0]?.url??null,
    twitter:p.info?.socials?.find(s=>s.type==='twitter')?.url??null,
    telegram:p.info?.socials?.find(s=>s.type==='telegram')?.url??null,
    pairCreatedAt:p.pairCreatedAt, source:'dexscreener'
  }
}

async function dexSearch(q) {
  try { const r=await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`); return (await r.json()).pairs??[] } catch { return [] }
}

async function loadPairs() {
  const [r1,r2,r3,r4,r5]=await Promise.all([dexSearch('pumpfun'),dexSearch('pump sol'),dexSearch('solana pump new'),dexSearch('pumpswap'),dexSearch('solana meme')])
  const all=[...r1,...r2,...r3,...r4,...r5].filter(p=>p.chainId==='solana')
  all.sort((a,b)=>(b.pairCreatedAt??0)-(a.pairCreatedAt??0))
  const seenP=new Set(),seenA=new Set(),newP=[],stretchP=[],migratedP=[]
  for(const p of all) {
    if(seenP.has(p.pairAddress)) continue; seenP.add(p.pairAddress)
    const mcap=p.marketCap??p.fdv??0,dex=p.dexId
    if(dex==='pumpfun') {
      const addr=p.baseToken?.address; if(addr&&seenA.has(addr)) continue; if(addr) seenA.add(addr)
      if(mcap>=55000) stretchP.push(pairToToken(p,'stretch')); else if(mcap>0) newP.push(pairToToken(p,'new'))
    } else if(['pumpswap','raydium','meteora','orca'].includes(dex)) {
      if((p.liquidity?.usd??0)<500) continue; migratedP.push(pairToToken(p,'migrated'))
    }
  }
  return {newP:newP.slice(0,20),stretchP:stretchP.slice(0,20),migratedP:migratedP.slice(0,20)}
}

async function fetchRealTrades(tokenAddress, tokenMcap) {
  try {
    // Try pump.fun backend proxy first (real-time)
    const r=await fetch(`${BACKEND}/api/pump/trades/${tokenAddress}`)
    const data=await r.json()
    if(Array.isArray(data)&&data.length>0) {
      const now=Date.now()/1000
      return data.slice(0,25).map((t,i)=>({
        id:i, sig:t.signature||'', 
        age:Math.floor(now-(t.timestamp||now)),
        type:t.is_buy?'Buy':'Sell', isBuy:!!t.is_buy,
        mc:tokenMcap,
        solAmount:(t.sol_amount/1e9||0).toFixed(4),
        usdValue:((t.sol_amount/1e9||0)*cachedSolPrice).toFixed(2),
        wallet:t.user||t.traderPublicKey||'',
        source:'pump.fun'
      }))
    }
  } catch {}
  // Fallback: Helius
  try {
    const r=await fetch(`https://api.helius.xyz/v0/addresses/${tokenAddress}/transactions?api-key=${HELIUS_KEY}&limit=25&type=SWAP`)
    const txns=await r.json()
    if(!Array.isArray(txns)) return []
    const now=Date.now()/1000
    return txns.filter(t=>(t.timestamp??0)>now-86400).slice(0,20).map((t,i)=>{
      const transfers=t.tokenTransfers??[],nativeXfers=t.nativeTransfers??[]
      const tokenXfer=transfers.find(x=>x.mint===tokenAddress)
      const isBuy=tokenXfer?tokenXfer.toUserAccount===t.feePayer:true
      const sol=(nativeXfers.reduce((max,x)=>x.amount>max.amount?x:max,{amount:0}).amount)/1e9
      const age=Math.floor(now-(t.timestamp??now))
      return {id:i,sig:t.signature,age,type:isBuy?'Buy':'Sell',isBuy,mc:tokenMcap,solAmount:sol.toFixed(4),usdValue:(sol*cachedSolPrice).toFixed(2),wallet:t.feePayer||'',source:t.source||''}
    })
  } catch { return [] }
}

async function fetchRealHolders(tokenAddress) {
  try {
    const res=await fetch(HELIUS_RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getTokenAccounts',params:{mint:tokenAddress,limit:1000}})})
    const data=await res.json()
    const accounts=(data?.result?.token_accounts??[]).filter(a=>parseFloat(a.amount)>0)
    const total=accounts.reduce((s,a)=>s+parseFloat(a.amount),0)
    return {count:accounts.length,holders:accounts.slice(0,15).map((acc,i)=>({rank:i+1,wallet:acc.address,pct:((parseFloat(acc.amount)/total)*100).toFixed(2),tokens:parseFloat(acc.amount),type:i===0?'LP':''}))}
  } catch { return {count:0,holders:[]} }
}

async function fetchTopTraders(tokenAddress) {
  try {
    const r=await fetch(`${BACKEND}/api/axiom/top-traders/${tokenAddress}`)
    const data=await r.json()
    if(Array.isArray(data)&&data.length>0) {
      return data.slice(0,10).map((t,i)=>({rank:i+1,wallet:t[0]||'',buys:t[1]||0,sells:t[2]||0,solSpent:parseFloat(t[5])||0,solReceived:parseFloat(t[6])||0,pnlSol:(parseFloat(t[6])||0)-(parseFloat(t[5])||0),isProfitable:(t[6]||0)>(t[5]||0)}))
    }
    // Fallback: aggregate from Helius trades
    const res=await fetch(`https://api.helius.xyz/v0/addresses/${tokenAddress}/transactions?api-key=${HELIUS_KEY}&limit=100&type=SWAP`)
    const txns=await res.json()
    if(!Array.isArray(txns)) return []
    const traders={}
    for(const t of txns) {
      const xfers=t.tokenTransfers??[],nx=t.nativeTransfers??[]
      const tx=xfers.find(x=>x.mint===tokenAddress)
      const isBuy=tx?tx.toUserAccount===t.feePayer:true
      const sol=(nx.reduce((m,x)=>x.amount>m.amount?x:m,{amount:0}).amount)/1e9
      const w=t.feePayer||'?'
      if(!traders[w]) traders[w]={wallet:w,buys:0,sells:0,solSpent:0,solReceived:0}
      if(isBuy){traders[w].buys++;traders[w].solSpent+=sol}else{traders[w].sells++;traders[w].solReceived+=sol}
    }
    return Object.values(traders).sort((a,b)=>(b.solSpent+b.solReceived)-(a.solSpent+a.solReceived)).slice(0,10).map((t,i)=>({...t,rank:i+1,pnlSol:t.solReceived-t.solSpent,isProfitable:t.solReceived>t.solSpent}))
  } catch { return [] }
}

async function fetchAxiomTokenInfo(pairAddress) {
  try {
    const r=await fetch(`${BACKEND}/api/axiom/token-info/${pairAddress}`)
    if(!r.ok) return null
    const d=await r.json()
    if(d.error) return null
    return {numHolders:d.numHolders||0,top10HoldersPercent:d.top10HoldersPercent||0,devHoldsPercent:d.devHoldsPercent||0,insidersHoldPercent:d.insidersHoldPercent||0,bundlersHoldPercent:d.bundlersHoldPercent||0,snipersHoldPercent:d.snipersHoldPercent||0,dexPaid:d.dexPaid||false,totalPairFeesPaid:d.totalPairFeesPaid||0}
  } catch { return null }
}

export default function RadarPage() {
  const [newPairs,setNewPairs]=useState([])
  const [stretch,setStretch]=useState([])
  const [migrated,setMigrated]=useState([])
  const [selected,setSelected]=useState(null)
  const [wallet,setWallet]=useState(null)
  const [solPrice,setSolPrice]=useState(150)
  const [buyAmount,setBuyAmount]=useState('0.1')
  const [positions,setPositions]=useState([])
  const [txStatus,setTxStatus]=useState(null)
  const [txMsg,setTxMsg]=useState('')
  const [bottomTab,setBottomTab]=useState('trades')
  const [sideTab,setSideTab]=useState('buy')
  const [searchQuery,setSearchQuery]=useState('')
  const [searchResults,setSearchResults]=useState([])
  const [searching,setSearching]=useState(false)
  const [showSearch,setShowSearch]=useState(false)
  const [bubbleView,setBubbleView]=useState(0)
  const [loading,setLoading]=useState(true)
  const [holders,setHolders]=useState([])
  const [trades,setTrades]=useState([])
  const [topTraders,setTopTraders]=useState([])
  const [tokenInfo,setTokenInfo]=useState(null)
  const [pnlInSol,setPnlInSol]=useState(true)
  const [chartTimeframe,setChartTimeframe]=useState('1')
  const [chartSource,setChartSource]=useState('loading')
  const [liveConnections,setLiveConnections]=useState(0)
  const [panelHeight,setPanelHeight]=useState(240)
  const chartRef=useRef(null)
  const chartInstanceRef=useRef(null)
  const candleSeriesRef=useRef(null)
  const searchTimeout=useRef(null)
  const conn=useRef(new web3.Connection(DEVNET_RPC,'confirmed'))

  // SOL price
  useEffect(()=>{fetchSolPrice().then(p=>setSolPrice(p));const iv=setInterval(()=>fetchSolPrice().then(p=>setSolPrice(p)),30000);return()=>clearInterval(iv)},[])

  // Pump.fun WebSocket
  useEffect(()=>{
    let ws,rt
    const connect=()=>{
      try {
        ws=new WebSocket('wss://pumpportal.fun/api/data')
        ws.onopen=()=>{
          setLiveConnections(n=>n+1)
          ws.send(JSON.stringify({method:'subscribeNewToken'}))
          ws.send(JSON.stringify({method:'subscribeMigration'}))
        }
        ws.onmessage=(e)=>{
          try {
            const d=JSON.parse(e.data)
            if(d.txType==='create'&&d.mint) {
              const t={id:d.mint,symbol:d.symbol||'???',name:d.name||'New Token',address:d.mint,pairAddress:d.mint,color:COLORS[Math.abs((d.mint.charCodeAt(0)||0))%COLORS.length],price:0,marketCap:d.marketCapSol*cachedSolPrice||0,liquidity:0,volume5m:0,volume1h:0,priceChange5m:0,priceChange1h:0,buys5m:0,sells5m:0,buys1h:0,sells1h:0,age:0,bondingCurve:0,holders:0,stage:'new',logoUri:d.image||null,dexId:'pumpfun',supply:'1B',website:d.website||null,twitter:d.twitter||null,telegram:d.telegram||null,pairCreatedAt:Date.now(),source:'pumpportal'}
              setNewPairs(prev=>[t,...prev.filter(x=>x.id!==d.mint)].slice(0,20))
            } else if(d.txType==='migrate'&&d.mint) {
              setNewPairs(prev=>prev.filter(t=>t.address!==d.mint))
              setStretch(prev=>prev.filter(t=>t.address!==d.mint))
            }
          } catch {}
        }
        ws.onclose=()=>{setLiveConnections(n=>Math.max(0,n-1));rt=setTimeout(connect,3000)}
        ws.onerror=()=>ws.close()
      } catch {}
    }
    connect()
    return()=>{clearTimeout(rt);if(ws)ws.close()}
  },[])

  // Mobula WebSocket
  useEffect(()=>{
    let ws,rt,ping
    const connect=()=>{
      try {
        ws=new WebSocket(MOBULA_WS)
        ws.onopen=()=>{
          setLiveConnections(n=>n+1)
          ws.send(JSON.stringify({type:'pulse-v2',payload:{model:'default',assetMode:true,chainId:['solana:solana'],poolTypes:['pumpfun'],compressed:false}}))
          ping=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({event:'ping'}))},15000)
        }
        ws.onmessage=(e)=>{
          try {
            const msg=JSON.parse(e.data)
            if(msg.event==='pong') return
            const v2s={new:'new',bonding:'stretch',bonded:'migrated'}
            const xform=(data,view)=>{
              const t=data.token||{},mcap=data.market_cap||data.latest_market_cap||t.marketCap||0,addr=t.address||''
              return {id:addr,symbol:t.symbol||'???',name:t.name||'Unknown',address:addr,pairAddress:addr,color:COLORS[Math.abs((addr.charCodeAt(0)||0)+(addr.charCodeAt(1)||0))%COLORS.length],price:data.latest_price||t.price||0,marketCap:mcap,liquidity:t.liquidity||0,volume5m:data.volume_5min||0,volume1h:data.volume_1h||0,priceChange5m:data.price_change_5min||0,priceChange1h:data.price_change_1h||0,buys5m:data.trades_5min||0,sells5m:0,buys1h:data.buys_1h||0,sells1h:data.sells_1h||0,age:data.created_at?Date.now()-new Date(data.created_at).getTime():0,bondingCurve:t.bondingPercentage||(t.bonded?100:Math.min(99,Math.round((mcap/69000)*100))),holders:t.holdersCount||0,stage:v2s[view]||'new',logoUri:t.logo||null,dexId:v2s[view]==='migrated'?'pumpswap':'pumpfun',supply:'1B',website:data.socials?.website||null,twitter:data.socials?.twitter||null,telegram:data.socials?.telegram||null,pairCreatedAt:data.created_at?new Date(data.created_at).getTime():Date.now(),smartTraders:t.smartTradersCount||0,snipers:t.snipersCount||0,insiders:t.insidersCount||0,source:'mobula'}
            }
            if(msg.type==='init') {
              for(const [vn,vd] of Object.entries(msg.payload||{})) {
                if(!vd?.data) continue
                const stage=v2s[vn]; if(!stage) continue
                const tokens=vd.data.map(d=>xform(d,vn)).filter(t=>t.address)
                if(stage==='new') setNewPairs(prev=>{const s=new Set(prev.map(t=>t.id));return [...tokens.filter(t=>!s.has(t.id)),...prev].slice(0,20)})
                else if(stage==='stretch') setStretch(prev=>{const s=new Set(prev.map(t=>t.id));return [...tokens.filter(t=>!s.has(t.id)),...prev].slice(0,20)})
                else setMigrated(prev=>{const s=new Set(prev.map(t=>t.id));return [...tokens.filter(t=>!s.has(t.id)),...prev].slice(0,20)})
              }
            } else if(msg.type==='new-token') {
              const {viewName,token:td}=msg.payload||{}; if(!td) return
              const t=xform(td,viewName); if(!t.address) return
              const stage=v2s[viewName]
              if(stage==='new') setNewPairs(prev=>[t,...prev.filter(x=>x.id!==t.id)].slice(0,20))
              else if(stage==='stretch') setStretch(prev=>[t,...prev.filter(x=>x.id!==t.id)].slice(0,20))
              else setMigrated(prev=>[t,...prev.filter(x=>x.id!==t.id)].slice(0,20))
            } else if(msg.type==='update-token'||msg.type==='update') {
              const updates=msg.type==='update-token'?[{viewName:msg.payload?.viewName,data:msg.payload?.token}]:Object.entries(msg.payload||{}).flatMap(([vn,vd])=>(vd.data||[]).map(d=>({viewName:vn,data:d})))
              updates.forEach(({viewName,data})=>{
                if(!data) return
                const t=xform(data,viewName); if(!t.address) return
                const upd=prev=>prev.map(x=>x.id===t.id?{...x,...t}:x)
                if(v2s[viewName]==='new') setNewPairs(upd)
                else if(v2s[viewName]==='stretch') setStretch(upd)
                else setMigrated(upd)
                setSelected(s=>s?.id===t.id?{...s,...t}:s)
              })
            } else if(msg.type==='remove-token') {
              const addr=msg.payload?.token?.token?.address; if(!addr) return
              setNewPairs(prev=>prev.filter(t=>t.id!==addr))
              setStretch(prev=>prev.filter(t=>t.id!==addr))
            }
          } catch {}
        }
        ws.onclose=()=>{setLiveConnections(n=>Math.max(0,n-1));clearInterval(ping);rt=setTimeout(connect,2000)}
        ws.onerror=()=>ws.close()
      } catch {}
    }
    connect()
    return()=>{clearTimeout(rt);clearInterval(ping);if(ws)ws.close()}
  },[])

  // DexScreener fallback pairs
  const refreshPairs=useCallback(async()=>{
    const {newP,stretchP,migratedP}=await loadPairs()
    setNewPairs(prev=>{const s=new Set(prev.map(t=>t.id));return [...prev,...newP.filter(t=>!s.has(t.id))].slice(0,20)})
    setStretch(prev=>{const s=new Set(prev.map(t=>t.id));return [...prev,...stretchP.filter(t=>!s.has(t.id))].slice(0,20)})
    setMigrated(prev=>{const s=new Set(prev.map(t=>t.id));return [...prev,...migratedP.filter(t=>!s.has(t.id))].slice(0,20)})
    setLoading(false)
  },[])
  useEffect(()=>{refreshPairs();const iv=setInterval(refreshPairs,20000);return()=>clearInterval(iv)},[refreshPairs])

  // Live price update for selected token
  useEffect(()=>{
    if(!selected) return
    const iv=setInterval(async()=>{
      try {
        const r=await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${selected.pairAddress}`)
        const d=await r.json(); const p=d.pair; if(!p) return
        setSelected(s=>s?{...s,price:parseFloat(p.priceUsd??'0'),marketCap:p.marketCap??p.fdv??s.marketCap,liquidity:p.liquidity?.usd??s.liquidity,volume1h:p.volume?.h1??s.volume1h,buys1h:p.txns?.h1?.buys??s.buys1h,sells1h:p.txns?.h1?.sells??s.sells1h}:null)
      } catch {}
    },5000)
    return()=>clearInterval(iv)
  },[selected?.pairAddress])

  // Real-time chart using pump.fun backend
  useEffect(()=>{
    if(!selected||!chartRef.current) return
    let cancelled=false
    setChartSource('loading')

    const init=async()=>{
      if(!window.LightweightCharts) {
        await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)})
      }
      if(cancelled||!chartRef.current) return
      if(chartInstanceRef.current) { try{chartInstanceRef.current.remove()}catch{}; chartInstanceRef.current=null; candleSeriesRef.current=null }

      const chart=window.LightweightCharts.createChart(chartRef.current,{
        layout:{background:{color:'#050508'},textColor:'#777a8c'},
        grid:{vertLines:{color:'#1a1a2e'},horzLines:{color:'#1a1a2e'}},
        crosshair:{mode:1},
        rightPriceScale:{borderColor:'#1a1a2e',textColor:'#777a8c',minimumWidth:70},
        timeScale:{borderColor:'#1a1a2e',timeVisible:true,secondsVisible:true,barSpacing:6},
        width:chartRef.current.clientWidth,
        height:chartRef.current.clientHeight,
      })
      chartInstanceRef.current=chart
      const cs=chart.addCandlestickSeries({upColor:'#22c55e',downColor:'#ef4444',borderUpColor:'#22c55e',borderDownColor:'#ef4444',wickUpColor:'#22c55e',wickDownColor:'#ef4444'})
      candleSeriesRef.current=cs

      // Fetch candles from backend - tries pump.fun then GeckoTerminal
      const fetchCandles=async()=>{
        const r=await fetch(`${BACKEND}/api/pump/candles/${selected.address}?tf=${chartTimeframe}&limit=300`)
        const d=await r.json()
        return {candles:d.candles||[],source:d.source||'none'}
      }

      const {candles,source}=await fetchCandles()
      if(cancelled) return

      if(candles.length>0) {
        // Deduplicate and sort by time
        const seen=new Set()
        const unique=candles.filter(c=>{if(seen.has(c.time))return false;seen.add(c.time);return true}).sort((a,b)=>a.time-b.time)
        cs.setData(unique)
        chart.timeScale().fitContent()
        setChartSource(source)
      } else {
        setChartSource('nodex')
      }

      // Resize observer
      const ro=new ResizeObserver(()=>{if(chartRef.current&&chartInstanceRef.current)chartInstanceRef.current.applyOptions({width:chartRef.current.clientWidth,height:chartRef.current.clientHeight})})
      ro.observe(chartRef.current)

      // Poll new candles every 3s
      const iv=setInterval(async()=>{
        if(cancelled||!candleSeriesRef.current) return
        try {
          const {candles:fresh}=await fetchCandles()
          if(fresh.length>0&&candleSeriesRef.current) {
            const latest=fresh[fresh.length-1]
            try{candleSeriesRef.current.update(latest)}catch{}
          }
        } catch {}
      },3000)

      return ()=>{ro.disconnect();clearInterval(iv)}
    }

    init()
    return()=>{
      cancelled=true
      if(chartInstanceRef.current){try{chartInstanceRef.current.remove()}catch{};chartInstanceRef.current=null;candleSeriesRef.current=null}
    }
  },[selected?.id,chartTimeframe])

  // Trades + holders
  useEffect(()=>{
    if(!selected?.address) return
    let cancelled=false
    const load=async()=>{
      const [tData,hData,trData,tiData]=await Promise.allSettled([
        fetchRealTrades(selected.address,selected.marketCap),
        fetchRealHolders(selected.address),
        fetchTopTraders(selected.address),
        fetchAxiomTokenInfo(selected.address),
      ])
      if(cancelled) return
      if(tData.status==='fulfilled'&&tData.value.length>0) setTrades(tData.value)
      if(hData.status==='fulfilled'&&hData.value.count>0){setHolders(hData.value.holders);setSelected(s=>s?{...s,holders:hData.value.count}:null)}
      if(trData.status==='fulfilled') setTopTraders(trData.value)
      if(tiData.status==='fulfilled'&&tiData.value) setTokenInfo(tiData.value)
    }
    load()
    const iv=setInterval(()=>{if(!cancelled)fetchRealTrades(selected.address,selected.marketCap).then(t=>{if(!cancelled&&t.length>0)setTrades(t)})},6000)
    return()=>{cancelled=true;clearInterval(iv)}
  },[selected?.id])

  // Wallet
  useEffect(()=>{
    const saved=localStorage.getItem('trench_radar_wallet')
    if(!saved) return
    const data=JSON.parse(saved);setWallet(data)
    conn.current.getBalance(new web3.PublicKey(data.publicKey)).then(b=>setWallet(w=>w?{...w,balance:b/web3.LAMPORTS_PER_SOL}:null)).catch(()=>{})
  },[])

  const generateWallet=async()=>{
    const kp=web3.Keypair.generate()
    const ALPHA='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    function b58(bytes){let d=[0];for(let i=0;i<bytes.length;i++){let c=bytes[i];for(let j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=(c/58)|0}while(c>0){d.push(c%58);c=(c/58)|0}}let r='';for(let i=0;i<bytes.length&&bytes[i]===0;i++)r+='1';for(let i=d.length-1;i>=0;i--)r+=ALPHA[d[i]];return r}
    const data={publicKey:kp.publicKey.toString(),secretKey:Array.from(kp.secretKey),privateKeyBase58:b58(kp.secretKey),balance:0,network:'devnet'}
    localStorage.setItem('trench_radar_wallet',JSON.stringify(data));setWallet(data)
  }

  const airdrop=async()=>{
    if(!wallet) return;setTxStatus('pending');setTxMsg('REQUESTING...')
    for(const rpc of ['https://api.devnet.solana.com','https://rpc.ankr.com/solana_devnet']) {
      try {
        const c=new web3.Connection(rpc,{commitment:'confirmed'})
        const pk=new web3.PublicKey(wallet.publicKey)
        await c.requestAirdrop(pk,2*web3.LAMPORTS_PER_SOL);setTxMsg('CONFIRMING...')
        for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,1500));const bal=await c.getBalance(pk).catch(()=>0);if(bal>0){setWallet(w=>({...w,balance:bal/web3.LAMPORTS_PER_SOL}));setTxStatus('success');setTxMsg('2 SOL AIRDROPPED!');setTimeout(()=>{setTxStatus(null);setTxMsg('')},3000);return}}
        break
      } catch {}
    }
    setTxStatus('error');setTxMsg('USE faucet.solana.com');setTimeout(()=>{setTxStatus(null);setTxMsg('')},5000)
  }

  const buy=async()=>{
    if(!wallet||!selected) return
    const amt=parseFloat(buyAmount)
    if(isNaN(amt)||amt<=0||amt>(wallet.balance||0)){setTxStatus('error');setTxMsg('INSUFFICIENT SOL');setTimeout(()=>{setTxStatus(null);setTxMsg('')},2000);return}
    setTxStatus('pending');setTxMsg('SIMULATING BUY...')
    await new Promise(r=>setTimeout(r,800))
    const tokens=(amt/Math.max(selected.price,1e-12))*0.97
    setPositions(prev=>[{id:Math.random().toString(36).slice(2),token:{...selected},entryPrice:selected.price,tokensHeld:tokens,solSpent:amt,usdSpent:amt*solPrice,currentPrice:selected.price},...prev])
    setWallet(w=>({...w,balance:(w.balance||0)-amt}))
    setTxStatus('success');setTxMsg(`BOUGHT ${tokens.toExponential(2)} ${selected.symbol}`)
    setSideTab('sell');setTimeout(()=>{setTxStatus(null);setTxMsg('')},3000)
  }

  useEffect(()=>{
    if(!selected) return
    setPositions(prev=>prev.map(pos=>{
      if(pos.token.id!==selected.id) return pos
      const curVal=pos.tokensHeld*selected.price,pnlUsd=curVal-pos.usdSpent,pnlSol=pnlUsd/solPrice
      return {...pos,currentPrice:selected.price,pnlUsd,pnlSol,pnlPct:pos.usdSpent>0?(pnlUsd/pos.usdSpent)*100:0}
    }))
  },[selected?.price,solPrice])

  const sellPosition=(posId,pct=100)=>{
    const pos=positions.find(p=>p.id===posId);if(!pos) return
    const frac=pct/100,sol=(pos.tokensHeld*frac*pos.currentPrice)/solPrice*0.97
    setWallet(w=>({...w,balance:(w.balance||0)+sol}))
    if(pct===100) setPositions(prev=>prev.filter(p=>p.id!==posId))
    else setPositions(prev=>prev.map(p=>p.id===posId?{...p,tokensHeld:p.tokensHeld*(1-frac),solSpent:p.solSpent*(1-frac),usdSpent:p.usdSpent*(1-frac)}:p))
  }

  useEffect(()=>{
    clearTimeout(searchTimeout.current)
    if(searchQuery.length>=2) searchTimeout.current=setTimeout(async()=>{setSearching(true);try{const r=await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(searchQuery)}`);const d=await r.json();setSearchResults((d.pairs??[]).filter(p=>p.chainId==='solana').slice(0,8))}catch{setSearchResults([])};setSearching(false)},200)
    else setSearchResults([])
  },[searchQuery])

  const selectToken=(token)=>{setSelected(token);setSideTab('buy');setBottomTab('trades');setShowSearch(false);setSearchQuery('');setTokenInfo(null)}
  const pos=positions.find(p=>p.token.id===selected?.id)
  const posPnlUsd=pos?pos.pnlUsd||0:0
  const posPnlSol=pos?pos.pnlSol||0:0
  const posPnlPct=pos?pos.pnlPct||0:0

  const BubbleMap=({view,token})=>{
    const labels=['Top Holders','Dev & Insiders','Bundlers','Snipers']
    const cols=[['#22c55e','#eab308','#ef4444'],['#ef4444','#f97316'],['#3b82f6','#8b5cf6'],['#eab308','#ef4444']]
    const n=[12,6,8,7][view],seed=token?.id||'x'
    const bubbles=Array.from({length:n},(_,i)=>{const h=seed.charCodeAt(i%seed.length)||65;return{x:10+((h*137+i*89)%80),y:10+((h*71+i*53)%75),r:5+((h+i)%9),color:cols[view][(h+i)%cols[view].length],pct:((h+i*3)%15+0.5).toFixed(1)+'%'}})
    return (
      <div style={{flex:1,position:'relative',background:'#050508',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'8px',left:'10px',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c',zIndex:2}}>{labels[view]}</div>
        <svg width="100%" height="100%" viewBox="0 0 100 100" style={{position:'absolute',inset:0}}>
          {bubbles.slice(0,4).map((b,i)=>bubbles.slice(i+1,i+2).map((b2,j)=>(<line key={`l${i}${j}`} x1={b.x} y1={b.y} x2={b2.x} y2={b2.y} stroke="#1a1a2e" strokeWidth="0.3"/>)))}
          {bubbles.map((b,i)=>(<g key={i}><circle cx={b.x} cy={b.y} r={b.r} fill={b.color} opacity="0.85"/>{b.r>5&&<text x={b.x} y={b.y+1} textAnchor="middle" fontSize="2.2" fill="#050508" fontFamily="monospace" fontWeight="bold">{b.pct}</text>}</g>))}
        </svg>
      </div>
    )
  }

  // Token Card - Axiom style with real data fields
  const TokenCard=({token})=>{
    const isSel=selected?.id===token.id
    const netChange=token.priceChange1h??token.priceChange5m??0
    const mcColor=getMcColor(token.marketCap)
    const bondColor=getBondColor(token.bondingCurve)
    const buys=token.buys1h||token.buys5m||0,sells=token.sells1h||token.sells5m||0
    const total=buys+sells||1,greenPct=Math.round((buys/total)*100)
    return (
      <div onClick={()=>selectToken(token)} style={{background:isSel?'rgba(34,197,94,0.06)':'transparent',borderBottom:'1px solid #1a1a2e',padding:'12px 14px',cursor:'pointer',transition:'background 0.1s',borderLeft:isSel?'3px solid #22c55e':'3px solid transparent'}}
        onMouseEnter={e=>e.currentTarget.style.background=isSel?'rgba(34,197,94,0.06)':'rgba(255,255,255,0.02)'}
        onMouseLeave={e=>e.currentTarget.style.background=isSel?'rgba(34,197,94,0.06)':'transparent'}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'6px'}}>
          {token.logoUri?(<img src={token.logoUri} alt="" style={{width:'38px',height:'38px',borderRadius:'50%',objectFit:'cover',flexShrink:0,border:`2px solid ${token.color}33`}} onError={e=>e.target.style.display='none'}/>):(<div style={{width:'38px',height:'38px',borderRadius:'50%',background:token.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'16px',color:'#fff',flexShrink:0,border:`2px solid ${token.color}33`}}>{token.symbol[0]}</div>)}
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'2px'}}>
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'13px',color:'#fcfcfc',fontWeight:'bold'}}>{token.name}</span>
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c'}}>{token.symbol}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#22c55e'}}>{elapsed(token.age)}</span>
              {token.holders>0&&<span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#fcfcfc'}}>👤{fmtC(token.holders)}</span>}
              {(token.smartTraders||0)>0&&<span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#eab308'}}>⭐{token.smartTraders}</span>}
              {(token.snipers||0)>0&&<span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#ef4444'}}>🎯{token.snipers}</span>}
            </div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'14px',fontWeight:'bold',color:mcColor}}>{fmt(token.marketCap)}</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:netChange>=0?'#22c55e':'#ef4444',fontWeight:'bold'}}>{netChange>=0?'+':''}{netChange.toFixed(1)}%</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
              <div style={{width:'50px',height:'4px',borderRadius:'2px',overflow:'hidden',background:'#1a1a2e'}}>
                <div style={{height:'100%',width:token.bondingCurve+'%',background:bondColor,transition:'width 0.3s'}}/>
              </div>
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:bondColor}}>{token.bondingCurve}%</span>
            </div>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#38bdf8'}}>💧{fmt(token.liquidity)}</span>
            <div style={{display:'flex',alignItems:'center',gap:'2px'}}>
              <div style={{display:'flex',width:'50px',height:'4px',borderRadius:'2px',overflow:'hidden'}}>
                <div style={{background:'#22c55e',width:greenPct+'%'}}/>
                <div style={{background:'#ef4444',width:(100-greenPct)+'%'}}/>
              </div>
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#777a8c'}}>{fmtC(buys+sells)}</span>
            </div>
          </div>
          <button onClick={e=>{e.stopPropagation();selectToken(token);setSideTab('buy')}} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',fontWeight:'bold',padding:'4px 14px',background:'#22c55e',border:'none',color:'#050508',cursor:'pointer',borderRadius:'6px'}}>⚡BUY</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#050508',color:'#e0e0f0',overflow:'hidden',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"}}>
      <Nav active="/radar"/>

      {/* Toast */}
      {txStatus&&<div style={{position:'fixed',top:'64px',right:'20px',zIndex:9999,padding:'10px 18px',background:txStatus==='success'?'rgba(34,197,94,0.12)':txStatus==='error'?'rgba(239,68,68,0.12)':'rgba(10,10,16,0.98)',border:`1px solid ${txStatus==='success'?'rgba(34,197,94,0.4)':txStatus==='error'?'rgba(239,68,68,0.4)':'#1a1a2e'}`,borderRadius:'6px',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:txStatus==='success'?'#22c55e':txStatus==='error'?'#ef4444':'#777a8c',letterSpacing:'1px',boxShadow:'0 4px 20px rgba(0,0,0,0.5)'}}>
        {txStatus==='pending'?`⟳ ${txMsg}`:txStatus==='success'?`✓ ${txMsg}`:`✗ ${txMsg}`}
      </div>}

      {/* Search */}
      {showSearch&&(<div style={{position:'fixed',inset:0,zIndex:500,background:'rgba(5,5,8,0.9)',backdropFilter:'blur(6px)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'80px'}} onClick={()=>{setShowSearch(false);setSearchQuery('')}}>
        <div style={{width:'620px',background:'#0d0d14',border:'1px solid #1a1a2e',borderRadius:'12px',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.8)'}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:'10px',borderBottom:'1px solid #1a1a2e'}}>
            <span style={{color:'#777a8c',fontSize:'18px'}}>⌕</span>
            <input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Escape'&&(setShowSearch(false),setSearchQuery(''))} placeholder="Search by name, ticker, or paste contract address..." style={{flex:1,background:'transparent',border:'none',color:'#fcfcfc',fontFamily:"'Share Tech Mono',monospace",fontSize:'14px',outline:'none'}}/>
            {searching&&<span style={{color:'#777a8c',fontSize:'11px'}}>searching...</span>}
          </div>
          <div style={{maxHeight:'420px',overflowY:'auto'}}>
            {searchResults.length===0&&searchQuery.length>=2&&!searching&&<div style={{padding:'24px',textAlign:'center',color:'#777a8c',fontSize:'13px'}}>No results for "{searchQuery}"</div>}
            {searchResults.map(p=>{
              const t=pairToToken(p,['raydium','meteora','orca','pumpswap'].includes(p.dexId)?'migrated':(p.marketCap??0)>55000?'stretch':'new')
              return (
                <div key={p.pairAddress} onClick={()=>selectToken(t)} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 18px',cursor:'pointer',borderBottom:'1px solid #0d0d18'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.03)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  {p.info?.imageUrl?(<img src={p.info.imageUrl} alt="" style={{width:'40px',height:'40px',borderRadius:'50%',objectFit:'cover',flexShrink:0}} onError={e=>e.target.style.display='none'}/>):(<div style={{width:'40px',height:'40px',borderRadius:'50%',background:t.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:'bold',color:'#fff',flexShrink:0}}>{t.symbol[0]}</div>)}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px'}}>
                      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'14px',color:'#fcfcfc',fontWeight:'bold'}}>{p.baseToken?.symbol}</span>
                      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.baseToken?.name}</span>
                      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',padding:'2px 7px',background:'rgba(56,189,248,0.1)',color:'#38bdf8',border:'1px solid rgba(56,189,248,0.2)',borderRadius:'4px',flexShrink:0,marginLeft:'auto'}}>{p.dexId}</span>
                    </div>
                    <div style={{display:'flex',gap:'14px'}}>
                      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c'}}>MC {fmt(p.marketCap??p.fdv)}</span>
                      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c'}}>Vol {fmt(p.volume?.h24)}</span>
                      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:(p.priceChange?.h24??0)>=0?'#22c55e':'#ef4444'}}>{(p.priceChange?.h24??0)>=0?'+':''}{(p.priceChange?.h24??0).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>)}

      <div style={{display:'flex',flex:1,overflow:'hidden',marginTop:'52px'}}>
        {!selected?(
          // ── FEED VIEW ──────────────────────────────────────────
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'10px 16px',borderBottom:'1px solid #1a1a2e',background:'#070710',display:'flex',alignItems:'center',gap:'12px',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
                <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#ef4444',animation:'rp 1s infinite',boxShadow:'0 0 8px #ef444488'}}/>
                <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'20px',letterSpacing:'4px',color:'#fcfcfc'}}>RADAR</span>
              </div>
              <div onClick={()=>setShowSearch(true)} style={{flex:1,display:'flex',alignItems:'center',gap:'10px',background:'#0d0d14',border:'1px solid #1a1a2e',padding:'8px 14px',cursor:'text',borderRadius:'8px',transition:'border-color 0.15s'}} onMouseEnter={e=>e.currentTarget.style.borderColor='#3a3a5c'} onMouseLeave={e=>e.currentTarget.style.borderColor='#1a1a2e'}>
                <span style={{color:'#777a8c',fontSize:'14px'}}>⌕</span>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#777a8c'}}>Search by name, ticker, or paste contract address...</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                  <div style={{width:'7px',height:'7px',borderRadius:'50%',background:liveConnections>0?'#22c55e':'#ef4444',boxShadow:liveConnections>0?'0 0 6px #22c55e88':undefined}}/>
                  <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:liveConnections>0?'#22c55e':'#ef4444'}}>{liveConnections>0?`LIVE x${liveConnections}`:'OFFLINE'}</span>
                </div>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c'}}>◎${solPrice.toFixed(0)}</span>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c'}}>{newPairs.length+stretch.length+migrated.length} pairs</span>
              </div>
            </div>
            <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',overflow:'hidden'}}>
              {[
                {label:'NEW PAIRS',color:'#22c55e',tokens:newPairs,desc:'Pump.fun bonding curve · Pre-migration'},
                {label:'FINAL STRETCH',color:'#eab308',tokens:stretch,desc:'Near $69K graduation'},
                {label:'MIGRATED',color:'#38bdf8',tokens:migrated,desc:'PumpSwap/Raydium · Graduated'},
              ].map((col,ci)=>(
                <div key={col.label} style={{display:'flex',flexDirection:'column',overflow:'hidden',borderRight:ci<2?'1px solid #1a1a2e':'none'}}>
                  <div style={{padding:'10px 14px',borderBottom:'1px solid #1a1a2e',background:'#050508',flexShrink:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'2px'}}>
                      <div style={{width:'6px',height:'6px',borderRadius:'50%',background:col.color,animation:ci===0?'rp 1.5s infinite':'none'}}/>
                      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'15px',letterSpacing:'3px',color:col.color}}>{col.label}</span>
                      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c',marginLeft:'auto'}}>{col.tokens.length}</span>
                    </div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c'}}>{col.desc}</div>
                  </div>
                  <div style={{flex:1,overflowY:'auto'}}>
                    {loading&&col.tokens.length===0?<div style={{padding:'48px',textAlign:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c',letterSpacing:'2px'}}>SCANNING...</div>
                    :col.tokens.length===0?<div style={{padding:'48px',textAlign:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#1a1a2e'}}>NO PAIRS</div>
                    :col.tokens.map(t=><TokenCard key={t.id} token={t}/>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ):(
          // ── TOKEN DETAIL VIEW ──────────────────────────────────
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Top bar */}
            <div style={{padding:'8px 14px',borderBottom:'1px solid #1a1a2e',background:'#070710',display:'flex',alignItems:'center',gap:'10px',flexShrink:0,overflowX:'auto'}}>
              <button onClick={()=>setSelected(null)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c',background:'#0d0d14',border:'1px solid #1a1a2e',padding:'5px 10px',cursor:'pointer',borderRadius:'6px',flexShrink:0}}>← BACK</button>
              {selected.logoUri?(<img src={selected.logoUri} alt="" style={{width:'26px',height:'26px',borderRadius:'50%',objectFit:'cover',flexShrink:0}} onError={e=>e.target.style.display='none'}/>):(<div style={{width:'26px',height:'26px',borderRadius:'50%',background:selected.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',color:'#fff',flexShrink:0}}>{selected.symbol[0]}</div>)}
              <button onClick={()=>{navigator.clipboard.writeText(selected.address);setTxMsg('CA COPIED');setTxStatus('success');setTimeout(()=>{setTxStatus(null);setTxMsg('')},1500)}} style={{background:'none',border:'none',cursor:'pointer',flexShrink:0,textAlign:'left',padding:0}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'16px',letterSpacing:'2px',color:'#fcfcfc',lineHeight:1}}>${selected.symbol}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#777a8c'}}>click to copy CA</div>
              </button>
              <div style={{display:'flex',gap:'5px',flexShrink:0}}>
                {selected.website&&<a href={selected.website} target="_blank" rel="noreferrer" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c',border:'1px solid #1a1a2e',padding:'3px 8px',textDecoration:'none',borderRadius:'4px'}}>WEB</a>}
                {selected.twitter&&<a href={selected.twitter} target="_blank" rel="noreferrer" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c',border:'1px solid #1a1a2e',padding:'3px 8px',textDecoration:'none',borderRadius:'4px'}}>𝕏</a>}
                {selected.telegram&&<a href={selected.telegram} target="_blank" rel="noreferrer" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c',border:'1px solid #1a1a2e',padding:'3px 8px',textDecoration:'none',borderRadius:'4px'}}>TG</a>}
                <a href={`https://pump.fun/${selected.address}`} target="_blank" rel="noreferrer" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#f97316',border:'1px solid rgba(249,115,22,0.3)',padding:'3px 8px',textDecoration:'none',borderRadius:'4px'}}>pump</a>
              </div>
              <div style={{display:'flex',gap:'16px',marginLeft:'4px'}}>
                {[['PRICE',`$${selected.price.toExponential(2)}`,'#fcfcfc'],['MCAP',fmt(selected.marketCap),'#eab308'],['LIQ',fmt(selected.liquidity),'#38bdf8'],['B.CURVE',`${selected.bondingCurve}%`,getBondColor(selected.bondingCurve)],['1H VOL',fmt(selected.volume1h),'#fcfcfc'],['BUYS',selected.buys1h,'#22c55e'],['SELLS',selected.sells1h,'#ef4444'],['FEES',`◎${(selected.marketCap/1e6*0.001).toFixed(3)}`,'#a78bfa']].map(([l,v,c])=>(
                  <div key={l} style={{flexShrink:0}}>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#777a8c',letterSpacing:'1px',marginBottom:'1px'}}>{l}</div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'13px',color:c,fontWeight:'bold'}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{marginLeft:'auto',flexShrink:0}}>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#9945FF',border:'1px solid rgba(153,69,255,0.3)',padding:'4px 8px',borderRadius:'4px'}}>◎${solPrice.toFixed(0)}</span>
              </div>
            </div>

            <div style={{flex:1,display:'flex',overflow:'hidden'}}>
              {/* Chart column */}
              <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                {/* Timeframe bar */}
                <div style={{display:'flex',gap:'2px',padding:'6px 10px',background:'#070710',borderBottom:'1px solid #1a1a2e',alignItems:'center',flexShrink:0}}>
                  {[['1','1m'],['5','5m'],['15','15m'],['60','1h'],['240','4h']].map(([tf,label])=>(
                    <button key={tf} onClick={()=>setChartTimeframe(tf)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',padding:'4px 10px',background:chartTimeframe===tf?'#1a1a2e':'transparent',border:chartTimeframe===tf?'1px solid #3a3a5c':'1px solid transparent',color:chartTimeframe===tf?'#fcfcfc':'#777a8c',cursor:'pointer',borderRadius:'4px'}}>{label}</button>
                  ))}
                  <div style={{marginLeft:'auto',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:chartSource==='pump-v1'||chartSource==='pumpportal'?'#22c55e':chartSource==='geckoterminal'?'#eab308':chartSource==='loading'?'#777a8c':'#ef4444'}}>
                    {chartSource==='pump-v1'?'● Pump V1 · Real-time':chartSource==='pumpportal'?'● Pump Portal · Real-time':chartSource==='geckoterminal'?'● GeckoTerminal':chartSource==='loading'?'⟳ Loading...':'● No chart data'}
                  </div>
                </div>
                {/* Chart */}
                {chartSource==='nodex'?(
                  <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#050508',gap:'12px'}}>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'13px',color:'#777a8c'}}>No chart data available yet</div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#3a3a5c'}}>Token may be too new — check pump.fun directly</div>
                    <a href={`https://pump.fun/${selected.address}`} target="_blank" rel="noreferrer" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#f97316',border:'1px solid rgba(249,115,22,0.3)',padding:'6px 14px',textDecoration:'none',borderRadius:'6px'}}>View on Pump.fun ↗</a>
                  </div>
                ):(
                  <div ref={chartRef} style={{flex:1,width:'100%'}}/>
                )}

                {/* Draggable bottom panel */}
                <div style={{height:panelHeight+'px',borderTop:'1px solid #1a1a2e',flexShrink:0,display:'flex',flexDirection:'column',position:'relative'}}>
                  {/* Drag handle */}
                  <div onMouseDown={e=>{e.preventDefault();const sY=e.clientY,sH=panelHeight;const mv=e=>setPanelHeight(Math.max(160,Math.min(550,sH+(sY-e.clientY))));const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up)};document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up)}} style={{position:'absolute',top:0,left:0,right:0,height:'6px',cursor:'ns-resize',zIndex:10}} onMouseEnter={e=>e.target.style.background='rgba(34,197,94,0.2)'} onMouseLeave={e=>e.target.style.background='transparent'}/>
                  {/* Tabs */}
                  <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',background:'#070710',flexShrink:0,alignItems:'center'}}>
                    {[['trades','TRADES'],['positions','POSITIONS'],['holders','HOLDERS'+(selected.holders>0?` (${selected.holders})`:'')],['top_traders','TOP TRADERS'],['dev_tokens','DEV TOKENS']].map(([v,l])=>(
                      <button key={v} onClick={()=>setBottomTab(v)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'1px',padding:'8px 12px',background:'none',border:'none',borderBottom:`2px solid ${bottomTab===v?'#22c55e':'transparent'}`,color:bottomTab===v?'#22c55e':'#777a8c',cursor:'pointer',whiteSpace:'nowrap'}}>{l}</button>
                    ))}
                    <div style={{marginLeft:'auto',padding:'0 10px'}}>
                      <button style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',padding:'4px 10px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',cursor:'pointer',borderRadius:'4px'}}>⚡ INSTANT TRADE</button>
                    </div>
                  </div>
                  <div style={{flex:1,overflow:'hidden',display:'flex'}}>
                    {/* TRADES */}
                    {bottomTab==='trades'&&(
                      <div style={{flex:1,overflowY:'auto'}}>
                        <div style={{display:'grid',gridTemplateColumns:'50px 55px 90px 90px 95px 1fr',padding:'4px 14px',background:'#070710',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c',position:'sticky',top:0,borderBottom:'1px solid #0d0d18',letterSpacing:'0.5px'}}>
                          <span>AGE</span><span>TYPE</span><span>SOL</span><span>USD</span><span>SOURCE</span><span>WALLET</span>
                        </div>
                        {trades.length===0?<div style={{padding:'24px',textAlign:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#777a8c'}}>Loading trades...</div>
                        :trades.map(t=>(
                          <div key={t.id} style={{display:'grid',gridTemplateColumns:'50px 55px 90px 95px 95px 1fr',padding:'6px 14px',borderBottom:'1px solid #0a0a0f',alignItems:'center',background:t.isBuy?'rgba(34,197,94,0.02)':'rgba(239,68,68,0.02)'}}>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c'}}>{typeof t.age==='number'?t.age<60?`${t.age}s`:t.age<3600?`${Math.floor(t.age/60)}m`:`${Math.floor(t.age/3600)}h`:t.age}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:t.isBuy?'#22c55e':'#ef4444',fontWeight:'bold'}}>{t.type}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#fcfcfc'}}>◎{t.solAmount}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:t.isBuy?'#22c55e':'#ef4444',fontWeight:'bold'}}>${t.usdValue}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#777a8c'}}>{t.source}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c',overflow:'hidden',textOverflow:'ellipsis'}}>{tr(t.wallet,5)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* HOLDERS */}
                    {bottomTab==='holders'&&(
                      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
                        <div style={{flex:1,overflowY:'auto'}}>
                          <div style={{display:'grid',gridTemplateColumns:'30px 160px 100px 80px 60px',padding:'4px 14px',background:'#070710',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c',position:'sticky',top:0,borderBottom:'1px solid #0d0d18'}}>
                            <span>#</span><span>WALLET</span><span>TOKENS</span><span>% HELD</span><span>TYPE</span>
                          </div>
                          {holders.length===0?<div style={{padding:'24px',textAlign:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#777a8c'}}>Loading...</div>
                          :holders.map((h,i)=>(
                            <div key={i} style={{display:'grid',gridTemplateColumns:'30px 160px 100px 80px 60px',padding:'7px 14px',borderBottom:'1px solid #0a0a0f',alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.background='#0a0a10'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c'}}>{h.rank}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tr(h.wallet,6)}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#fcfcfc'}}>{h.tokens>1e9?(h.tokens/1e9).toFixed(1)+'B':h.tokens>1e6?(h.tokens/1e6).toFixed(1)+'M':(h.tokens/1e3).toFixed(0)+'K'}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#eab308',fontWeight:'bold'}}>{h.pct}%</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:h.type==='LP'?'#38bdf8':'#ef4444'}}>{h.type}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{width:'200px',flexShrink:0,borderLeft:'1px solid #1a1a2e',display:'flex',flexDirection:'column'}}>
                          <div style={{padding:'6px',borderBottom:'1px solid #1a1a2e',display:'flex',gap:'4px',flexWrap:'wrap',background:'#070710'}}>
                            {['Top','Dev','Bundlers','Snipers'].map((v,i)=>(<button key={v} onClick={()=>setBubbleView(i)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',padding:'3px 7px',background:bubbleView===i?'rgba(34,197,94,0.1)':'transparent',border:`1px solid ${bubbleView===i?'rgba(34,197,94,0.3)':'#1a1a2e'}`,color:bubbleView===i?'#22c55e':'#777a8c',cursor:'pointer',borderRadius:'4px'}}>{v}</button>))}
                          </div>
                          <div style={{flex:1,position:'relative'}}><BubbleMap view={bubbleView} token={selected}/></div>
                        </div>
                      </div>
                    )}
                    {/* TOP TRADERS */}
                    {bottomTab==='top_traders'&&(
                      <div style={{flex:1,overflowY:'auto'}}>
                        <div style={{display:'grid',gridTemplateColumns:'30px 160px 90px 90px 100px 60px',padding:'4px 14px',background:'#070710',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c',position:'sticky',top:0,borderBottom:'1px solid #0d0d18'}}>
                          <span>#</span><span>WALLET</span><span>◎ IN</span><span>◎ OUT</span><span>PNL</span><span>TXS</span>
                        </div>
                        {topTraders.length===0?<div style={{padding:'24px',textAlign:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#777a8c'}}>Loading top traders...</div>
                        :topTraders.map(t=>(
                          <div key={t.rank} style={{display:'grid',gridTemplateColumns:'30px 160px 90px 90px 100px 60px',padding:'7px 14px',borderBottom:'1px solid #0a0a0f',alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.background='#0a0a10'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c'}}>{t.rank}</span>
                            <button onClick={()=>navigator.clipboard.writeText(t.wallet)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c',background:'none',border:'none',cursor:'pointer',textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tr(t.wallet,6)}</button>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#22c55e'}}>{fmtSol(t.solSpent)}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#ef4444'}}>{fmtSol(t.solReceived)}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:t.isProfitable?'#22c55e':'#ef4444',fontWeight:'bold'}}>{t.isProfitable?'+':''}{fmtSol(t.pnlSol)}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c'}}>{(t.buys||0)+(t.sells||0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {bottomTab==='dev_tokens'&&<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#1a1a2e'}}>DEV TOKEN HISTORY COMING SOON</div>}
                    {bottomTab==='positions'&&(
                      <div style={{flex:1,overflowY:'auto',padding:'12px'}}>
                        {positions.length===0?<div style={{textAlign:'center',padding:'24px',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#777a8c'}}>NO OPEN POSITIONS</div>
                        :positions.map(p=>{const pnlU=p.tokensHeld*p.currentPrice-p.usdSpent,pnlS=pnlU/solPrice,pnlPc=p.usdSpent>0?(pnlU/p.usdSpent)*100:0;return(
                          <div key={p.id} style={{background:'#0d0d14',border:`1px solid ${pnlU>=0?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}`,padding:'12px',marginBottom:'8px',borderRadius:'8px'}}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'13px',fontWeight:'bold'}}>${p.token.symbol}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'13px',color:pnlU>=0?'#22c55e':'#ef4444',fontWeight:'bold'}}>{pnlU>=0?'+':''}{pnlPc.toFixed(1)}%</span>
                            </div>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c'}}>{fmtSol(p.solSpent)} spent</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:pnlU>=0?'#22c55e':'#ef4444'}}>{pnlU>=0?'+':''}{fmtSol(pnlS)} / ${pnlU.toFixed(2)}</span>
                            </div>
                            <button onClick={()=>sellPosition(p.id,100)} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#ef4444',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',padding:'6px',cursor:'pointer',borderRadius:'6px'}}>SELL ALL</button>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right panel */}
              <div style={{width:'270px',flexShrink:0,display:'flex',flexDirection:'column',borderLeft:'1px solid #1a1a2e',overflow:'hidden'}}>
                <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',flexShrink:0}}>
                  {[['buy','BUY','#22c55e'],['sell','SELL','#ef4444']].map(([v,l,c])=>(<button key={v} onClick={()=>setSideTab(v)} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'13px',letterSpacing:'2px',padding:'12px',background:sideTab===v?`rgba(${v==='buy'?'34,197,94':'239,68,68'},0.08)`:'transparent',border:'none',borderBottom:`2px solid ${sideTab===v?c:'transparent'}`,color:sideTab===v?c:'#777a8c',cursor:'pointer',fontWeight:'bold'}}>{l}</button>))}
                </div>
                <div style={{flex:1,overflowY:'auto',padding:'14px'}}>
                  {sideTab==='buy'&&(
                    <div>
                      {!wallet?(
                        <button onClick={generateWallet} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',letterSpacing:'2px',color:'#050508',background:'#22c55e',border:'none',padding:'12px',cursor:'pointer',marginBottom:'12px',borderRadius:'8px',fontWeight:'bold'}}>⚡ GENERATE DEVNET WALLET</button>
                      ):(
                        <div style={{background:'#0d0d14',border:'1px solid #1a1a2e',padding:'12px',marginBottom:'12px',borderRadius:'8px'}}>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c',marginBottom:'4px'}}>DEVNET WALLET</div>
                          <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px'}}>
                            <span style={{color:'#9945FF',fontSize:'16px'}}>◎</span>
                            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'28px',color:'#22c55e',letterSpacing:'2px',lineHeight:1}}>{(wallet.balance||0).toFixed(4)}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c'}}>SOL</span>
                          </div>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c',marginBottom:'4px'}}>{tr(wallet.publicKey,8)}</div>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',marginBottom:'8px',wordBreak:'break-all'}}>PK: {wallet.privateKeyBase58?.slice(0,18)}...</div>
                          <button onClick={airdrop} disabled={txStatus==='pending'} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#eab308',background:'rgba(234,179,8,0.06)',border:'1px solid rgba(234,179,8,0.25)',padding:'6px',cursor:'pointer',borderRadius:'6px'}}>🪂 AIRDROP 2 SOL FREE</button>
                        </div>
                      )}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'8px'}}>
                        {['0.05','0.1','0.5','1'].map(amt=>(<button key={amt} onClick={()=>setBuyAmount(amt)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',padding:'8px',background:buyAmount===amt?'rgba(34,197,94,0.12)':'#0d0d14',border:`1px solid ${buyAmount===amt?'rgba(34,197,94,0.4)':'#1a1a2e'}`,color:buyAmount===amt?'#22c55e':'#777a8c',cursor:'pointer',borderRadius:'6px',fontWeight:buyAmount===amt?'bold':'normal'}}>◎{amt}</button>))}
                      </div>
                      <div style={{display:'flex',marginBottom:'6px',borderRadius:'8px',overflow:'hidden',border:'1px solid #1a1a2e'}}>
                        <input value={buyAmount} onChange={e=>setBuyAmount(e.target.value)} style={{flex:1,background:'#0d0d14',border:'none',color:'#fcfcfc',fontFamily:"'Share Tech Mono',monospace",fontSize:'14px',padding:'10px 12px',outline:'none'}}/>
                        <div style={{background:'#070710',padding:'10px 12px',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#9945FF',fontWeight:'bold'}}>◎ SOL</div>
                      </div>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c',marginBottom:'12px'}}>≈ ${(parseFloat(buyAmount||0)*solPrice).toFixed(2)} USD</div>
                      <button onClick={buy} disabled={!wallet||txStatus==='pending'} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'14px',letterSpacing:'2px',color:'#050508',background:!wallet?'#1a1a2e':'#22c55e',border:'none',padding:'13px',cursor:wallet?'pointer':'not-allowed',borderRadius:'8px',marginBottom:'12px',fontWeight:'bold'}}>
                        {txStatus==='pending'?txMsg:'BUY'}
                      </button>
                      {/* PNL */}
                      {pos&&(
                        <div style={{borderTop:'1px solid #1a1a2e',paddingTop:'12px',marginBottom:'12px'}}>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'8px'}}>
                            {[['Bought',`◎${pos.solSpent.toFixed(4)}`,'#777a8c'],['Sold','◎0','#777a8c'],['Holding',`$${(pos.tokensHeld*(selected?.price??0)).toFixed(2)}`,'#fcfcfc'],['PnL',pnlInSol?`◎${posPnlSol.toFixed(4)}`:`$${posPnlUsd.toFixed(2)}`,posPnlUsd>=0?'#22c55e':'#ef4444']].map(([l,v,c])=>(
                              <div key={l} style={{background:'#0d0d14',border:'1px solid #1a1a2e',padding:'8px',textAlign:'center',borderRadius:'6px'}}>
                                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#777a8c',marginBottom:'3px'}}>{l}</div>
                                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:c,fontWeight:'bold'}}>{v}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{textAlign:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'18px',color:posPnlUsd>=0?'#22c55e':'#ef4444',fontWeight:'bold',marginBottom:'6px'}}>{posPnlUsd>=0?'+':''}{posPnlPct.toFixed(2)}%</div>
                          <button onClick={()=>setPnlInSol(s=>!s)} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c',background:'#0d0d14',border:'1px solid #1a1a2e',padding:'5px',cursor:'pointer',borderRadius:'6px',marginBottom:'6px'}}>SHOW IN {pnlInSol?'USD ($)':'SOL (◎)'}</button>
                        </div>
                      )}
                      {/* Token security info */}
                      <div style={{borderTop:'1px solid #1a1a2e',paddingTop:'12px'}}>
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c',marginBottom:'10px',letterSpacing:'1px'}}>TOKEN INFO {tokenInfo?'✓':''}</div>
                        {tokenInfo?(
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'5px',marginBottom:'10px'}}>
                            {[
                              ['Top 10 H.',tokenInfo.top10HoldersPercent.toFixed(1)+'%',tokenInfo.top10HoldersPercent>20?'#ef4444':'#22c55e'],
                              ['Dev H.',tokenInfo.devHoldsPercent.toFixed(1)+'%',tokenInfo.devHoldsPercent>5?'#ef4444':'#22c55e'],
                              ['Snipers',tokenInfo.snipersHoldPercent.toFixed(1)+'%',tokenInfo.snipersHoldPercent>5?'#ef4444':'#22c55e'],
                              ['Insiders',tokenInfo.insidersHoldPercent.toFixed(1)+'%',tokenInfo.insidersHoldPercent>10?'#ef4444':'#22c55e'],
                              ['Bundlers',tokenInfo.bundlersHoldPercent.toFixed(1)+'%',tokenInfo.bundlersHoldPercent>5?'#f97316':'#22c55e'],
                              ['Dex Paid',tokenInfo.dexPaid?'YES':'NO',tokenInfo.dexPaid?'#22c55e':'#ef4444'],
                              ['Holders',tokenInfo.numHolders,'#fcfcfc'],
                              ['Fees ◎',tokenInfo.totalPairFeesPaid.toFixed(3),'#a78bfa'],
                            ].map(([l,v,c])=>(
                              <div key={l} style={{background:'#0d0d14',border:'1px solid #1a1a2e',padding:'6px',textAlign:'center',borderRadius:'6px'}}>
                                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#777a8c',marginBottom:'2px'}}>{l}</div>
                                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:c,fontWeight:'bold'}}>{v}</div>
                              </div>
                            ))}
                          </div>
                        ):(
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#3a3a5c',textAlign:'center',padding:'12px'}}>Loading security data...</div>
                        )}
                        <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                          {[['Market Cap',fmt(selected.marketCap)],['Liquidity',fmt(selected.liquidity)],['Bonding',`${selected.bondingCurve}%`],['Age',elapsed(selected.age)]].map(([k,v])=>(
                            <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #0d0d18'}}>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c'}}>{k}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#fcfcfc',fontWeight:'bold'}}>{v}</span>
                            </div>
                          ))}
                        </div>
                        <button onClick={()=>{navigator.clipboard.writeText(selected.address);setTxMsg('CA COPIED');setTxStatus('success');setTimeout(()=>{setTxStatus(null);setTxMsg('')},1500)}} style={{width:'100%',marginTop:'10px',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#777a8c',background:'#0d0d14',border:'1px solid #1a1a2e',padding:'8px',cursor:'pointer',textAlign:'left',borderRadius:'6px',wordBreak:'break-all'}}>⎘ {selected.address.slice(0,26)}...</button>
                      </div>
                    </div>
                  )}
                  {sideTab==='sell'&&(
                    <div>
                      {!pos?(<div style={{textAlign:'center',padding:'40px',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#777a8c'}}>NO POSITION<br/><span style={{fontSize:'10px',color:'#3a3a5c'}}>BUY FIRST</span></div>):(
                        <div>
                          <div style={{background:'#0d0d14',border:'1px solid #1a1a2e',padding:'14px',marginBottom:'12px',borderRadius:'8px'}}>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#777a8c',marginBottom:'6px'}}>CURRENT POSITION</div>
                            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'32px',color:posPnlUsd>=0?'#22c55e':'#ef4444',letterSpacing:'2px',marginBottom:'4px'}}>{posPnlUsd>=0?'+':''}{posPnlPct.toFixed(2)}%</div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#777a8c',marginBottom:'2px'}}>{fmtSol(pos.solSpent)} in · {posPnlUsd>=0?'+':''}{fmtSol(posPnlSol)} PNL</div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#777a8c'}}>${pos.usdSpent.toFixed(2)} in · ${posPnlUsd.toFixed(2)} PNL</div>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'10px'}}>
                            {['25','50','75','100'].map(pct=>(<button key={pct} onClick={()=>sellPosition(pos.id,parseInt(pct))} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',padding:'10px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',cursor:'pointer',borderRadius:'6px',fontWeight:'bold'}}>SELL {pct}%</button>))}
                          </div>
                          <button onClick={()=>sellPosition(pos.id,100)} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'14px',letterSpacing:'2px',color:'#fff',background:'#ef4444',border:'none',padding:'13px',cursor:'pointer',borderRadius:'8px',fontWeight:'bold'}}>SELL ALL</button>
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
      <style>{`@keyframes rp{0%,100%{opacity:1}50%{opacity:0.3}} ::-webkit-scrollbar{width:4px;height:4px} ::-webkit-scrollbar-track{background:#050508} ::-webkit-scrollbar-thumb{background:#1a1a2e;border-radius:2px} ::-webkit-scrollbar-thumb:hover{background:#3a3a5c}`}</style>
    </div>
  )
}
