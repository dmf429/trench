// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Nav from '../../components/Nav'
import * as web3 from '@solana/web3.js'

// Use Helius devnet RPC - much more reliable than public devnet
const HELIUS_DEVNET = `https://devnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY || '870dfde6-09ec-48bd-95b8-202303d15c5b'}`
const HELIUS_MAINNET = `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY || '870dfde6-09ec-48bd-95b8-202303d15c5b'}`

const fmt = (n) => { if(!n||n===0) return '$0'; if(n>=1_000_000) return `$${(n/1_000_000).toFixed(1)}M`; if(n>=1_000) return `$${(n/1_000).toFixed(1)}K`; return `$${n.toFixed(0)}` }
const fmtSol = (n) => n ? `≡ ${parseFloat(n).toFixed(3)}` : '≡ 0'
const fmtPct = (n) => `${n>=0?'+':''}${n.toFixed(0)}%`
const elapsed = (ts) => { const s=Math.floor((Date.now()-ts)/1000); if(s<60) return `${s}s`; if(s<3600) return `${Math.floor(s/60)}m`; return `${Math.floor(s/3600)}h` }
const tr = (a,n=4) => a?`${a.slice(0,n)}...${a.slice(-n)}`:''
const COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9','#FF9F43','#A29BFE','#FD79A8','#6C5CE7','#00B894','#E17055','#74B9FF','#55EFC4','#FDCB6E']

function pairToToken(p, stage) {
  return {
    id: p.pairAddress,
    symbol: p.baseToken?.symbol ?? '???',
    name: p.baseToken?.name ?? 'Unknown',
    address: p.baseToken?.address ?? '',
    pairAddress: p.pairAddress,
    color: COLORS[Math.abs((p.pairAddress?.charCodeAt(0)??0)+(p.pairAddress?.charCodeAt(1)??0)) % COLORS.length],
    price: parseFloat(p.priceUsd ?? '0'),
    marketCap: p.marketCap ?? p.fdv ?? 0,
    liquidity: p.liquidity?.usd ?? 0,
    volume5m: p.volume?.m5 ?? 0,
    volume1h: p.volume?.h1 ?? 0,
    priceChange5m: p.priceChange?.m5 ?? 0,
    priceChange1h: p.priceChange?.h1 ?? 0,
    buys5m: p.txns?.m5?.buys ?? 0,
    sells5m: p.txns?.m5?.sells ?? 0,
    buys1h: p.txns?.h1?.buys ?? 0,
    sells1h: p.txns?.h1?.sells ?? 0,
    age: Date.now() - (p.pairCreatedAt ?? Date.now()),
    bondingCurve: stage==='migrated'?100:stage==='stretch'?Math.random()*25+70:Math.random()*50+5,
    devHolding: Math.random()*20,
    score: Math.floor(Math.random()*100),
    holders: Math.floor((p.liquidity?.usd??1000)/10)+Math.floor(Math.random()*200),
    stage,
    logoUri: p.info?.imageUrl ?? null,
    dexId: p.dexId,
    supply: '1B',
    // Token info stats (simulated - would need on-chain lookup for real)
    top10Holders: (Math.random()*30+5).toFixed(1),
    devHolderPct: (Math.random()*5).toFixed(1),
    snipersH: (Math.random()*3).toFixed(2),
    insiders: (Math.random()*15+1).toFixed(1),
    bundlers: (Math.random()*8+1).toFixed(1),
    lpBurned: Math.random()>0.3?'100%':`${(Math.random()*80).toFixed(0)}%`,
    proTraders: Math.floor(Math.random()*300)+20,
    dexPaid: Math.random()>0.4,
  }
}

// Generate mock holders for a token
function generateHolders(token, count=10) {
  return Array.from({length:count},(_,i)=>({
    rank: i+1,
    wallet: Array.from({length:44},()=>'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789'[Math.floor(Math.random()*58)]).join(''),
    solBalance: (Math.random()*100+0.1).toFixed(2),
    lastActive: `${Math.floor(Math.random()*60)}m`,
    bought: (Math.random()*5+0.01).toFixed(3),
    avgBuy: (Math.random()*0.001).toFixed(6),
    sold: Math.random()>0.5?(Math.random()*3).toFixed(3):'0',
    avgSell: Math.random()>0.5?(Math.random()*0.002).toFixed(6):'—',
    pnl: ((Math.random()-0.3)*5).toFixed(3),
    remaining: (Math.random()*60+1).toFixed(1),
    pct: (Math.random()*15+0.5).toFixed(2),
    type: i===0?'LIQUIDITY POOL':i<3?['DEV','INSIDER'][Math.floor(Math.random()*2)]:Math.random()>0.8?'SNIPER':'',
    via: ['Kraken','Coinbase','Binance',''][Math.floor(Math.random()*4)],
  }))
}

export default function RadarPage() {
  const [newPairs, setNewPairs] = useState([])
  const [stretch, setStretch] = useState([])
  const [migrated, setMigrated] = useState([])
  const [selected, setSelected] = useState(null)
  const [wallet, setWallet] = useState(null)
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
  const [bubbleView, setBubbleView] = useState(0)
  const [loading, setLoading] = useState(true)
  const [holders, setHolders] = useState([])
  const [trades, setTrades] = useState([])
  const searchTimeout = useRef(null)
  const conn = useRef(new web3.Connection(HELIUS_DEVNET, 'confirmed'))

  // ── Fetch real pairs ──────────────────────────────────
  const fetchPairs = useCallback(async () => {
    try {
      const queries = ['pump sol', 'pump fun', 'solana memecoin']
      const results = await Promise.allSettled(queries.map(q =>
        fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`)
          .then(r => r.json()).catch(() => ({pairs:[]}))
      ))
      const seen = new Set()
      const allPairs = []
      for (const r of results) {
        if (r.status !== 'fulfilled') continue
        for (const p of (r.value.pairs ?? [])) {
          if (p.chainId !== 'solana') continue
          if (seen.has(p.pairAddress)) continue
          if ((p.liquidity?.usd ?? 0) < 300) continue
          seen.add(p.pairAddress)
          allPairs.push(p)
        }
      }
      allPairs.sort((a,b) => (b.pairCreatedAt??0)-(a.pairCreatedAt??0))
      const newP=[], stretchP=[], migratedP=[]
      for (const p of allPairs) {
        const isMigrated = ['raydium','meteora','orca'].includes(p.dexId)
        const mcap = p.marketCap ?? p.fdv ?? 0
        if (isMigrated) migratedP.push(pairToToken(p,'migrated'))
        else if (mcap > 50000) stretchP.push(pairToToken(p,'stretch'))
        else newP.push(pairToToken(p,'new'))
      }
      if (newP.length) setNewPairs(newP.slice(0,12))
      if (stretchP.length) setStretch(stretchP.slice(0,8))
      if (migratedP.length) setMigrated(migratedP.slice(0,12))
      setLoading(false)
    } catch(e) { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchPairs()
    const iv = setInterval(fetchPairs, 15000)
    return () => clearInterval(iv)
  }, [fetchPairs])

  // Update selected token from feed
  useEffect(() => {
    if (!selected) return
    const all = [...newPairs,...stretch,...migrated]
    const updated = all.find(t=>t.id===selected.id)
    if (updated) setSelected(updated)
  }, [newPairs, stretch, migrated])

  // Generate mock trades for selected token
  useEffect(() => {
    if (!selected) return
    setTrades(Array.from({length:12},(_,i)=>{
      const isBuy = Math.random()>0.4
      return {
        id: i, age: Math.floor(Math.random()*60),
        type: isBuy?'Buy':'Sell',
        mc: selected.marketCap*(0.97+Math.random()*0.06),
        amount: (Math.random()*1000000+1000).toFixed(0),
        totalSol: (Math.random()*2+0.01).toFixed(3),
        wallet: Array.from({length:44},()=>'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789'[Math.floor(Math.random()*58)]).join(''),
        txns: Math.floor(Math.random()*8)+1,
        isBuy,
      }
    }))
    setHolders(generateHolders(selected, 12))
  }, [selected?.id])

  // ── Search ────────────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setSearchResults((data.pairs??[]).filter(p=>p.chainId==='solana').slice(0,8))
    } catch { setSearchResults([]) }
    setSearching(false)
  }, [])

  useEffect(() => {
    clearTimeout(searchTimeout.current)
    if (searchQuery.length>=2) searchTimeout.current = setTimeout(()=>doSearch(searchQuery), 200)
    else setSearchResults([])
  }, [searchQuery, doSearch])

  // ── Wallet ────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('trench_radar_wallet')
    if (!saved) return
    const data = JSON.parse(saved)
    setWallet(data)
    refreshBalance(data.publicKey)
  }, [])

  const refreshBalance = async (pubkeyStr) => {
    try {
      const pk = new web3.PublicKey(pubkeyStr)
      const bal = await conn.current.getBalance(pk)
      setWallet(w => w ? {...w, balance: bal/web3.LAMPORTS_PER_SOL} : null)
    } catch(e) { console.error('balance error:', e.message) }
  }

  const generateWallet = async () => {
    const kp = web3.Keypair.generate()
    const data = {publicKey:kp.publicKey.toString(),secretKey:Array.from(kp.secretKey),balance:0,network:'devnet'}
    localStorage.setItem('trench_radar_wallet',JSON.stringify(data))
    setWallet(data)
  }

  const airdrop = async () => {
    if (!wallet) return
    setTxStatus('pending')
    setTxMsg('REQUESTING AIRDROP...')
    try {
      // Use public Solana devnet RPC with retry logic
      const rpcs = [
        'https://api.devnet.solana.com',
        'https://rpc.ankr.com/solana_devnet',
        'https://devnet.sonic.game',
      ]
      let sig = null
      let workingConn = null
      for (const rpc of rpcs) {
        try {
          const c = new web3.Connection(rpc, { commitment: 'confirmed', confirmTransactionInitialTimeout: 20000 })
          const pk = new web3.PublicKey(wallet.publicKey)
          sig = await c.requestAirdrop(pk, 2 * web3.LAMPORTS_PER_SOL)
          workingConn = c
          break
        } catch(e) { console.log('RPC failed, trying next:', rpc, e.message) }
      }
      if (!sig || !workingConn) throw new Error('All RPCs failed')
      setTxMsg('CONFIRMING...')
      // Poll balance
      const pk = new web3.PublicKey(wallet.publicKey)
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 1500))
        try {
          const bal = await workingConn.getBalance(pk)
          if (bal > 0) {
            setWallet(w => ({...w, balance: bal/web3.LAMPORTS_PER_SOL}))
            setTxStatus('success')
            setTxMsg('2 SOL AIRDROPPED! ✓')
            setTimeout(() => { setTxStatus(null); setTxMsg('') }, 4000)
            return
          }
        } catch {}
      }
      // Timeout but maybe it landed
      const finalBal = await workingConn.getBalance(pk).catch(()=>0)
      setWallet(w => ({...w, balance: finalBal/web3.LAMPORTS_PER_SOL}))
      setTxStatus(finalBal>0?'success':'error')
      setTxMsg(finalBal>0?'AIRDROP LANDED!':'DEVNET CONGESTED - TRY AGAIN')
      setTimeout(() => { setTxStatus(null); setTxMsg('') }, 4000)
    } catch(e) {
      console.error('airdrop error:', e)
      setTxStatus('error')
      setTxMsg('DEVNET UNAVAILABLE - TRY faucet.solana.com')
      setTimeout(() => { setTxStatus(null); setTxMsg('') }, 5000)
    }
  }

  const buy = async () => {
    if (!wallet||!selected) return
    const amt = parseFloat(buyAmount)
    if (isNaN(amt)||amt<=0||amt>(wallet.balance||0)) {
      setTxStatus('error'); setTxMsg('INSUFFICIENT BALANCE')
      setTimeout(()=>{setTxStatus(null);setTxMsg('')},2000)
      return
    }
    setTxStatus('pending'); setTxMsg('SIMULATING BUY...')
    await new Promise(r=>setTimeout(r,1200))
    const received = (amt/Math.max(selected.price,0.000000001))*0.97
    setPositions(prev=>[{id:Math.random().toString(36).slice(2),token:{...selected},entryPrice:selected.price,tokensHeld:received,solSpent:amt,currentPrice:selected.price,pnl:0,pnlPct:0,ts:Date.now()},...prev])
    setWallet(w=>({...w,balance:(w.balance||0)-amt}))
    setTxStatus('success'); setTxMsg(`BOUGHT ${received.toExponential(2)} ${selected.symbol}`)
    setSideTab('bags')
    setTimeout(()=>{setTxStatus(null);setTxMsg('')},3000)
  }

  const sell = (posId) => {
    const pos = positions.find(p=>p.id===posId)
    if(!pos) return
    const val = pos.tokensHeld*pos.currentPrice*0.97
    setWallet(w=>({...w,balance:(w.balance||0)+val}))
    setPositions(prev=>prev.filter(p=>p.id!==posId))
  }

  const selectToken = (token) => {
    setSelected(token); setSideTab('buy'); setBottomTab('trades')
    setShowSearch(false); setSearchQuery('')
  }

  const pos = positions.find(p=>p.token.id===selected?.id)

  // ── Bubble Map ────────────────────────────────────────
  const BubbleMap = ({view, token}) => {
    const views = ['Top Holders','Dev & Insiders','Bundlers','Snipers']
    const bubbleColors = [
      ['#00FF88','#FFD700','#FF6B6B','#4ECDC4','#A29BFE'],
      ['#FF3366','#FF8800','#FFD700'],
      ['#0088ff','#6C5CE7','#A29BFE'],
      ['#FFD700','#FF3366','#FF8800'],
    ]
    const n = [12,8,15,10][view]
    const seed = token?.id || 'default'
    const bubbles = Array.from({length:n},(_,i)=>{
      const hash = seed.charCodeAt(i%seed.length)
      return {
        x: 10+(((hash*137+i*89)%80)),
        y: 10+(((hash*71+i*53)%75)),
        r: 4+((hash+i)%8),
        color: bubbleColors[view][(hash+i)%bubbleColors[view].length],
        pct: ((hash+i*3)%15+0.5).toFixed(1)+'%',
        label: tr(token?.address||'',3),
      }
    })
    return (
      <div style={{flex:1,position:'relative',background:'#050508',overflow:'hidden',minHeight:'100%'}}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" style={{position:'absolute',inset:0}}>
          {bubbles.slice(0,5).map((b,i)=>bubbles.slice(i+1,i+3).map((b2,j)=>(
            <line key={`l${i}${j}`} x1={b.x} y1={b.y} x2={b2.x} y2={b2.y} stroke="#1a1a2e" strokeWidth="0.2" opacity="0.6"/>
          )))}
          {bubbles.map((b,i)=>(
            <g key={i} style={{cursor:'pointer'}}>
              <circle cx={b.x} cy={b.y} r={b.r} fill={b.color} opacity="0.8" stroke={b.color} strokeWidth="0.2"/>
              {b.r>5&&<text x={b.x} y={b.y+0.8} textAnchor="middle" fontSize="2" fill="#050508" fontFamily="monospace" fontWeight="bold">{b.pct}</text>}
            </g>
          ))}
        </svg>
      </div>
    )
  }

  // ── Token Card ────────────────────────────────────────
  const TokenCard = ({token}) => {
    const up = token.priceChange5m>=0
    const isSel = selected?.id===token.id
    return (
      <div onClick={()=>selectToken(token)}
        style={{background:isSel?'rgba(0,255,136,0.05)':'#0a0a10',border:`1px solid ${isSel?'rgba(0,255,136,0.35)':'#1a1a2e'}`,padding:'9px',cursor:'pointer',marginBottom:'4px',borderLeft:isSel?'2px solid #00FF88':'2px solid transparent'}}
        onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background='#0d0d18'}}
        onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background='#0a0a10'}}
      >
        <div style={{display:'flex',alignItems:'center',gap:'7px',marginBottom:'6px'}}>
          {token.logoUri?(
            <img src={token.logoUri} alt="" style={{width:'30px',height:'30px',borderRadius:'50%',objectFit:'cover',flexShrink:0}} onError={e=>e.target.style.display='none'}/>
          ):(
            <div style={{width:'30px',height:'30px',borderRadius:'50%',background:token.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'12px',color:'#050508',flexShrink:0,fontWeight:'bold'}}>{token.symbol[0]}</div>
          )}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#e0e0f0',fontWeight:'bold'}}>{token.symbol}</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{token.name}</div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:up?'#00FF88':'#FF3366',fontWeight:'bold'}}>{fmtPct(token.priceChange5m)}</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{elapsed(token.age)}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'2px',marginBottom:'5px'}}>
          {[['V',fmt(token.volume5m),'#e0e0f0'],['MC',fmt(token.marketCap),'#FFD700'],['B',token.buys5m,'#00FF88'],['S',token.sells5m,'#FF3366']].map(([l,v,c])=>(
            <div key={l} style={{textAlign:'center',background:'#070710',padding:'2px'}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c'}}>{l}</div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:c}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:'5px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'2px'}}>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c'}}>BONDING</span>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:token.bondingCurve>80?'#FF3366':token.bondingCurve>50?'#FFD700':'#00FF88'}}>{token.bondingCurve.toFixed(0)}%</span>
          </div>
          <div style={{height:'2px',background:'#1a1a2e',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${token.bondingCurve}%`,background:token.bondingCurve>80?'#FF3366':token.bondingCurve>50?'#FFD700':'#00FF88'}}/>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',padding:'1px 4px',background:token.devHolding<10?'rgba(0,255,136,0.1)':'rgba(255,51,102,0.1)',color:token.devHolding<10?'#00FF88':'#FF3366',border:`1px solid ${token.devHolding<10?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)'}`}}>DEV {token.devHolding.toFixed(0)}%</span>
          <button onClick={e=>{e.stopPropagation();selectToken(token);setSideTab('buy')}} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'2px 7px',background:'rgba(0,255,136,0.1)',border:'1px solid rgba(0,255,136,0.3)',color:'#00FF88',cursor:'pointer'}}>⚡ BUY</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#050508',color:'#e0e0f0',fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      <Nav active="/radar"/>

      {/* Toast */}
      {txStatus&&(
        <div style={{position:'fixed',top:'60px',right:'20px',zIndex:9999,padding:'8px 16px',background:txStatus==='success'?'rgba(0,255,136,0.1)':txStatus==='error'?'rgba(255,51,102,0.1)':'rgba(10,10,16,0.98)',border:`1px solid ${txStatus==='success'?'rgba(0,255,136,0.4)':txStatus==='error'?'rgba(255,51,102,0.4)':'#1a1a2e'}`,fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:txStatus==='success'?'#00FF88':txStatus==='error'?'#FF3366':'#6666aa',letterSpacing:'1px',maxWidth:'300px'}}>
          {txStatus==='pending'?`⟳ ${txMsg||'PROCESSING...'}`:txStatus==='success'?`✓ ${txMsg||'SUCCESS'}`:`✗ ${txMsg||'FAILED'}`}
        </div>
      )}

      {/* Search Modal */}
      {showSearch&&(
        <div style={{position:'fixed',inset:0,zIndex:500,background:'rgba(5,5,8,0.88)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'80px'}} onClick={()=>{setShowSearch(false);setSearchQuery('')}}>
          <div style={{width:'580px',background:'#0a0a10',border:'1px solid #1a1a2e'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',gap:'6px',padding:'10px 14px',borderBottom:'1px solid #1a1a2e'}}>
              {['Pump','Bonk','Bags','USD1','OG Mode','All'].map(f=>(
                <button key={f} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'3px 10px',background:'rgba(0,136,255,0.08)',border:'1px solid rgba(0,136,255,0.2)',color:'#0088ff',cursor:'pointer',borderRadius:'12px'}}>{f}</button>
              ))}
            </div>
            <div style={{position:'relative',padding:'10px 14px',borderBottom:'1px solid #1a1a2e',display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'14px',color:'#3a3a5c'}}>⌕</span>
              <input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                onKeyDown={e=>e.key==='Escape'&&(setShowSearch(false),setSearchQuery(''))}
                placeholder="Search by name, ticker, or paste CA..."
                style={{flex:1,background:'transparent',border:'none',color:'#e0e0f0',fontFamily:"'Share Tech Mono',monospace",fontSize:'13px',outline:'none'}}/>
              {searching&&<span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>SEARCHING...</span>}
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',border:'1px solid #1a1a2e',padding:'2px 5px'}}>ESC</span>
            </div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',padding:'8px 14px',letterSpacing:'1px'}}>RESULTS</div>
            <div style={{maxHeight:'360px',overflowY:'auto'}}>
              {searchResults.length===0&&searchQuery.length>=2&&!searching&&(
                <div style={{padding:'24px',textAlign:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#3a3a5c'}}>No Solana pairs found for "{searchQuery}"</div>
              )}
              {searchResults.map(p=>{
                const t = pairToToken(p, ['raydium','meteora','orca'].includes(p.dexId)?'migrated':(p.marketCap??0)>50000?'stretch':'new')
                const up = (p.priceChange?.h24??0)>=0
                return (
                  <div key={p.pairAddress} onClick={()=>selectToken(t)}
                    style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid #0d0d18'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#0d0d18'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  >
                    {p.info?.imageUrl?(
                      <img src={p.info.imageUrl} alt="" style={{width:'36px',height:'36px',borderRadius:'50%',objectFit:'cover',flexShrink:0}} onError={e=>e.target.style.display='none'}/>
                    ):(
                      <div style={{width:'36px',height:'36px',borderRadius:'50%',background:t.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'14px',color:'#050508',flexShrink:0}}>{t.symbol[0]}</div>
                    )}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px'}}>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#e0e0f0',fontWeight:'bold'}}>{p.baseToken?.symbol}</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'180px'}}>{p.baseToken?.name}</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'1px 5px',background:'rgba(0,136,255,0.1)',color:'#0088ff',border:'1px solid rgba(0,136,255,0.2)',flexShrink:0}}>{p.dexId}</span>
                      </div>
                      <div style={{display:'flex',gap:'14px'}}>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa'}}>MC {fmt(p.marketCap??p.fdv)}</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa'}}>V {fmt(p.volume?.h24)}</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa'}}>L {fmt(p.liquidity?.usd)}</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:up?'#00FF88':'#FF3366'}}>{up?'+':''}{(p.priceChange?.h24??0).toFixed(1)}%</span>
                      </div>
                    </div>
                    <button style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'5px 12px',background:'rgba(255,136,0,0.15)',border:'1px solid rgba(255,136,0,0.4)',color:'#FF8800',cursor:'pointer',flexShrink:0,borderRadius:'2px'}}>⚡ 0 SOL</button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',flex:1,overflow:'hidden',marginTop:'52px'}}>

        {!selected?(
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Header */}
            <div style={{padding:'7px 14px',borderBottom:'1px solid #1a1a2e',background:'#070710',display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'6px',flexShrink:0}}>
                <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#FF3366',animation:'rp 1s infinite',boxShadow:'0 0 6px #FF336688'}}/>
                <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'16px',letterSpacing:'3px'}}>RADAR</span>
              </div>
              <div onClick={()=>setShowSearch(true)} style={{flex:1,display:'flex',alignItems:'center',gap:'8px',background:'#0a0a10',border:'1px solid #1a1a2e',padding:'6px 12px',cursor:'text'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#3a3a5c'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='#1a1a2e'}
              >
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#3a3a5c'}}>⌕</span>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#3a3a5c',letterSpacing:'0.5px'}}>Search by name, ticker, or paste contract address...</span>
              </div>
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',flexShrink:0}}>
                {loading?'SCANNING...`':`${newPairs.length+stretch.length+migrated.length} PAIRS LIVE`}
              </span>
            </div>
            {/* 3 cols */}
            <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',overflow:'hidden'}}>
              {[
                {label:'NEW PAIRS',color:'#00FF88',tokens:newPairs,desc:'Non-migrated · Pump.fun'},
                {label:'FINAL STRETCH',color:'#FFD700',tokens:stretch,desc:'80%+ bonding · Migrating soon'},
                {label:'MIGRATED',color:'#0088ff',tokens:migrated,desc:'Raydium/Meteora · Live'},
              ].map((col,ci)=>(
                <div key={col.label} style={{display:'flex',flexDirection:'column',overflow:'hidden',borderRight:ci<2?'1px solid #1a1a2e':'none'}}>
                  <div style={{padding:'7px 10px',borderBottom:'1px solid #1a1a2e',background:'#050508',flexShrink:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'5px',marginBottom:'1px'}}>
                      <div style={{width:'5px',height:'5px',borderRadius:'50%',background:col.color,animation:ci===0?'rp 1.5s infinite':'none'}}/>
                      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'12px',letterSpacing:'3px',color:col.color}}>{col.label}</span>
                      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',marginLeft:'auto'}}>{col.tokens.length}</span>
                    </div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{col.desc}</div>
                  </div>
                  <div style={{flex:1,overflowY:'auto',padding:'6px'}}>
                    {loading?(
                      <div style={{textAlign:'center',padding:'40px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',letterSpacing:'2px'}}>SCANNING PUMP.FUN...</div>
                    ):col.tokens.length===0?(
                      <div style={{textAlign:'center',padding:'40px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#1a1a2e'}}>NO PAIRS</div>
                    ):col.tokens.map(t=><TokenCard key={t.id} token={t}/>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ):(
          // ── TOKEN DETAIL ──
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

            {/* Top bar */}
            <div style={{padding:'5px 12px',borderBottom:'1px solid #1a1a2e',background:'#070710',display:'flex',alignItems:'center',gap:'8px',flexShrink:0,flexWrap:'nowrap',overflowX:'auto'}}>
              <button onClick={()=>setSelected(null)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',background:'none',border:'1px solid #1a1a2e',padding:'4px 8px',cursor:'pointer',flexShrink:0}}>← BACK</button>
              {selected.logoUri?(
                <img src={selected.logoUri} alt="" style={{width:'24px',height:'24px',borderRadius:'50%',objectFit:'cover',flexShrink:0}} onError={e=>e.target.style.display='none'}/>
              ):(
                <div style={{width:'24px',height:'24px',borderRadius:'50%',background:selected.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'10px',color:'#050508',flexShrink:0}}>{selected.symbol[0]}</div>
              )}
              <div style={{flexShrink:0}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'14px',letterSpacing:'2px',lineHeight:1}}>${selected.symbol}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',maxWidth:'100px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selected.name}</div>
              </div>
              {/* Timeframes */}
              <div style={{display:'flex',gap:'1px',background:'#1a1a2e',padding:'1px',flexShrink:0}}>
                {['1s','1m','5m','15m','1h','4h','D'].map(tf=>(
                  <button key={tf} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'3px 5px',background:tf==='5m'?'#2a2a3e':'transparent',border:'none',color:tf==='5m'?'#e0e0f0':'#6666aa',cursor:'pointer'}}>{tf}</button>
                ))}
              </div>
              {/* Stats */}
              {[
                ['PRICE',`$${selected.price.toExponential(2)}`,'#e0e0f0'],
                ['LIQ',fmt(selected.liquidity),'#e0e0f0'],
                ['SUPPLY',selected.supply,'#6666aa'],
                ['B.CURVE',`${selected.bondingCurve.toFixed(0)}%`,selected.bondingCurve>80?'#FF3366':'#FFD700'],
                ['1H VOL',fmt(selected.volume1h),'#e0e0f0'],
                ['BUYS',selected.buys1h,'#00FF88'],
                ['SELLS',selected.sells1h,'#FF3366'],
                ['NET VOL',fmt(Math.abs((selected.buys1h-selected.sells1h)*selected.price*1000)),selected.buys1h>selected.sells1h?'#00FF88':'#FF3366'],
              ].map(([l,v,c])=>(
                <div key={l} style={{flexShrink:0}}>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',letterSpacing:'1px'}}>{l}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:c,fontWeight:'bold'}}>{v}</div>
                </div>
              ))}
              <div style={{marginLeft:'auto',display:'flex',gap:'6px',alignItems:'center',flexShrink:0}}>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'2px 6px',background:selected.devHolding<10?'rgba(0,255,136,0.08)':'rgba(255,51,102,0.08)',color:selected.devHolding<10?'#00FF88':'#FF3366',border:`1px solid ${selected.devHolding<10?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)'}`}}>DEV {selected.devHolding.toFixed(0)}%</span>
                <a href={`https://dexscreener.com/solana/${selected.pairAddress}`} target="_blank" rel="noreferrer" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',border:'1px solid #1a1a2e',padding:'2px 6px',textDecoration:'none'}}>DEX ↗</a>
              </div>
            </div>

            {/* Chart + right panel */}
            <div style={{flex:1,display:'flex',overflow:'hidden'}}>

              {/* Chart column */}
              <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                {/* Chart */}
                <div style={{flex:1,position:'relative',background:'#000',overflow:'hidden'}}>
                  <iframe
                    key={selected.pairAddress}
                    src={`https://dexscreener.com/solana/${selected.pairAddress}?embed=1&theme=dark&trades=0&info=0`}
                    style={{width:'100%',height:'calc(100% + 52px)',border:'none'}}
                    title={`${selected.symbol} Chart`}
                  />
                  {/* Cover DexScreener footer */}
                  <div style={{position:'absolute',bottom:0,left:0,right:0,height:'52px',background:'#050508',zIndex:5,display:'flex',alignItems:'center',padding:'0 12px',gap:'8px',borderTop:'1px solid #1a1a2e'}}>
                    {['3m','1m','5d','1d'].map(tf=>(
                      <button key={tf} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'2px 6px',background:'#0a0a10',border:'1px solid #1a1a2e',color:'#6666aa',cursor:'pointer'}}>{tf}</button>
                    ))}
                    <div style={{marginLeft:'auto',fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{new Date().toLocaleTimeString()} UTC</div>
                  </div>
                </div>

                {/* Bottom section */}
                <div style={{height:'220px',borderTop:'1px solid #1a1a2e',flexShrink:0,display:'flex',flexDirection:'column'}}>
                  {/* Tab bar */}
                  <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',background:'#070710',flexShrink:0}}>
                    {[
                      ['trades','TRADES'],['positions','POSITIONS'],['orders','ORDERS'],
                      ['holders',`HOLDERS (${selected.holders})`],['top_traders','TOP TRADERS'],['dev_tokens','DEV TOKENS'],
                    ].map(([v,l])=>(
                      <button key={v} onClick={()=>setBottomTab(v)}
                        style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',letterSpacing:'1px',padding:'7px 10px',background:'none',border:'none',borderBottom:`2px solid ${bottomTab===v?'#00FF88':'transparent'}`,color:bottomTab===v?'#00FF88':'#6666aa',cursor:'pointer',whiteSpace:'nowrap'}}>{l}</button>
                    ))}
                    <div style={{marginLeft:'auto',display:'flex',alignItems:'center',padding:'0 8px'}}>
                      <button style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'3px 8px',background:'rgba(255,51,102,0.1)',border:'1px solid rgba(255,51,102,0.3)',color:'#FF3366',cursor:'pointer'}}>⚡ INSTANT TRADE</button>
                    </div>
                  </div>

                  <div style={{flex:1,overflow:'hidden',display:'flex'}}>
                    {/* TRADES TAB */}
                    {bottomTab==='trades'&&(
                      <div style={{flex:1,overflowY:'auto'}}>
                        <div style={{display:'grid',gridTemplateColumns:'40px 50px 70px 1fr 80px 80px 50px',padding:'3px 12px',background:'#050508',fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',letterSpacing:'1px',position:'sticky',top:0}}>
                          <span>AGE</span><span>TYPE</span><span>MC</span><span>AMOUNT</span><span>TOTAL SOL</span><span>TRADER</span><span>TXNS</span>
                        </div>
                        {trades.map(t=>(
                          <div key={t.id} style={{display:'grid',gridTemplateColumns:'40px 50px 70px 1fr 80px 80px 50px',padding:'4px 12px',borderBottom:'1px solid #0a0a0f',alignItems:'center'}}>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{t.age}s</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:t.isBuy?'#00FF88':'#FF3366',fontWeight:'bold'}}>{t.type}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa'}}>{fmt(t.mc)}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#e0e0f0'}}>{parseInt(t.amount).toLocaleString()}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:t.isBuy?'#00FF88':'#FF3366',background:t.isBuy?'rgba(0,255,136,0.05)':'rgba(255,51,102,0.05)',padding:'1px 4px',textAlign:'right'}}>${(parseFloat(t.totalSol)*20).toFixed(2)}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#6666aa',overflow:'hidden',textOverflow:'ellipsis'}}>{tr(t.wallet,4)}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',textAlign:'right'}}>{t.txns}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* HOLDERS TAB — Axiom style with table + bubble map */}
                    {bottomTab==='holders'&&(
                      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
                        {/* Left: holders table */}
                        <div style={{flex:1,overflowY:'auto'}}>
                          {/* Column headers */}
                          <div style={{display:'grid',gridTemplateColumns:'24px 140px 70px 80px 80px 90px 70px 50px',padding:'3px 12px',background:'#050508',fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',letterSpacing:'1px',position:'sticky',top:0,gap:'4px'}}>
                            <span>#</span><span>WALLET</span><span>SOL BAL</span><span>BOUGHT</span><span>SOLD</span><span>U. PNL</span><span>REMAINING</span><span>HELD</span>
                          </div>
                          {holders.map((h,i)=>{
                            const pnlNum = parseFloat(h.pnl)
                            const up = pnlNum >= 0
                            return (
                              <div key={i} style={{display:'grid',gridTemplateColumns:'24px 140px 70px 80px 80px 90px 70px 50px',padding:'5px 12px',borderBottom:'1px solid #0a0a0f',alignItems:'center',gap:'4px',background:i===0?'rgba(0,136,255,0.03)':'transparent'}}
                                onMouseEnter={e=>e.currentTarget.style.background='#0a0a10'}
                                onMouseLeave={e=>e.currentTarget.style.background=i===0?'rgba(0,136,255,0.03)':'transparent'}
                              >
                                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{h.rank}</span>
                                <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                                  {h.type&&<span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',padding:'1px 4px',background:h.type==='LIQUIDITY POOL'?'rgba(0,136,255,0.1)':h.type==='DEV'?'rgba(255,51,102,0.1)':'rgba(255,215,0,0.1)',color:h.type==='LIQUIDITY POOL'?'#0088ff':h.type==='DEV'?'#FF3366':'#FFD700',border:`1px solid ${h.type==='LIQUIDITY POOL'?'rgba(0,136,255,0.2)':h.type==='DEV'?'rgba(255,51,102,0.2)':'rgba(255,215,0,0.2)'}`,flexShrink:0}}>{h.type==='LIQUIDITY POOL'?'LP':h.type}</span>}
                                  <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tr(h.wallet,5)}</span>
                                  {h.via&&<span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',flexShrink:0}}>·{h.via}</span>}
                                </div>
                                <div>
                                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#e0e0f0'}}>≡ {h.solBalance}</div>
                                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c'}}>{h.lastActive}</div>
                                </div>
                                <div>
                                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#00FF88'}}>${(parseFloat(h.bought)*20).toFixed(0)}</div>
                                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c'}}>{h.avgBuy}</div>
                                </div>
                                <div>
                                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#FF3366'}}>{h.sold==='0'?'$0':`$${(parseFloat(h.sold)*20).toFixed(0)}`}</div>
                                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c'}}>{h.avgSell}</div>
                                </div>
                                <div>
                                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:up?'#00FF88':'#FF3366',fontWeight:'bold'}}>{up?'+':''}{(pnlNum*20).toFixed(0)}$</div>
                                </div>
                                <div>
                                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#e0e0f0'}}>{h.remaining}%</div>
                                </div>
                                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa'}}>{h.pct}%</div>
                              </div>
                            )
                          })}
                        </div>
                        {/* Right: bubble map */}
                        <div style={{width:'200px',flexShrink:0,borderLeft:'1px solid #1a1a2e',display:'flex',flexDirection:'column'}}>
                          <div style={{padding:'6px',borderBottom:'1px solid #1a1a2e',display:'flex',gap:'3px',flexWrap:'wrap',background:'#070710'}}>
                            {['Top','Dev & Ins.','Bundlers','Snipers'].map((v,i)=>(
                              <button key={v} onClick={()=>setBubbleView(i)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',padding:'2px 5px',background:bubbleView===i?'rgba(0,255,136,0.1)':'transparent',border:`1px solid ${bubbleView===i?'rgba(0,255,136,0.3)':'#1a1a2e'}`,color:bubbleView===i?'#00FF88':'#6666aa',cursor:'pointer'}}>{v}</button>
                            ))}
                          </div>
                          <div style={{flex:1,position:'relative'}}>
                            <BubbleMap view={bubbleView} token={selected}/>
                          </div>
                        </div>
                      </div>
                    )}

                    {bottomTab==='positions'&&(
                      <div style={{flex:1,overflowY:'auto',padding:'10px'}}>
                        {pos?(
                          <div style={{background:'#0a0a10',border:'1px solid rgba(0,255,136,0.2)',padding:'12px'}}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px'}}>${pos.token.symbol}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:pos.pnl>=0?'#00FF88':'#FF3366',fontWeight:'bold'}}>{pos.pnl>=0?'+':''}{pos.pnlPct.toFixed(1)}%</span>
                            </div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',marginBottom:'8px'}}>{pos.solSpent.toFixed(3)} SOL spent · {pos.tokensHeld.toExponential(2)} {pos.token.symbol}</div>
                            <button onClick={()=>sell(pos.id)} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#FF3366',background:'rgba(255,51,102,0.05)',border:'1px solid rgba(255,51,102,0.3)',padding:'6px',cursor:'pointer'}}>SELL ALL</button>
                          </div>
                        ):(
                          <div style={{textAlign:'center',padding:'24px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c'}}>NO POSITION IN ${selected.symbol}</div>
                        )}
                      </div>
                    )}

                    {(bottomTab==='orders'||bottomTab==='top_traders'||bottomTab==='dev_tokens')&&(
                      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#1a1a2e',letterSpacing:'2px'}}>COMING SOON</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right panel */}
              <div style={{width:'256px',flexShrink:0,display:'flex',flexDirection:'column',borderLeft:'1px solid #1a1a2e',overflow:'hidden'}}>
                <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',flexShrink:0}}>
                  {[['buy','BUY','#00FF88'],['sell','SELL','#FF3366'],['bags',`BAGS(${positions.length})`,'#0088ff']].map(([v,l,c])=>(
                    <button key={v} onClick={()=>setSideTab(v)} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',letterSpacing:'1px',padding:'9px',background:sideTab===v?`rgba(${v==='buy'?'0,255,136':v==='sell'?'255,51,102':'0,136,255'},0.06)`:'transparent',border:'none',borderBottom:`2px solid ${sideTab===v?c:'transparent'}`,color:sideTab===v?c:'#6666aa',cursor:'pointer'}}>{l}</button>
                  ))}
                </div>

                <div style={{flex:1,overflowY:'auto'}}>
                  {sideTab==='buy'&&(
                    <div style={{padding:'10px'}}>
                      {/* Bought/Sold/Holding/PnL — Axiom style */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'1px',background:'#1a1a2e',marginBottom:'8px'}}>
                        {[
                          ['Bought',pos?fmtSol(pos.solSpent):'≡ 0'],
                          ['Sold','≡ 0'],
                          ['Holding',pos?`≡ ${(pos.tokensHeld*0.001).toFixed(0)}K`:'≡ 0'],
                          ['PnL',pos?`${pos.pnl>=0?'+':''}${pos.pnl.toFixed(3)}`:'+0(0%)'],
                        ].map(([l,v])=>(
                          <div key={l} style={{background:'#0a0a10',padding:'5px 4px',textAlign:'center'}}>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',marginBottom:'2px'}}>{l}</div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:l==='PnL'&&pos?pos.pnl>=0?'#00FF88':'#FF3366':'#6666aa'}}>{v}</div>
                          </div>
                        ))}
                      </div>

                      {/* Presets */}
                      <div style={{display:'flex',gap:'3px',marginBottom:'8px'}}>
                        {['PRESET 1','PRESET 2','PRESET 3'].map((p,i)=>(
                          <button key={p} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',padding:'4px 2px',background:i===0?'rgba(255,51,102,0.15)':'#0a0a10',border:`1px solid ${i===0?'rgba(255,51,102,0.35)':'#1a1a2e'}`,color:i===0?'#FF3366':'#6666aa',cursor:'pointer'}}>{p}</button>
                        ))}
                      </div>

                      {/* Wallet display */}
                      {!wallet?(
                        <button onClick={generateWallet} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',letterSpacing:'2px',color:'#050508',background:'#00FF88',border:'none',padding:'9px',cursor:'pointer',marginBottom:'8px',clipPath:'polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)'}}>⚡ GENERATE WALLET</button>
                      ):(
                        <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'8px',marginBottom:'8px'}}>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',marginBottom:'2px'}}>RADAR WALLET · DEVNET</div>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'20px',color:'#00FF88',letterSpacing:'2px',lineHeight:1}}>{(wallet.balance||0).toFixed(4)} SOL</div>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#6666aa',marginBottom:'5px'}}>{tr(wallet.publicKey,6)}</div>
                          <button onClick={airdrop} disabled={txStatus==='pending'} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#FFD700',background:'rgba(255,215,0,0.05)',border:'1px solid rgba(255,215,0,0.25)',padding:'4px',cursor:txStatus==='pending'?'default':'pointer',opacity:txStatus==='pending'?0.6:1}}>
                            {txStatus==='pending'?`⟳ ${txMsg}`:'🪂 AIRDROP 2 SOL (DEVNET FREE)'}
                          </button>
                        </div>
                      )}

                      {/* Amount presets */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px',marginBottom:'5px'}}>
                        {['0.05','0.1','0.5','1'].map(amt=>(
                          <button key={amt} onClick={()=>setBuyAmount(amt)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',padding:'6px',background:buyAmount===amt?'rgba(0,255,136,0.1)':'#0a0a10',border:`1px solid ${buyAmount===amt?'rgba(0,255,136,0.35)':'#1a1a2e'}`,color:buyAmount===amt?'#00FF88':'#6666aa',cursor:'pointer'}}>{amt} SOL</button>
                        ))}
                      </div>

                      <div style={{display:'flex',marginBottom:'4px'}}>
                        <input value={buyAmount} onChange={e=>setBuyAmount(e.target.value)} style={{flex:1,background:'#0a0a10',border:'1px solid #1a1a2e',borderRight:'none',color:'#e0e0f0',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',padding:'8px 10px',outline:'none'}}/>
                        <div style={{background:'#070710',border:'1px solid #1a1a2e',padding:'8px',fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa'}}>SOL</div>
                      </div>

                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',marginBottom:'6px'}}>
                        ≈ {parseFloat(buyAmount||0)>0?((parseFloat(buyAmount)/Math.max(selected.price,0.000000001))*0.97).toExponential(2):'0'} {selected.symbol} · 3% slip
                      </div>

                      {/* Slippage row */}
                      <div style={{display:'flex',alignItems:'center',gap:'3px',marginBottom:'8px'}}>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',flexShrink:0}}>25%</span>
                        {['0.03⊕','0.03⊕','Off'].map((s,i)=>(
                          <button key={s+i} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',padding:'3px 2px',background:'transparent',border:'1px solid #1a1a2e',color:'#6666aa',cursor:'pointer'}}>{s}</button>
                        ))}
                      </div>

                      <button onClick={buy} disabled={!wallet||txStatus==='pending'}
                        style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',letterSpacing:'2px',color:'#050508',background:!wallet?'#1a1a2e':'#00FF88',border:'none',padding:'10px',cursor:wallet?'pointer':'not-allowed',clipPath:'polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)',marginBottom:'3px'}}>
                        {txStatus==='pending'?txMsg:'Buy'}
                      </button>
                      <button style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',letterSpacing:'1px',color:'#050508',background:'#6C5CE7',border:'none',padding:'10px',cursor:'pointer',clipPath:'polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)',marginBottom:'10px'}}>
                        Buy {selected.symbol}
                      </button>

                      {/* Token Info — Axiom style */}
                      <div style={{borderTop:'1px solid #1a1a2e',paddingTop:'8px'}}>
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',letterSpacing:'1px',marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          Token Info <span style={{fontSize:'8px',cursor:'pointer'}}>↓</span>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'3px',marginBottom:'4px'}}>
                          {[
                            {val:`${selected.top10Holders}%`,label:'Top 10 H.',color:'#FF3366'},
                            {val:`${selected.devHolderPct}%`,label:'Dev H.',color:'#00FF88'},
                            {val:`${selected.snipersH}%`,label:'Snipers H.',color:'#00FF88'},
                          ].map(s=>(
                            <div key={s.label} style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'6px',textAlign:'center'}}>
                              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:s.color,fontWeight:'bold'}}>{s.val}</div>
                              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',marginTop:'2px'}}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'3px',marginBottom:'4px'}}>
                          {[
                            {val:`${selected.insiders}%`,label:'Insiders',color:'#FF3366'},
                            {val:`${selected.bundlers}%`,label:'Bundlers',color:'#FF8800'},
                            {val:selected.lpBurned,label:'LP Burned',color:'#00FF88'},
                          ].map(s=>(
                            <div key={s.label} style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'6px',textAlign:'center'}}>
                              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:s.color,fontWeight:'bold'}}>{s.val}</div>
                              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',marginTop:'2px'}}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'3px',marginBottom:'8px'}}>
                          {[
                            {val:selected.holders,label:'Holders',color:'#e0e0f0'},
                            {val:selected.proTraders,label:'Pro Traders',color:'#e0e0f0'},
                            {val:selected.dexPaid?'Paid':'Unpaid',label:'Dex Paid',color:selected.dexPaid?'#00FF88':'#FF3366'},
                          ].map(s=>(
                            <div key={s.label} style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'6px',textAlign:'center'}}>
                              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:s.color}}>{s.val}</div>
                              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',marginTop:'2px'}}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                        {/* CA + DA */}
                        <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'7px',marginBottom:'6px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'3px'}}>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c'}}>CA:</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#6666aa',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{selected.address.slice(0,18)}...pump</span>
                            <button onClick={()=>navigator.clipboard.writeText(selected.address)} style={{background:'none',border:'none',color:'#3a3a5c',cursor:'pointer',fontSize:'8px',flexShrink:0}}>⎘</button>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c'}}>DA:</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#6666aa'}}>{tr(selected.address,5)}</span>
                          </div>
                        </div>
                        {/* Token Banner */}
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',letterSpacing:'1px',marginBottom:'6px',display:'flex',justifyContent:'space-between'}}>Token Banner ↓</div>
                        <div style={{background:`linear-gradient(135deg, ${selected.color}22, #0a0a10)`,border:`1px solid ${selected.color}33`,height:'72px',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'4px'}}>
                          {selected.logoUri?(
                            <img src={selected.logoUri} alt="" style={{height:'50px',objectFit:'contain'}} onError={e=>e.target.style.display='none'}/>
                          ):(
                            <div style={{textAlign:'center'}}>
                              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'22px',color:selected.color,letterSpacing:'4px'}}>${selected.symbol}</div>
                              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{selected.name}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {sideTab==='sell'&&(
                    <div style={{padding:'10px'}}>
                      {pos?(
                        <div>
                          <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'10px',marginBottom:'10px'}}>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',marginBottom:'4px'}}>YOUR POSITION</div>
                            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'24px',color:pos.pnl>=0?'#00FF88':'#FF3366'}}>{pos.pnl>=0?'+':''}{pos.pnlPct.toFixed(1)}%</div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa'}}>{pos.solSpent.toFixed(4)} SOL spent</div>
                          </div>
                          <button onClick={()=>sell(pos.id)} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',letterSpacing:'2px',color:'#050508',background:'#FF3366',border:'none',padding:'12px',cursor:'pointer',clipPath:'polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)'}}>SELL ALL</button>
                        </div>
                      ):(
                        <div style={{textAlign:'center',padding:'32px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c'}}>NO POSITION IN ${selected.symbol}</div>
                      )}
                    </div>
                  )}

                  {sideTab==='bags'&&(
                    <div style={{padding:'10px'}}>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'2px',marginBottom:'10px'}}>OPEN BAGS ({positions.length})</div>
                      {positions.length===0?<div style={{textAlign:'center',padding:'32px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#1a1a2e'}}>NO OPEN POSITIONS</div>:
                        positions.map(p=>(
                          <div key={p.id} style={{background:'#0a0a10',border:`1px solid ${p.pnl>=0?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)'}`,padding:'10px',marginBottom:'6px'}}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px'}}>${p.token.symbol}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:p.pnl>=0?'#00FF88':'#FF3366',fontWeight:'bold'}}>{p.pnl>=0?'+':''}{p.pnlPct.toFixed(1)}%</span>
                            </div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',marginBottom:'6px'}}>{p.solSpent.toFixed(3)} SOL</div>
                            <button onClick={()=>sell(p.id)} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#FF3366',background:'rgba(255,51,102,0.05)',border:'1px solid rgba(255,51,102,0.3)',padding:'4px',cursor:'pointer'}}>SELL ALL</button>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes rp{0%,100%{opacity:1}50%{opacity:0.3}} ::-webkit-scrollbar{width:3px;height:3px} ::-webkit-scrollbar-track{background:#050508} ::-webkit-scrollbar-thumb{background:#1a1a2e}`}</style>
    </div>
  )
}
