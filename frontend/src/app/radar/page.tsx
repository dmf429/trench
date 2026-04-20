// @ts-nocheck
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from '../../components/Sidebar'
import * as web3 from '@solana/web3.js'

const BACKEND = 'https://trench-production-cd7b.up.railway.app'
const HELIUS_KEY = '870dfde6-09ec-48bd-95b8-202303d15c5b'
const MOBULA_KEY = '0c618a08-8d56-430f-a814-80ab2142fe7f'
const DEVNET_RPC = 'https://api.devnet.solana.com'
let cachedSolPrice = 150

// ── Design tokens (Nexus Capital style) ─────────────────────────────────
const C = {
  bg:      '#0a0b10',
  bg2:     '#0f1117',
  bg3:     '#161b24',
  bg4:     '#1c2230',
  bg5:     '#222a38',
  text1:   '#ffffff',
  text2:   'rgba(255,255,255,0.5)',
  text3:   'rgba(255,255,255,0.25)',
  accent:  '#00ff88',
  accent2: '#00cc6a',
  blue:    '#4d9fff',
  red:     '#ff4757',
  yellow:  '#ffd32a',
  purple:  '#a55eea',
  orange:  '#ff6b35',
  border:  'rgba(255,255,255,0.06)',
  border2: 'rgba(255,255,255,0.1)',
  glow:    'rgba(0,255,136,0.15)',
}

const glass = (glow=false) => ({
  background: C.bg3,
  border: `1px solid ${glow ? 'rgba(0,255,136,0.2)' : C.border}`,
  borderRadius: '12px',
  boxShadow: glow ? `0 0 24px rgba(0,255,136,0.08), inset 0 1px 0 rgba(255,255,255,0.05)` : `inset 0 1px 0 rgba(255,255,255,0.04)`,
})

// ── Formatters ───────────────────────────────────────────────────────────
const fmt = (n) => {
  if (!n || n===0) return '$0'
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n/1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}
const fmtV = (n) => {
  if (!n || n===0) return '$0'
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n/1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}
const fmtSol = (n) => !n ? '0◎' : n < 0.001 ? `${n.toFixed(5)}◎` : `${n.toFixed(4)}◎`
const elapsed = (ts) => {
  if (!ts) return '?'
  const s = Math.floor((Date.now()-ts)/1000)
  if (s < 2) return 'now'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s/60)}m`
  if (s < 86400) return `${Math.floor(s/3600)}h`
  return `${Math.floor(s/86400)}d`
}
const tr = (a, n=4) => a ? `${a.slice(0,n)}...${a.slice(-n)}` : ''
const COLORS = ['#00ff88','#4d9fff','#a55eea','#ff6b35','#ffd32a','#ff4757','#00d2d3','#ff9ff3','#54a0ff','#5f27cd']
const tokenColor = (addr) => COLORS[Math.abs((addr?.charCodeAt(0)||0)+(addr?.charCodeAt(1)||0))%COLORS.length]

// ── DexScreener data ─────────────────────────────────────────────────────
async function fetchSolPrice() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
    cachedSolPrice = (await r.json())?.solana?.usd ?? 150
  } catch {}
  return cachedSolPrice
}

function pairToToken(p, stage) {
  const mcap = p.marketCap ?? p.fdv ?? 0
  const addr = p.baseToken?.address ?? p.pairAddress ?? ''
  const bc = p.dexId === 'pumpfun' ? Math.min(99, Math.round((mcap/69000)*100)) : 100
  return {
    id: p.pairAddress||addr, symbol: p.baseToken?.symbol ?? '???',
    name: p.baseToken?.name ?? 'Unknown', address: addr,
    pairAddress: p.pairAddress, color: tokenColor(addr),
    price: parseFloat(p.priceUsd??'0'), marketCap: mcap,
    liquidity: p.liquidity?.usd??0, volume5m: p.volume?.m5??0,
    volume1h: p.volume?.h1??0, priceChange5m: p.priceChange?.m5??0,
    priceChange1h: p.priceChange?.h1??0,
    buys5m: p.txns?.m5?.buys??0, sells5m: p.txns?.m5?.sells??0,
    buys1h: p.txns?.h1?.buys??0, sells1h: p.txns?.h1?.sells??0,
    age: Date.now()-(p.pairCreatedAt??Date.now()), bondingCurve: bc,
    holders:0, stage, logoUri: p.info?.imageUrl??null, dexId: p.dexId??'',
    website:p.info?.websites?.[0]?.url??null,
    twitter:p.info?.socials?.find(s=>s.type==='twitter')?.url??null,
    telegram:p.info?.socials?.find(s=>s.type==='telegram')?.url??null,
    pairCreatedAt:p.pairCreatedAt, source:'dexscreener',
    smartTraders:0, snipers:0, insiders:0, freshTraders:0,
  }
}

async function loadPairs() {
  const searches = ['pumpfun solana','pump.fun new','pumpswap solana','solana meme new']
  const results = await Promise.allSettled(searches.map(q =>
    fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`).then(r=>r.json()).catch(()=>({pairs:[]}))
  ))
  const all = results.flatMap(r => r.status==='fulfilled' ? (r.value.pairs??[]) : [])
    .filter(p => p.chainId==='solana')
  all.sort((a,b) => (b.pairCreatedAt??0)-(a.pairCreatedAt??0))

  const seenP=new Set(), seenA=new Set()
  const newP=[], stretchP=[], migratedP=[]

  for (const p of all) {
    if (seenP.has(p.pairAddress)) continue
    seenP.add(p.pairAddress)
    const mcap = p.marketCap??p.fdv??0
    const dex = p.dexId??''

    if (dex==='pumpfun') {
      const addr = p.baseToken?.address
      if (addr && seenA.has(addr)) continue
      if (addr) seenA.add(addr)
      if (mcap >= 50000) stretchP.push(pairToToken(p,'stretch'))
      else newP.push(pairToToken(p,'new'))
    } else if (['pumpswap','raydium','meteora','orca'].includes(dex)) {
      if ((p.liquidity?.usd??0) < 1000) continue
      migratedP.push(pairToToken(p,'migrated'))
    }
  }
  return { newP: newP.slice(0,20), stretchP: stretchP.slice(0,20), migratedP: migratedP.slice(0,20) }
}

// ── Chart via DexScreener embed ──────────────────────────────────────────
function TradingChart({token, chartTf, setChartTf, chartSource, setChartSource}) {
  const chartRef = useRef(null)
  const chartInstance = useRef(null)
  const candleSeries = useRef(null)

  useEffect(() => {
    if (!token || !chartRef.current) return
    let cancelled = false
    setChartSource('loading')

    const init = async () => {
      if (!window.LightweightCharts) {
        await new Promise((res,rej) => {
          const s = document.createElement('script')
          s.src = 'https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js'
          s.onload=res; s.onerror=rej; document.head.appendChild(s)
        })
      }
      if (cancelled||!chartRef.current) return
      if (chartInstance.current) { try{chartInstance.current.remove()}catch{}; chartInstance.current=null; candleSeries.current=null }

      const chart = window.LightweightCharts.createChart(chartRef.current, {
        layout:{background:{color:'transparent'},textColor:'rgba(255,255,255,0.4)'},
        grid:{vertLines:{color:'rgba(255,255,255,0.04)'},horzLines:{color:'rgba(255,255,255,0.04)'}},
        crosshair:{mode:1},
        rightPriceScale:{borderColor:'rgba(255,255,255,0.08)',textColor:'rgba(255,255,255,0.4)',minimumWidth:70},
        timeScale:{borderColor:'rgba(255,255,255,0.08)',timeVisible:true,secondsVisible:true,barSpacing:6},
        width:chartRef.current.clientWidth,
        height:chartRef.current.clientHeight,
      })
      chartInstance.current = chart
      const cs = chart.addCandlestickSeries({
        upColor:C.accent,downColor:C.red,
        borderUpColor:C.accent,borderDownColor:C.red,
        wickUpColor:C.accent,wickDownColor:C.red,
      })
      candleSeries.current = cs

      // Try DexScreener → Mobula REST → backend
      const fetchCandles = async () => {
        // 1. DexScreener candles API
        try {
          const tfMap = {'1':'1m','5':'5m','15':'15m','60':'1h','240':'4h'}
          const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${token.pairAddress}`)
          const d = await r.json()
          if (d.pair) {
            // DexScreener doesn't have candles directly, but we can use their chart embed via backend
          }
        } catch {}

        // 2. Backend pump.fun → GeckoTerminal chain
        try {
          const r = await fetch(`${BACKEND}/api/pump/candles/${token.address}?tf=${chartTf}&limit=300`)
          const d = await r.json()
          if (d.candles?.length > 0) return {candles:d.candles, source:d.source||'backend'}
        } catch {}

        // 3. Mobula REST
        try {
          const period = {'1':'1m','5':'5m','15':'15m','60':'1h','240':'4h'}[chartTf]||'1m'
          const r = await fetch(`https://api.mobula.io/api/1/market/history?asset=${token.address}&blockchain=solana&period=${period}`,
            {headers:{Authorization:MOBULA_KEY}})
          if (r.ok) {
            const d = await r.json()
            const list = d?.data?.price_history??[]
            if (list.length > 0) {
              const candles = list.map(item => {
                const t = Array.isArray(item) ? item : [item.timestamp,item.open??item.price,item.high??item.price,item.low??item.price,item.close??item.price,item.volume??0]
                return {time:Math.floor(t[0]/1000),open:parseFloat(t[1])||0,high:parseFloat(t[2])||0,low:parseFloat(t[3])||0,close:parseFloat(t[4])||0,volume:parseFloat(t[5])||0}
              }).filter(c=>c.open>0)
              if (candles.length>0) return {candles,source:'mobula'}
            }
          }
        } catch {}

        return {candles:[],source:'none'}
      }

      const {candles,source} = await fetchCandles()
      if (cancelled) return

      if (candles.length > 0) {
        const seen=new Set()
        const unique = candles.filter(c=>{if(seen.has(c.time))return false;seen.add(c.time);return true}).sort((a,b)=>a.time-b.time)
        cs.setData(unique)
        chart.timeScale().fitContent()
        setChartSource(source)
      } else {
        setChartSource('none')
      }

      const ro = new ResizeObserver(()=>{
        if(chartRef.current&&chartInstance.current) chartInstance.current.applyOptions({width:chartRef.current.clientWidth,height:chartRef.current.clientHeight})
      })
      ro.observe(chartRef.current)
      return ()=>ro.disconnect()
    }

    init()
    return ()=>{
      cancelled=true
      if(chartInstance.current){try{chartInstance.current.remove()}catch{};chartInstance.current=null;candleSeries.current=null}
    }
  }, [token?.id, chartTf])

  const sourceLabel = chartSource==='mobula'?'Mobula':chartSource==='geckoterminal'?'GeckoTerminal':chartSource==='pump-v2'?'Pump V2':chartSource==='pump-v1'?'Pump V1':chartSource==='loading'?'Loading...':'No data'
  const sourceColor = chartSource==='none'?C.red:chartSource==='loading'?C.text2:C.accent

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
      {/* TF bar */}
      <div style={{display:'flex',gap:'4px',padding:'8px 12px',background:C.bg2,borderBottom:`1px solid ${C.border}`,flexShrink:0,alignItems:'center'}}>
        {[['1','1m'],['5','5m'],['15','15m'],['60','1h'],['240','4h']].map(([tf,label])=>(
          <button key={tf} onClick={()=>setChartTf(tf)} style={{
            fontSize:'11px',fontWeight:'500',padding:'4px 10px',cursor:'pointer',borderRadius:'6px',
            background:chartTf===tf?C.bg5:'transparent',
            border:`1px solid ${chartTf===tf?C.border2:'transparent'}`,
            color:chartTf===tf?C.text1:C.text2,transition:'all 0.1s',
          }}>{label}</button>
        ))}
        <div style={{marginLeft:'auto',fontSize:'10px',color:sourceColor,fontFamily:'monospace',display:'flex',alignItems:'center',gap:'4px'}}>
          <div style={{width:'5px',height:'5px',borderRadius:'50%',background:sourceColor}}/>
          {sourceLabel}
        </div>
      </div>
      {/* Chart */}
      {chartSource==='none' ? (
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'12px',background:C.bg2}}>
          <div style={{fontSize:'32px',opacity:0.3}}>📊</div>
          <div style={{fontSize:'13px',color:C.text2}}>No chart data yet</div>
          <a href={`https://pump.fun/${token.address}`} target="_blank" rel="noreferrer" style={{fontSize:'11px',color:C.accent,border:`1px solid rgba(0,255,136,0.2)`,padding:'6px 14px',textDecoration:'none',borderRadius:'8px'}}>View on Pump.fun ↗</a>
        </div>
      ) : (
        <div ref={chartRef} style={{flex:1,width:'100%',background:C.bg2}}/>
      )}
    </div>
  )
}

// ── Token Card ───────────────────────────────────────────────────────────
function TokenCard({token, isSelected, onSelect, flash}) {
  const netChange = token.priceChange1h??token.priceChange5m??0
  const buys = token.buys1h||token.buys5m||0
  const sells = token.sells1h||token.sells5m||0
  const txTotal = buys+sells||1
  const greenPct = Math.round((buys/txTotal)*100)
  const vol = token.volume1h||token.volume5m||0

  const bgColor = flash==='up'?'rgba(0,255,136,0.06)':flash==='down'?'rgba(255,71,87,0.06)':isSelected?'rgba(0,255,136,0.05)':'transparent'
  const borderL = isSelected?`2px solid ${C.accent}`:'2px solid transparent'

  return (
    <div
      onClick={onSelect}
      style={{
        padding:'10px 14px',cursor:'pointer',
        background:bgColor,
        borderLeft:borderL,
        borderBottom:`1px solid ${C.border}`,
        transition:'background 0.2s',
      }}
      onMouseEnter={e=>{if(!flash&&!isSelected)e.currentTarget.style.background='rgba(255,255,255,0.02)'}}
      onMouseLeave={e=>{e.currentTarget.style.background=bgColor}}
    >
      {/* Row 1 */}
      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'6px'}}>
        {/* Avatar */}
        <div style={{position:'relative',flexShrink:0}}>
          {token.logoUri ? (
            <img src={token.logoUri} alt="" style={{width:'36px',height:'36px',borderRadius:'8px',objectFit:'cover'}} onError={e=>e.target.style.display='none'}/>
          ) : (
            <div style={{width:'36px',height:'36px',borderRadius:'8px',background:`linear-gradient(135deg,${token.color}33,${token.color}66)`,border:`1px solid ${token.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:'700',color:token.color}}>{token.symbol[0]}</div>
          )}
          <div style={{position:'absolute',bottom:'-3px',right:'-3px',width:'12px',height:'12px',borderRadius:'50%',background:C.bg3,border:`1.5px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{width:'5px',height:'5px',borderRadius:'50%',background:token.dexId==='pumpfun'?C.accent:C.blue}}/>
          </div>
        </div>

        {/* Name + meta */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:'5px',marginBottom:'2px'}}>
            <span style={{fontSize:'13px',fontWeight:'600',color:C.text1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'130px'}}>{token.name}</span>
            <span style={{fontSize:'10px',color:C.text2,flexShrink:0}}>{token.symbol}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <span style={{fontSize:'9px',color:C.accent,fontFamily:'monospace'}}>{elapsed(token.pairCreatedAt)}</span>
            <span style={{fontSize:'9px',color:`${netChange>=0?C.accent:C.red}`,fontWeight:'600'}}>{netChange>=0?'+':''}{netChange.toFixed(2)}%</span>
            {token.bondingCurve > 0 && token.dexId==='pumpfun' && (
              <div style={{display:'flex',alignItems:'center',gap:'2px'}}>
                <div style={{width:'30px',height:'3px',borderRadius:'2px',background:'rgba(255,255,255,0.08)',overflow:'hidden'}}>
                  <div style={{width:`${token.bondingCurve}%`,height:'100%',background:`linear-gradient(90deg,${C.accent},${C.blue})`,borderRadius:'2px'}}/>
                </div>
                <span style={{fontSize:'8px',color:C.text2}}>{token.bondingCurve}%</span>
              </div>
            )}
          </div>
        </div>

        {/* MC + Vol */}
        <div style={{textAlign:'right',flexShrink:0}}>
          <div style={{fontSize:'13px',fontWeight:'700',color:C.text1,marginBottom:'2px'}}>{fmt(token.marketCap)}</div>
          <div style={{fontSize:'10px',color:C.text2}}>{fmtV(vol)}</div>
        </div>
      </div>

      {/* Row 2: TX bar + buy button */}
      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
        <span style={{fontSize:'9px',color:C.text2,flexShrink:0,fontFamily:'monospace'}}>TX {buys+sells}</span>
        <div style={{flex:1,height:'3px',borderRadius:'2px',overflow:'hidden',background:'rgba(255,255,255,0.06)'}}>
          <div style={{width:greenPct+'%',height:'100%',background:C.accent,borderRadius:'2px'}}/>
        </div>
        <span style={{fontSize:'9px',color:C.text2,flexShrink:0,fontFamily:'monospace'}}>{sells}</span>
        <button
          onClick={e=>{e.stopPropagation();onSelect()}}
          style={{
            background:`linear-gradient(135deg,${C.accent},${C.accent2})`,
            border:'none',color:'#000',fontSize:'10px',fontWeight:'700',
            padding:'4px 10px',cursor:'pointer',borderRadius:'6px',
            flexShrink:0,whiteSpace:'nowrap',
            boxShadow:'0 0 8px rgba(0,255,136,0.2)',
          }}
        >⚡ 0.1 SOL</button>
      </div>
    </div>
  )
}

// ── Skeleton Card ────────────────────────────────────────────────────────
function SkeletonCard() {
  const shimmer = {
    background:`linear-gradient(90deg,${C.bg3} 25%,${C.bg4} 50%,${C.bg3} 75%)`,
    backgroundSize:'200% 100%',
    animation:'shimmer 1.5s infinite',
    borderRadius:'4px',
  }
  return (
    <div style={{padding:'10px 14px',borderBottom:`1px solid ${C.border}`,display:'flex',gap:'10px',alignItems:'center'}}>
      <div style={{width:'36px',height:'36px',borderRadius:'8px',...shimmer,flexShrink:0}}/>
      <div style={{flex:1}}>
        <div style={{height:'12px',marginBottom:'6px',width:'50%',...shimmer}}/>
        <div style={{height:'10px',width:'70%',...shimmer}}/>
      </div>
      <div style={{width:'55px'}}>
        <div style={{height:'13px',marginBottom:'4px',...shimmer}}/>
        <div style={{height:'10px',...shimmer}}/>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────
export default function RadarPage() {
  const [newPairs, setNewPairs] = useState([])
  const [stretch, setStretch] = useState([])
  const [migrated, setMigrated] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [solPrice, setSolPrice] = useState(150)
  const [liveConns, setLiveConns] = useState(0)
  const [flashMap, setFlashMap] = useState({})
  const [trades, setTrades] = useState([])
  const [holders, setHolders] = useState([])
  const [topTraders, setTopTraders] = useState([])
  const [tokenInfo, setTokenInfo] = useState(null)
  const [bottomTab, setBottomTab] = useState('trades')
  const [sideTab, setSideTab] = useState('buy')
  const [chartTf, setChartTf] = useState('1')
  const [chartSource, setChartSource] = useState('loading')
  const [buyAmount, setBuyAmount] = useState('0.1')
  const [wallet, setWallet] = useState(null)
  const [txStatus, setTxStatus] = useState(null)
  const [txMsg, setTxMsg] = useState('')
  const [positions, setPositions] = useState([])
  const [panelHeight, setPanelHeight] = useState(220)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [colPresets, setColPresets] = useState({new:null,stretch:null,migrated:null})
  const [pnlInSol, setPnlInSol] = useState(true)

  const mobulaTradeWs = useRef(null)
  const mobulaOhlcvWs = useRef(null)
  const searchTimeout = useRef(null)
  const conn = useRef(new web3.Connection(DEVNET_RPC,'confirmed'))

  // SOL price
  useEffect(()=>{fetchSolPrice().then(setSolPrice);const iv=setInterval(()=>fetchSolPrice().then(setSolPrice),30000);return()=>clearInterval(iv)},[])

  // Devnet wallet
  useEffect(()=>{
    const saved=localStorage.getItem('trench_radar_wallet')
    if(!saved)return
    const d=JSON.parse(saved);setWallet(d)
    conn.current.getBalance(new web3.PublicKey(d.publicKey)).then(b=>setWallet(w=>w?{...w,balance:b/web3.LAMPORTS_PER_SOL}:null)).catch(()=>{})
  },[])

  // Mobula pulse-v2 WS
  useEffect(()=>{
    let ws,rt,ping
    const connect=()=>{
      try {
        ws=new WebSocket('wss://api.mobula.io')
        ws.onopen=()=>{
          setLiveConns(n=>n+1)
          ws.send(JSON.stringify({
            type:'pulse-v2',
            authorization:MOBULA_KEY,
            payload:{model:'default',assetMode:true,chainId:['solana:solana'],poolTypes:['pumpfun'],compressed:false}
          }))
          ping=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({event:'ping'}))},20000)
        }
        ws.onmessage=(e)=>{
          try {
            const msg=JSON.parse(e.data)
            if(msg.event==='pong')return
            const v2s={new:'new',bonding:'stretch',bonded:'migrated'}
            const xform=(data,view)=>{
              const t=data.token||data,mcap=data.market_cap||data.latest_market_cap||t.marketCap||0,addr=t.address||data.address||''
              if(!addr)return null
              return {
                id:addr,symbol:t.symbol||'???',name:t.name||'Unknown',address:addr,
                pairAddress:addr,color:tokenColor(addr),
                price:data.latest_price||t.price||0,marketCap:mcap,
                liquidity:t.liquidity||0,volume5m:data.volume_5min||0,volume1h:data.volume_1h||0,
                priceChange5m:data.price_change_5min||0,priceChange1h:data.price_change_1h||0,
                buys5m:data.trades_5min||0,sells5m:0,buys1h:data.buys_1h||0,sells1h:data.sells_1h||0,
                age:data.created_at?Date.now()-new Date(data.created_at).getTime():0,
                bondingCurve:t.bondingPercentage||(t.bonded?100:Math.min(99,Math.round((mcap/69000)*100))),
                holders:t.holdersCount||0,stage:v2s[view]||'new',
                logoUri:t.logo||null,dexId:v2s[view]==='migrated'?'pumpswap':'pumpfun',
                website:data.socials?.website||null,twitter:data.socials?.twitter||null,
                pairCreatedAt:data.created_at?new Date(data.created_at).getTime():Date.now(),
                smartTraders:t.smartTradersCount||0,snipers:t.snipersCount||0,
                insiders:t.insidersCount||0,freshTraders:t.freshTradersCount||0,source:'mobula',
              }
            }

            if(msg.type==='init'){
              for(const [vn,vd] of Object.entries(msg.payload||{})){
                if(!vd?.data)continue
                const stage=v2s[vn];if(!stage)continue
                const tokens=vd.data.map(d=>xform(d,vn)).filter(Boolean)
                if(stage==='new')setNewPairs(prev=>{const s=new Set(prev.map(t=>t.id));return[...tokens.filter(t=>!s.has(t.id)),...prev].slice(0,20)})
                else if(stage==='stretch')setStretch(prev=>{const s=new Set(prev.map(t=>t.id));return[...tokens.filter(t=>!s.has(t.id)),...prev].slice(0,20)})
                else setMigrated(prev=>{const s=new Set(prev.map(t=>t.id));return[...tokens.filter(t=>!s.has(t.id)),...prev].slice(0,20)})
              }
              setLoading(false)
            } else if(msg.type==='new-token'){
              const {viewName,token:td}=msg.payload||{};if(!td)return
              const t=xform(td,viewName);if(!t)return
              const stage=v2s[viewName]
              if(stage==='new')setNewPairs(prev=>[t,...prev.filter(x=>x.id!==t.id)].slice(0,20))
              else if(stage==='stretch')setStretch(prev=>[t,...prev.filter(x=>x.id!==t.id)].slice(0,20))
              else setMigrated(prev=>[t,...prev.filter(x=>x.id!==t.id)].slice(0,20))
            } else if(msg.type==='update-token'||msg.type==='update'){
              const updates=msg.type==='update-token'
                ?[{viewName:msg.payload?.viewName,data:msg.payload?.token}]
                :Object.entries(msg.payload||{}).flatMap(([vn,vd])=>(vd.data||[]).map(d=>({viewName:vn,data:d})))
              updates.forEach(({viewName,data})=>{
                if(!data)return
                const t=xform(data,viewName);if(!t)return
                const stage=v2s[viewName]
                const upd=prev=>prev.map(x=>x.id===t.id?{...x,...t}:x)
                if(stage==='new')setNewPairs(upd)
                else if(stage==='stretch')setStretch(upd)
                else setMigrated(upd)
                setSelected(s=>s?.id===t.id?{...s,...t}:s)
                if((data.price_change_5min||0)!==0){
                  setFlashMap(f=>({...f,[t.id]:(data.price_change_5min||0)>0?'up':'down'}))
                  setTimeout(()=>setFlashMap(f=>{const n={...f};delete n[t.id];return n}),800)
                }
              })
            } else if(msg.type==='remove-token'){
              const addr=msg.payload?.token?.token?.address||msg.payload?.address;if(!addr)return
              setNewPairs(prev=>prev.filter(t=>t.id!==addr))
              setStretch(prev=>prev.filter(t=>t.id!==addr))
            }
          } catch {}
        }
        ws.onclose=()=>{setLiveConns(n=>Math.max(0,n-1));clearInterval(ping);rt=setTimeout(connect,2000)}
        ws.onerror=()=>ws.close()
      } catch {}
    }
    connect()
    return()=>{clearTimeout(rt);clearInterval(ping);if(ws)ws.close()}
  },[])

  // pump.fun WS backup
  useEffect(()=>{
    let ws,rt
    const connect=()=>{
      try {
        ws=new WebSocket('wss://pumpportal.fun/api/data')
        ws.onopen=()=>{
          setLiveConns(n=>n+1)
          ws.send(JSON.stringify({method:'subscribeNewToken'}))
          ws.send(JSON.stringify({method:'subscribeMigration'}))
        }
        ws.onmessage=(e)=>{
          try {
            const d=JSON.parse(e.data)
            if(d.txType==='create'&&d.mint){
              const t={id:d.mint,symbol:d.symbol||'???',name:d.name||'New Token',address:d.mint,pairAddress:d.mint,color:tokenColor(d.mint),price:0,marketCap:(d.marketCapSol||0)*cachedSolPrice,liquidity:0,volume5m:0,volume1h:0,priceChange5m:0,priceChange1h:0,buys5m:0,sells5m:0,buys1h:0,sells1h:0,age:0,bondingCurve:0,holders:0,stage:'new',logoUri:d.image||null,dexId:'pumpfun',website:d.website||null,twitter:d.twitter||null,telegram:d.telegram||null,pairCreatedAt:Date.now(),source:'pumpportal',smartTraders:0,snipers:0,insiders:0,freshTraders:0}
              setNewPairs(prev=>[t,...prev.filter(x=>x.id!==d.mint)].slice(0,20))
            }
          } catch {}
        }
        ws.onclose=()=>{setLiveConns(n=>Math.max(0,n-1));rt=setTimeout(connect,3000)}
        ws.onerror=()=>ws.close()
      } catch {}
    }
    connect()
    return()=>{clearTimeout(rt);if(ws)ws.close()}
  },[])

  // DexScreener fallback
  const refreshPairs=useCallback(async()=>{
    const {newP,stretchP,migratedP}=await loadPairs()
    setNewPairs(prev=>{const s=new Set(prev.map(t=>t.id));return[...prev,...newP.filter(t=>!s.has(t.id))].slice(0,20)})
    setStretch(prev=>{const s=new Set(prev.map(t=>t.id));return[...prev,...stretchP.filter(t=>!s.has(t.id))].slice(0,20)})
    setMigrated(prev=>{const s=new Set(prev.map(t=>t.id));return[...prev,...migratedP.filter(t=>!s.has(t.id))].slice(0,20)})
    setLoading(false)
  },[])
  useEffect(()=>{refreshPairs();const iv=setInterval(refreshPairs,15000);return()=>clearInterval(iv)},[refreshPairs])

  // Mobula fast-trade + ohlcv for selected token
  useEffect(()=>{
    if(!selected?.address)return
    let dead=false
    if(mobulaTradeWs.current)try{mobulaTradeWs.current.close()}catch{}
    if(mobulaOhlcvWs.current)try{mobulaOhlcvWs.current.close()}catch{}

    const tw=new WebSocket('wss://api.mobula.io')
    mobulaTradeWs.current=tw
    tw.onopen=()=>tw.send(JSON.stringify({type:'fast-trade',authorization:MOBULA_KEY,payload:{assetMode:true,filterOutliers:true,items:[{blockchain:'solana',address:selected.address}]}}))
    tw.onmessage=(e)=>{
      try {
        const d=JSON.parse(e.data)
        if(d.type!=='fast-trade'||!d.tokenAmountUsd)return
        const isBuy=(d.type_trade||d.trade_type||d.type||'').toLowerCase().includes('buy')
        const fmtAge=(n)=>{if(typeof n!=='number')return'0s';if(n<60)return n+'s';if(n<3600)return Math.floor(n/60)+'m';return Math.floor(n/3600)+'h'}
        const trade={id:d.hash||Math.random().toString(36),sig:d.hash||'',age:0,fmtAge:'0s',type:isBuy?'Buy':'Sell',isBuy,mc:d.tokenMarketCapUSD||0,solAmount:(d.tokenAmountUsd/cachedSolPrice).toFixed(4),usdValue:(d.tokenAmountUsd||0).toFixed(2),wallet:d.sender||'',source:d.platform||'mobula',labels:d.labels||[],platform:d.platform||null,walletMeta:d.walletMetadata||null}
        if(!dead)setTrades(prev=>[trade,...prev].slice(0,60))
      } catch {}
    }
    tw.onerror=()=>{}; tw.onclose=()=>{}

    const ping=setInterval(()=>{if(tw.readyState===1)tw.send(JSON.stringify({event:'ping'}))},25000)
    return()=>{dead=true;clearInterval(ping);try{tw.close()}catch{}}
  },[selected?.id])

  // Load trades from Helius if no Mobula trades
  useEffect(()=>{
    if(!selected?.address)return
    let cancelled=false
    const loadTrades=async()=>{
      try {
        const r=await fetch(`https://api.helius.xyz/v0/addresses/${selected.address}/transactions?api-key=${HELIUS_KEY}&limit=25&type=SWAP`)
        const txns=await r.json()
        if(!Array.isArray(txns)||cancelled)return
        const now=Date.now()/1000
        const txTrades=txns.slice(0,20).map((t,i)=>{
          const xfers=t.tokenTransfers||[],nx=t.nativeTransfers||[]
          const tx=xfers.find(x=>x.mint===selected.address)
          const isBuy=tx?tx.toUserAccount===t.feePayer:true
          const sol=(nx.reduce((m,x)=>x.amount>m.amount?x:{amount:0},{amount:0}).amount)/1e9
          const age=Math.floor(now-(t.timestamp??now))
          const fmtAge=(n)=>{if(n<60)return n+'s';if(n<3600)return Math.floor(n/60)+'m';return Math.floor(n/3600)+'h'}
          return {id:i,sig:t.signature,age,fmtAge:fmtAge(age),type:isBuy?'Buy':'Sell',isBuy,mc:selected.marketCap,solAmount:sol.toFixed(4),usdValue:(sol*cachedSolPrice).toFixed(2),wallet:t.feePayer||'',source:t.source||'helius',labels:[],platform:t.source||null,walletMeta:null}
        })
        if(!cancelled&&trades.length===0)setTrades(txTrades)
      } catch {}
    }
    const iv=setTimeout(loadTrades,1500)
    return()=>{cancelled=true;clearTimeout(iv)}
  },[selected?.id])

  // Load holders from Helius
  useEffect(()=>{
    if(!selected?.address)return
    let cancelled=false
    const loadHolders=async()=>{
      try {
        const r=await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getTokenAccounts',params:{mint:selected.address,limit:100}})})
        const data=await r.json()
        const accounts=(data?.result?.token_accounts??[]).filter(a=>parseFloat(a.amount)>0)
        const total=accounts.reduce((s,a)=>s+parseFloat(a.amount),0)
        if(!cancelled&&accounts.length>0){
          setHolders(accounts.slice(0,15).map((acc,i)=>({rank:i+1,wallet:acc.address,pct:((parseFloat(acc.amount)/total)*100).toFixed(2),tokens:parseFloat(acc.amount),type:i===0?'LP':''})))
          setSelected(s=>s?{...s,holders:accounts.length}:null)
        }
      } catch {}
    }
    loadHolders()
    return()=>{cancelled=true}
  },[selected?.id])

  // Search
  useEffect(()=>{
    clearTimeout(searchTimeout.current)
    if(searchQuery.length>=2){
      searchTimeout.current=setTimeout(async()=>{
        try {
          const r=await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(searchQuery)}`)
          const d=await r.json()
          setSearchResults((d.pairs??[]).filter(p=>p.chainId==='solana').slice(0,8))
        } catch {setSearchResults([])}
      },250)
    } else setSearchResults([])
  },[searchQuery])

  const selectToken=(token)=>{
    setSelected(token);setSideTab('buy');setBottomTab('trades')
    setShowSearch(false);setSearchQuery('');setTokenInfo(null)
    setTrades([]);setHolders([]);setTopTraders([])
  }

  const generateWallet=async()=>{
    const kp=web3.Keypair.generate()
    const ALPHA='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    const b58=(bytes)=>{let d=[0];for(let i=0;i<bytes.length;i++){let c=bytes[i];for(let j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=(c/58)|0}while(c>0){d.push(c%58);c=(c/58)|0}}let r='';for(let i=0;i<bytes.length&&bytes[i]===0;i++)r+='1';for(let i=d.length-1;i>=0;i--)r+=ALPHA[d[i]];return r}
    const data={publicKey:kp.publicKey.toString(),secretKey:Array.from(kp.secretKey),privateKeyBase58:b58(kp.secretKey),balance:0,network:'devnet'}
    localStorage.setItem('trench_radar_wallet',JSON.stringify(data));setWallet(data)
  }

  const airdrop=async()=>{
    if(!wallet)return
    setTxStatus('pending');setTxMsg('Requesting airdrop...')
    try {
      const c=new web3.Connection(DEVNET_RPC,{commitment:'confirmed'})
      const pk=new web3.PublicKey(wallet.publicKey)
      await c.requestAirdrop(pk,2*web3.LAMPORTS_PER_SOL)
      setTxMsg('Confirming...')
      for(let i=0;i<15;i++){
        await new Promise(r=>setTimeout(r,1500))
        const bal=await c.getBalance(pk).catch(()=>0)
        if(bal>0){setWallet(w=>({...w,balance:bal/web3.LAMPORTS_PER_SOL}));setTxStatus('success');setTxMsg('2 SOL airdropped!');setTimeout(()=>{setTxStatus(null);setTxMsg('')},3000);return}
      }
    } catch {}
    setTxStatus('error');setTxMsg('Use faucet.solana.com');setTimeout(()=>{setTxStatus(null);setTxMsg('')},4000)
  }

  const buy=async()=>{
    if(!wallet||!selected)return
    const amt=parseFloat(buyAmount)
    if(isNaN(amt)||amt<=0||amt>(wallet.balance||0)){setTxStatus('error');setTxMsg('Insufficient SOL');setTimeout(()=>{setTxStatus(null);setTxMsg('')},2000);return}
    setTxStatus('pending');setTxMsg('Simulating buy...')
    await new Promise(r=>setTimeout(r,700))
    const tokens=(amt/Math.max(selected.price,1e-12))*0.97
    setPositions(prev=>[{id:Math.random().toString(36).slice(2),token:{...selected},entryPrice:selected.price,tokensHeld:tokens,solSpent:amt,usdSpent:amt*solPrice,currentPrice:selected.price},...prev])
    setWallet(w=>({...w,balance:(w.balance||0)-amt}))
    setTxStatus('success');setTxMsg(`Bought ${tokens.toExponential(2)} ${selected.symbol}`)
    setSideTab('sell');setTimeout(()=>{setTxStatus(null);setTxMsg('')},3000)
  }

  useEffect(()=>{
    if(!selected)return
    setPositions(prev=>prev.map(pos=>{
      if(pos.token.id!==selected.id)return pos
      const curVal=pos.tokensHeld*selected.price,pnlUsd=curVal-pos.usdSpent,pnlSol=pnlUsd/solPrice
      return{...pos,currentPrice:selected.price,pnlUsd,pnlSol,pnlPct:pos.usdSpent>0?(pnlUsd/pos.usdSpent)*100:0}
    }))
  },[selected?.price,solPrice])

  const sellPosition=(posId,pct=100)=>{
    const pos=positions.find(p=>p.id===posId);if(!pos)return
    const frac=pct/100,sol=(pos.tokensHeld*frac*pos.currentPrice)/solPrice*0.97
    setWallet(w=>({...w,balance:(w.balance||0)+sol}))
    if(pct===100)setPositions(prev=>prev.filter(p=>p.id!==posId))
    else setPositions(prev=>prev.map(p=>p.id===posId?{...p,tokensHeld:p.tokensHeld*(1-frac),solSpent:p.solSpent*(1-frac),usdSpent:p.usdSpent*(1-frac)}:p))
  }

  const pos=positions.find(p=>p.token.id===selected?.id)
  const posPnlUsd=pos?.pnlUsd||0,posPnlSol=pos?.pnlSol||0,posPnlPct=pos?.pnlPct||0

  const PRESETS={
    new:[{id:'p1',label:'P1',min:0,max:30000},{id:'p2',label:'P2',min:30000,max:60000},{id:'p3',label:'P3',min:60000}],
    stretch:[{id:'p1',label:'P1',minBond:70},{id:'p2',label:'P2',minBond:85},{id:'p3',label:'P3',minBond:95}],
    migrated:[{id:'p1',label:'P1',min:50000},{id:'p2',label:'P2',min:250000},{id:'p3',label:'P3',min:1000000}],
  }
  const applyPreset=(tokens,key)=>{
    const p=colPresets[key];if(!p)return tokens
    return tokens.filter(t=>{
      if(p.min&&t.marketCap<p.min)return false
      if(p.max&&t.marketCap>p.max)return false
      if(p.minBond&&t.bondingCurve<p.minBond)return false
      return true
    })
  }

  const columns=[
    {key:'new',label:'New Pairs',color:C.accent,tokens:newPairs,desc:'Pump.fun · Bonding'},
    {key:'stretch',label:'Final Stretch',color:C.yellow,tokens:stretch,desc:'Near $69K grad'},
    {key:'migrated',label:'Migrated',color:C.blue,tokens:migrated,desc:'PumpSwap / Raydium'},
  ]

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'row',background:C.bg,color:C.text1,overflow:'hidden',fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"}}>
      <Sidebar active="/radar"/>

      {/* Toast */}
      {txStatus&&(
        <div style={{position:'fixed',top:'60px',right:'16px',zIndex:9999,padding:'10px 16px',background:txStatus==='success'?'rgba(0,255,136,0.12)':txStatus==='error'?'rgba(255,71,87,0.12)':'rgba(15,17,23,0.95)',border:`1px solid ${txStatus==='success'?'rgba(0,255,136,0.3)':txStatus==='error'?'rgba(255,71,87,0.3)':C.border}`,borderRadius:'10px',fontSize:'12px',fontWeight:'600',color:txStatus==='success'?C.accent:txStatus==='error'?C.red:C.text2,boxShadow:'0 8px 32px rgba(0,0,0,0.6)',backdropFilter:'blur(12px)'}}>
          {txStatus==='pending'?`⟳ ${txMsg}`:txStatus==='success'?`✓ ${txMsg}`:`✗ ${txMsg}`}
        </div>
      )}

      {/* Search overlay */}
      {showSearch&&(
        <div style={{position:'fixed',inset:0,zIndex:500,background:'rgba(5,6,10,0.8)',backdropFilter:'blur(12px)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'80px'}} onClick={()=>{setShowSearch(false);setSearchQuery('')}}>
          <div style={{width:'600px',...glass(),overflow:'hidden',boxShadow:'0 24px 64px rgba(0,0,0,0.8)'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:'10px',borderBottom:`1px solid ${C.border}`}}>
              <span style={{color:C.text2,fontSize:'16px'}}>⌕</span>
              <input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Escape'&&(setShowSearch(false),setSearchQuery(''))} placeholder="Search token or paste CA..." style={{flex:1,background:'transparent',border:'none',color:C.text1,fontSize:'14px',outline:'none'}}/>
            </div>
            <div style={{maxHeight:'400px',overflowY:'auto'}}>
              {searchResults.map(p=>{
                const t=pairToToken(p,'new')
                return (
                  <div key={p.pairAddress} onClick={()=>selectToken(t)} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 16px',cursor:'pointer',borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background=C.bg4} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {p.info?.imageUrl?<img src={p.info.imageUrl} alt="" style={{width:'36px',height:'36px',borderRadius:'8px',objectFit:'cover'}} onError={e=>e.target.style.display='none'}/>:<div style={{width:'36px',height:'36px',borderRadius:'8px',background:t.color+'33',border:`1px solid ${t.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',color:t.color}}>{t.symbol[0]}</div>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'2px'}}>
                        <span style={{fontSize:'13px',fontWeight:'600',color:C.text1}}>{p.baseToken?.symbol}</span>
                        <span style={{fontSize:'11px',color:C.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.baseToken?.name}</span>
                      </div>
                      <div style={{display:'flex',gap:'12px'}}>
                        <span style={{fontSize:'11px',color:C.text2}}>{fmt(p.marketCap??p.fdv)}</span>
                        <span style={{fontSize:'11px',color:(p.priceChange?.h24??0)>=0?C.accent:C.red}}>{(p.priceChange?.h24??0)>=0?'+':''}{(p.priceChange?.h24??0).toFixed(1)}%</span>
                      </div>
                    </div>
                    <span style={{fontSize:'9px',padding:'2px 6px',background:`${C.blue}22`,color:C.blue,border:`1px solid ${C.blue}44`,borderRadius:'4px'}}>{p.dexId}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',flex:1,overflow:'hidden',flexDirection:'column'}}>
        {!selected ? (
          // ── PULSE FEED VIEW ──────────────────────────────────────────
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Toolbar */}
            <div style={{padding:'10px 20px',borderBottom:`1px solid ${C.border}`,background:C.bg,display:'flex',alignItems:'center',gap:'12px',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontSize:'20px',fontWeight:'700',color:C.text1,letterSpacing:'-0.5px'}}>Pulse</span>
                <div style={{width:'7px',height:'7px',borderRadius:'50%',background:C.accent,boxShadow:`0 0 8px ${C.accent}`,animation:'pulse 2s infinite'}}/>
              </div>
              <div onClick={()=>setShowSearch(true)} style={{flex:1,maxWidth:'380px',display:'flex',alignItems:'center',gap:'8px',...glass(),padding:'8px 12px',cursor:'text',borderRadius:'10px'}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.border2} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <span style={{color:C.text2,fontSize:'14px'}}>⌕</span>
                <span style={{fontSize:'12px',color:C.text3}}>Search token or CA...</span>
                <span style={{marginLeft:'auto',background:C.bg4,borderRadius:'4px',padding:'1px 5px',fontSize:'10px',color:C.text2,fontFamily:'monospace'}}>/</span>
              </div>
              <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'10px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'5px',padding:'5px 10px',...glass(liveConns>0),borderRadius:'8px'}}>
                  <div style={{width:'6px',height:'6px',borderRadius:'50%',background:liveConns>0?C.accent:C.red,boxShadow:liveConns>0?`0 0 6px ${C.accent}`:undefined}}/>
                  <span style={{fontSize:'11px',color:liveConns>0?C.accent:C.red,fontWeight:'500'}}>{liveConns>0?`LIVE ×${liveConns}`:'OFFLINE'}</span>
                </div>
                <div style={{padding:'5px 10px',...glass(),borderRadius:'8px',display:'flex',alignItems:'center',gap:'6px'}}>
                  <div style={{width:'16px',height:'16px',borderRadius:'50%',background:'linear-gradient(135deg,#9945FF,#14f195)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px'}}>◎</div>
                  <span style={{fontSize:'12px',color:C.text1,fontWeight:'600'}}>${solPrice.toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* 3 columns */}
            <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',overflow:'hidden'}}>
              {columns.map((col,ci)=>{
                const filtered=applyPreset(col.tokens,col.key)
                const activePreset=colPresets[col.key]
                return (
                  <div key={col.label} style={{display:'flex',flexDirection:'column',overflow:'hidden',borderRight:ci<2?`1px solid ${C.border}`:'none'}}>
                    {/* Column header */}
                    <div style={{padding:'10px 14px 8px',borderBottom:`1px solid ${C.border}`,background:C.bg,flexShrink:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        <span style={{fontSize:'14px',fontWeight:'700',color:C.text1}}>{col.label}</span>
                        <div style={{display:'flex',alignItems:'center',gap:'5px',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:'20px',padding:'2px 8px'}}>
                          <span style={{fontSize:'10px',color:C.text2}}>⚡</span>
                          <span style={{fontSize:'11px',color:C.text1,fontWeight:'600'}}>{filtered.length}</span>
                        </div>
                        <div style={{display:'flex',gap:'3px',marginLeft:'4px'}}>
                          {PRESETS[col.key].map(p=>(
                            <button key={p.id} onClick={()=>setColPresets(prev=>({...prev,[col.key]:prev[col.key]?.id===p.id?null:p}))} style={{fontSize:'10px',fontWeight:'700',padding:'2px 7px',background:activePreset?.id===p.id?col.color:'transparent',border:`1px solid ${activePreset?.id===p.id?col.color:C.border}`,color:activePreset?.id===p.id?'#000':C.text2,cursor:'pointer',borderRadius:'4px',transition:'all 0.1s'}}>{p.label}</button>
                          ))}
                        </div>
                        <div style={{marginLeft:'auto',width:'7px',height:'7px',borderRadius:'50%',background:col.color,boxShadow:`0 0 6px ${col.color}88`}}/>
                      </div>
                    </div>
                    {/* Token list */}
                    <div style={{flex:1,overflowY:'auto'}}>
                      {loading&&col.tokens.length===0
                        ?Array.from({length:7}).map((_,i)=><SkeletonCard key={i}/>)
                        :filtered.length===0
                          ?<div style={{padding:'40px 16px',textAlign:'center',color:C.text2,fontSize:'12px'}}>{loading?'Scanning...':'No pairs'}{activePreset?` matching ${activePreset.label}`:''}</div>
                          :filtered.map(t=><TokenCard key={t.id} token={t} isSelected={selected?.id===t.id} flash={flashMap[t.id]} onSelect={()=>selectToken(t)}/>)
                      }
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bottom status bar */}
            <div style={{height:'28px',borderTop:`1px solid ${C.border}`,background:C.bg,display:'flex',alignItems:'center',padding:'0 16px',gap:'16px',flexShrink:0,overflowX:'auto'}}>
              <div style={{display:'flex',alignItems:'center',gap:'6px',flexShrink:0,background:`${C.accent}15`,border:`1px solid ${C.accent}30`,padding:'2px 8px',borderRadius:'4px'}}>
                <span style={{fontSize:'10px',color:C.accent,fontWeight:'700',fontFamily:'monospace'}}>≡ PRESET 1</span>
              </div>
              <div style={{width:'1px',height:'14px',background:C.border,flexShrink:0}}/>
              <div style={{display:'flex',alignItems:'center',gap:'4px',flexShrink:0}}>
                <div style={{width:'5px',height:'5px',borderRadius:'50%',background:liveConns>0?C.accent:C.red}}/>
                <span style={{fontSize:'10px',color:liveConns>0?C.accent:C.text2,fontFamily:'monospace'}}>{liveConns>0?'Live · Mobula + Pump.fun':'Connecting...'}</span>
              </div>
              <div style={{marginLeft:'auto',display:'flex',gap:'14px',flexShrink:0}}>
                <span style={{fontSize:'10px',color:C.text2,fontFamily:'monospace'}}>NEW <span style={{color:C.accent}}>{newPairs.length}</span></span>
                <span style={{fontSize:'10px',color:C.text2,fontFamily:'monospace'}}>STRETCH <span style={{color:C.yellow}}>{stretch.length}</span></span>
                <span style={{fontSize:'10px',color:C.text2,fontFamily:'monospace'}}>MIGRATED <span style={{color:C.blue}}>{migrated.length}</span></span>
                <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                  <div style={{width:'5px',height:'5px',borderRadius:'50%',background:liveConns>0?C.accent:C.red}}/>
                  <span style={{fontSize:'10px',color:C.text2,fontFamily:'monospace'}}>{liveConns>0?'Connection stable':'Connecting'}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // ── TOKEN DETAIL VIEW ────────────────────────────────────────
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Detail header */}
            <div style={{padding:'8px 16px',borderBottom:`1px solid ${C.border}`,background:C.bg,display:'flex',alignItems:'center',gap:'10px',flexShrink:0,overflowX:'auto'}}>
              <button onClick={()=>setSelected(null)} style={{fontSize:'11px',color:C.text2,background:C.bg3,border:`1px solid ${C.border}`,padding:'5px 10px',cursor:'pointer',borderRadius:'8px',flexShrink:0,fontWeight:'600',transition:'all 0.1s'}} onMouseEnter={e=>e.currentTarget.style.color=C.text1} onMouseLeave={e=>e.currentTarget.style.color=C.text2}>← Back</button>
              {selected.logoUri?<img src={selected.logoUri} alt="" style={{width:'24px',height:'24px',borderRadius:'6px',objectFit:'cover',flexShrink:0}} onError={e=>e.target.style.display='none'}/>:<div style={{width:'24px',height:'24px',borderRadius:'6px',background:selected.color+'33',border:`1px solid ${selected.color}44`,flexShrink:0}}/>}
              <button onClick={()=>{navigator.clipboard.writeText(selected.address);setTxMsg('CA copied');setTxStatus('success');setTimeout(()=>{setTxStatus(null);setTxMsg('')},1500)}} style={{background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:0,flexShrink:0}}>
                <div style={{fontSize:'15px',fontWeight:'700',color:C.text1,lineHeight:1}}>${selected.symbol}</div>
                <div style={{fontSize:'9px',color:C.text3}}>click to copy CA</div>
              </button>
              <div style={{display:'flex',gap:'4px',flexShrink:0}}>
                {selected.website&&<a href={selected.website} target="_blank" rel="noreferrer" style={{fontSize:'10px',color:C.text2,background:C.bg3,border:`1px solid ${C.border}`,padding:'3px 7px',textDecoration:'none',borderRadius:'4px'}}>WEB</a>}
                {selected.twitter&&<a href={selected.twitter} target="_blank" rel="noreferrer" style={{fontSize:'10px',color:C.text2,background:C.bg3,border:`1px solid ${C.border}`,padding:'3px 7px',textDecoration:'none',borderRadius:'4px'}}>𝕏</a>}
                <a href={`https://pump.fun/${selected.address}`} target="_blank" rel="noreferrer" style={{fontSize:'10px',color:C.accent,background:`${C.accent}10`,border:`1px solid ${C.accent}30`,padding:'3px 7px',textDecoration:'none',borderRadius:'4px'}}>pump</a>
                <a href={`https://dexscreener.com/solana/${selected.pairAddress}`} target="_blank" rel="noreferrer" style={{fontSize:'10px',color:C.blue,background:`${C.blue}10`,border:`1px solid ${C.blue}30`,padding:'3px 7px',textDecoration:'none',borderRadius:'4px'}}>dex</a>
              </div>
              <div style={{display:'flex',gap:'16px',marginLeft:'6px',overflowX:'auto'}}>
                {[['PRICE',`$${selected.price.toExponential(2)}`,C.text1],['MCAP',fmt(selected.marketCap),C.yellow],['LIQ',fmt(selected.liquidity),C.blue],['CURVE',`${selected.bondingCurve}%`,C.text1],['VOL 1H',fmt(selected.volume1h),C.text1],['BUYS',selected.buys1h,C.accent],['SELLS',selected.sells1h,C.red]].map(([l,v,c])=>(
                  <div key={l} style={{flexShrink:0}}>
                    <div style={{fontSize:'9px',color:C.text3,letterSpacing:'0.5px',marginBottom:'1px',fontFamily:'monospace'}}>{l}</div>
                    <div style={{fontSize:'12px',color:c,fontWeight:'700'}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{flex:1,display:'flex',overflow:'hidden'}}>
              {/* Chart + bottom panel */}
              <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <TradingChart token={selected} chartTf={chartTf} setChartTf={setChartTf} chartSource={chartSource} setChartSource={setChartSource}/>

                {/* Bottom panel */}
                <div style={{height:panelHeight+'px',borderTop:`1px solid ${C.border}`,flexShrink:0,display:'flex',flexDirection:'column',position:'relative'}}>
                  <div onMouseDown={e=>{e.preventDefault();const sY=e.clientY,sH=panelHeight;const mv=e=>setPanelHeight(Math.max(160,Math.min(480,sH+(sY-e.clientY))));const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up)};document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up)}} style={{position:'absolute',top:0,left:0,right:0,height:'5px',cursor:'ns-resize',zIndex:10}}/>
                  {/* Tab bar */}
                  <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,background:C.bg,flexShrink:0,alignItems:'center'}}>
                    {[['trades','TRADES'],['positions','POSITIONS'],['holders',`HOLDERS${selected.holders>0?' ('+selected.holders+')':''}`],['top_traders','TOP TRADERS']].map(([v,l])=>(
                      <button key={v} onClick={()=>setBottomTab(v)} style={{fontSize:'10px',letterSpacing:'0.5px',padding:'8px 14px',background:'none',border:'none',borderBottom:`2px solid ${bottomTab===v?C.accent:'transparent'}`,color:bottomTab===v?C.text1:C.text2,cursor:'pointer',whiteSpace:'nowrap',fontWeight:bottomTab===v?'600':'400',transition:'all 0.1s'}}>{l}</button>
                    ))}
                  </div>
                  <div style={{flex:1,overflow:'hidden',display:'flex'}}>
                    {/* TRADES */}
                    {bottomTab==='trades'&&(
                      <div style={{flex:1,overflowY:'auto'}}>
                        <div style={{display:'grid',gridTemplateColumns:'44px 44px 80px 80px 70px 70px 1fr',padding:'5px 14px',background:C.bg,fontSize:'10px',color:C.text2,position:'sticky',top:0,borderBottom:`1px solid ${C.border}`,fontFamily:'monospace',letterSpacing:'0.3px'}}>
                          <span>AGE</span><span>TYPE</span><span>SOL</span><span>USD</span><span>LABEL</span><span>PLATFORM</span><span>WALLET</span>
                        </div>
                        {trades.length===0?<div style={{padding:'24px',textAlign:'center',color:C.text2,fontSize:'12px'}}>Waiting for trades...</div>:
                        trades.map(t=>{
                          const LC={sniper:C.red,insider:C.purple,bundler:C.orange,proTrader:C.blue,smartTrader:C.yellow,freshTrader:'#00d2d3'}
                          const lbl=(t.labels||[])[0]
                          return(
                          <div key={t.id} style={{display:'grid',gridTemplateColumns:'44px 44px 80px 80px 70px 70px 1fr',padding:'5px 14px',borderBottom:`1px solid ${C.border}22`,alignItems:'center',background:t.isBuy?'rgba(0,255,136,0.02)':'rgba(255,71,87,0.02)',transition:'background 0.1s'}} onMouseEnter={e=>e.currentTarget.style.background=C.bg3} onMouseLeave={e=>e.currentTarget.style.background=t.isBuy?'rgba(0,255,136,0.02)':'rgba(255,71,87,0.02)'}>
                            <span style={{fontFamily:'monospace',fontSize:'10px',color:C.text2}}>{t.fmtAge||'0s'}</span>
                            <span style={{fontFamily:'monospace',fontSize:'11px',color:t.isBuy?C.accent:C.red,fontWeight:'700'}}>{t.type}</span>
                            <span style={{fontFamily:'monospace',fontSize:'11px',color:C.text1}}>◎{t.solAmount}</span>
                            <span style={{fontFamily:'monospace',fontSize:'11px',color:t.isBuy?C.accent:C.red,fontWeight:'600'}}>${t.usdValue}</span>
                            <span style={{fontFamily:'monospace',fontSize:'9px',color:lbl?LC[lbl]||C.text2:C.text2,fontWeight:lbl?'700':'400'}}>{lbl||'—'}</span>
                            <span style={{fontFamily:'monospace',fontSize:'9px',color:C.blue,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.platform||'—'}</span>
                            <span style={{fontFamily:'monospace',fontSize:'10px',color:C.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.walletMeta?.entityName||tr(t.wallet,5)}</span>
                          </div>
                        )})}
                      </div>
                    )}
                    {/* HOLDERS */}
                    {bottomTab==='holders'&&(
                      <div style={{flex:1,overflowY:'auto'}}>
                        <div style={{display:'grid',gridTemplateColumns:'28px 160px 100px 80px 60px',padding:'5px 14px',background:C.bg,fontSize:'10px',color:C.text2,position:'sticky',top:0,borderBottom:`1px solid ${C.border}`,fontFamily:'monospace'}}><span>#</span><span>WALLET</span><span>TOKENS</span><span>%</span><span>TYPE</span></div>
                        {holders.length===0?<div style={{padding:'24px',textAlign:'center',color:C.text2,fontSize:'12px'}}>Loading holders...</div>:
                        holders.map((h,i)=>(
                          <div key={i} style={{display:'grid',gridTemplateColumns:'28px 160px 100px 80px 60px',padding:'6px 14px',borderBottom:`1px solid ${C.border}22`,alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.background=C.bg3} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <span style={{fontFamily:'monospace',fontSize:'10px',color:C.text2}}>{h.rank}</span>
                            <span style={{fontFamily:'monospace',fontSize:'10px',color:C.text2}}>{tr(h.wallet,6)}</span>
                            <span style={{fontFamily:'monospace',fontSize:'10px',color:C.text1}}>{h.tokens>1e9?(h.tokens/1e9).toFixed(1)+'B':h.tokens>1e6?(h.tokens/1e6).toFixed(1)+'M':(h.tokens/1e3).toFixed(0)+'K'}</span>
                            <span style={{fontFamily:'monospace',fontSize:'11px',color:C.yellow,fontWeight:'600'}}>{h.pct}%</span>
                            <span style={{fontFamily:'monospace',fontSize:'9px',color:h.type==='LP'?C.blue:C.red}}>{h.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {bottomTab==='top_traders'&&<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:C.text2,fontSize:'12px'}}>Top traders via Axiom API — coming soon</div>}
                    {bottomTab==='positions'&&(
                      <div style={{flex:1,overflowY:'auto',padding:'10px'}}>
                        {positions.length===0?<div style={{textAlign:'center',padding:'24px',color:C.text2,fontSize:'12px'}}>No open positions</div>:
                        positions.map(p=>{
                          const pnlU=p.tokensHeld*p.currentPrice-p.usdSpent,pnlP=p.usdSpent>0?(pnlU/p.usdSpent)*100:0
                          return (
                            <div key={p.id} style={{...glass(pnlU>=0),padding:'12px',marginBottom:'8px',borderRadius:'10px'}}>
                              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}><span style={{fontSize:'13px',fontWeight:'700'}}>${p.token.symbol}</span><span style={{fontSize:'13px',color:pnlU>=0?C.accent:C.red,fontWeight:'700'}}>{pnlU>=0?'+':''}{pnlP.toFixed(1)}%</span></div>
                              <div style={{fontSize:'11px',color:C.text2,marginBottom:'8px'}}>{fmtSol(p.solSpent)} in · {pnlU>=0?'+':''}{fmtSol(pnlU/solPrice)} PNL</div>
                              <button onClick={()=>sellPosition(p.id,100)} style={{width:'100%',fontSize:'12px',color:C.red,background:`${C.red}10`,border:`1px solid ${C.red}30`,padding:'6px',cursor:'pointer',borderRadius:'6px',fontWeight:'700'}}>SELL ALL</button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right buy/sell panel */}
              <div style={{width:'260px',flexShrink:0,display:'flex',flexDirection:'column',borderLeft:`1px solid ${C.border}`,overflow:'hidden',background:C.bg}}>
                <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
                  {[['buy','BUY',C.accent],['sell','SELL',C.red]].map(([v,l,c])=>(
                    <button key={v} onClick={()=>setSideTab(v)} style={{flex:1,fontSize:'12px',letterSpacing:'1px',padding:'11px',background:sideTab===v?`${c}0d`:'transparent',border:'none',borderBottom:`2px solid ${sideTab===v?c:'transparent'}`,color:sideTab===v?c:C.text2,cursor:'pointer',fontWeight:'700',transition:'all 0.1s'}}>{l}</button>
                  ))}
                </div>
                <div style={{flex:1,overflowY:'auto',padding:'14px'}}>
                  {sideTab==='buy'&&(
                    <div>
                      {!wallet?(
                        <button onClick={generateWallet} style={{width:'100%',fontSize:'12px',fontWeight:'700',color:'#000',background:`linear-gradient(135deg,${C.accent},${C.accent2})`,border:'none',padding:'12px',cursor:'pointer',marginBottom:'12px',borderRadius:'10px',boxShadow:`0 0 20px ${C.accent}30`}}>⚡ Generate Devnet Wallet</button>
                      ):(
                        <div style={{...glass(true),padding:'12px',marginBottom:'12px',borderRadius:'10px'}}>
                          <div style={{fontSize:'10px',color:C.text2,marginBottom:'4px',fontFamily:'monospace'}}>DEVNET WALLET</div>
                          <div style={{display:'flex',alignItems:'baseline',gap:'5px',marginBottom:'3px'}}>
                            <span style={{fontSize:'26px',fontWeight:'700',color:C.accent,letterSpacing:'-1px'}}>{(wallet.balance||0).toFixed(4)}</span>
                            <span style={{fontSize:'12px',color:C.text2}}>SOL</span>
                          </div>
                          <div style={{fontFamily:'monospace',fontSize:'10px',color:C.text3,marginBottom:'8px'}}>{tr(wallet.publicKey,6)}</div>
                          <button onClick={airdrop} disabled={txStatus==='pending'} style={{width:'100%',fontSize:'11px',color:C.yellow,background:`${C.yellow}0d`,border:`1px solid ${C.yellow}30`,padding:'6px',cursor:'pointer',borderRadius:'8px',fontWeight:'600'}}>🪂 Airdrop 2 SOL</button>
                        </div>
                      )}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'8px'}}>
                        {['0.05','0.1','0.5','1'].map(amt=>(
                          <button key={amt} onClick={()=>setBuyAmount(amt)} style={{fontSize:'12px',padding:'8px',background:buyAmount===amt?`${C.accent}15`:C.bg3,border:`1px solid ${buyAmount===amt?C.accent:C.border}`,color:buyAmount===amt?C.accent:C.text2,cursor:'pointer',borderRadius:'8px',fontWeight:buyAmount===amt?'700':'400',transition:'all 0.1s'}}>◎{amt}</button>
                        ))}
                      </div>
                      <div style={{display:'flex',marginBottom:'6px',borderRadius:'10px',overflow:'hidden',border:`1px solid ${C.border}`}}>
                        <input value={buyAmount} onChange={e=>setBuyAmount(e.target.value)} style={{flex:1,background:C.bg3,border:'none',color:C.text1,fontSize:'16px',padding:'10px 12px',outline:'none'}}/>
                        <div style={{background:C.bg4,padding:'10px 12px',fontSize:'12px',color:'#9945FF',fontWeight:'700',borderLeft:`1px solid ${C.border}`}}>◎</div>
                      </div>
                      <div style={{fontSize:'11px',color:C.text2,marginBottom:'12px'}}>≈ ${(parseFloat(buyAmount||0)*solPrice).toFixed(2)} USD</div>
                      <button onClick={buy} disabled={!wallet||txStatus==='pending'} style={{width:'100%',fontSize:'14px',fontWeight:'700',color:'#000',background:!wallet?C.bg4:`linear-gradient(135deg,${C.accent},${C.accent2})`,border:'none',padding:'13px',cursor:wallet?'pointer':'not-allowed',borderRadius:'10px',marginBottom:'14px',boxShadow:wallet?`0 0 20px ${C.accent}30`:undefined,transition:'all 0.1s'}}>
                        {txStatus==='pending'?txMsg:'BUY'}
                      </button>
                      {pos&&(
                        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:'12px'}}>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px',marginBottom:'8px'}}>
                            {[['Spent',`◎${pos.solSpent.toFixed(4)}`,C.text2],['PnL',pnlInSol?`◎${posPnlSol.toFixed(4)}`:`$${posPnlUsd.toFixed(2)}`,posPnlUsd>=0?C.accent:C.red]].map(([l,v,c])=>(
                              <div key={l} style={{...glass(),padding:'8px',textAlign:'center',borderRadius:'8px'}}>
                                <div style={{fontSize:'9px',color:C.text3,marginBottom:'2px',fontFamily:'monospace'}}>{l}</div>
                                <div style={{fontSize:'13px',color:c,fontWeight:'700'}}>{v}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{textAlign:'center',fontSize:'22px',color:posPnlUsd>=0?C.accent:C.red,fontWeight:'700',marginBottom:'4px'}}>{posPnlUsd>=0?'+':''}{posPnlPct.toFixed(2)}%</div>
                          <button onClick={()=>setPnlInSol(s=>!s)} style={{width:'100%',fontSize:'10px',color:C.text2,background:C.bg3,border:`1px solid ${C.border}`,padding:'5px',cursor:'pointer',borderRadius:'6px',marginBottom:'6px'}}>Show {pnlInSol?'USD':'SOL'}</button>
                        </div>
                      )}
                      {/* Token info */}
                      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:'12px'}}>
                        <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                          {[['Market Cap',fmt(selected.marketCap)],['Liquidity',fmt(selected.liquidity)],['Bonding',`${selected.bondingCurve}%`],['Age',elapsed(selected.pairCreatedAt)],['Source',selected.source||'unknown']].map(([k,v])=>(
                            <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${C.border}30`}}>
                              <span style={{fontSize:'11px',color:C.text2}}>{k}</span>
                              <span style={{fontSize:'11px',color:C.text1,fontWeight:'600'}}>{v}</span>
                            </div>
                          ))}
                        </div>
                        <button onClick={()=>{navigator.clipboard.writeText(selected.address);setTxMsg('Copied!');setTxStatus('success');setTimeout(()=>{setTxStatus(null);setTxMsg('')},1200)}} style={{width:'100%',marginTop:'10px',fontSize:'10px',color:C.text2,background:C.bg3,border:`1px solid ${C.border}`,padding:'8px',cursor:'pointer',textAlign:'left',borderRadius:'8px',wordBreak:'break-all',fontFamily:'monospace'}}>⎘ {selected.address.slice(0,24)}...</button>
                      </div>
                    </div>
                  )}
                  {sideTab==='sell'&&(
                    !pos?<div style={{textAlign:'center',padding:'40px 20px',color:C.text2,fontSize:'13px'}}>No position<br/><span style={{fontSize:'11px',color:C.text3}}>Buy first</span></div>:
                    <div>
                      <div style={{...glass(posPnlUsd>=0),padding:'14px',marginBottom:'12px',borderRadius:'10px'}}>
                        <div style={{fontSize:'11px',color:C.text2,marginBottom:'5px',fontFamily:'monospace'}}>CURRENT POSITION</div>
                        <div style={{fontSize:'30px',color:posPnlUsd>=0?C.accent:C.red,fontWeight:'700',letterSpacing:'-1px',marginBottom:'3px'}}>{posPnlUsd>=0?'+':''}{posPnlPct.toFixed(2)}%</div>
                        <div style={{fontSize:'12px',color:C.text2}}>{fmtSol(pos.solSpent)} in · {posPnlUsd>=0?'+':''}{fmtSol(posPnlSol)} PNL</div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'10px'}}>
                        {['25','50','75','100'].map(pct=>(
                          <button key={pct} onClick={()=>sellPosition(pos.id,parseInt(pct))} style={{fontSize:'12px',padding:'10px',background:`${C.red}10`,border:`1px solid ${C.red}30`,color:C.red,cursor:'pointer',borderRadius:'8px',fontWeight:'700'}}>SELL {pct}%</button>
                        ))}
                      </div>
                      <button onClick={()=>sellPosition(pos.id,100)} style={{width:'100%',fontSize:'14px',fontWeight:'700',color:'#fff',background:C.red,border:'none',padding:'13px',cursor:'pointer',borderRadius:'10px'}}>SELL ALL</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(0.9)}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.bg4};border-radius:2px}
        ::-webkit-scrollbar-thumb:hover{background:${C.bg5}}
        *{box-sizing:border-box}
        ::selection{background:${C.accent}30;color:${C.accent}}
      `}</style>
    </div>
  )
}
