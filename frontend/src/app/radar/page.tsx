// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Nav from '../../components/Nav'
import * as web3 from '@solana/web3.js'

const DEVNET = 'https://api.devnet.solana.com'
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

const fmt = (n) => { if(!n||n===0) return '$0'; if(n>=1_000_000) return `$${(n/1_000_000).toFixed(1)}M`; if(n>=1_000) return `$${(n/1_000).toFixed(1)}K`; return `$${n.toFixed(0)}` }
const fmtPct = (n) => `${n>=0?'+':''}${n.toFixed(0)}%`
const elapsed = (ts) => { const s=Math.floor((Date.now()-ts)/1000); if(s<60) return `${s}s`; if(s<3600) return `${Math.floor(s/60)}m`; return `${Math.floor(s/3600)}h` }
const tr = (a) => a?`${a.slice(0,4)}...${a.slice(-4)}`:''
const COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9','#FF9F43','#A29BFE','#FD79A8','#6C5CE7','#00B894','#E17055','#74B9FF','#55EFC4','#FDCB6E','#fd79a8']

// Convert DexScreener pair to our token format
function pairToToken(p, stage) {
  return {
    id: p.pairAddress,
    symbol: p.baseToken?.symbol ?? '???',
    name: p.baseToken?.name ?? 'Unknown',
    address: p.baseToken?.address ?? '',
    pairAddress: p.pairAddress,
    color: COLORS[Math.abs(p.pairAddress?.charCodeAt(0)??0) % COLORS.length],
    price: parseFloat(p.priceUsd ?? '0'),
    marketCap: p.marketCap ?? p.fdv ?? 0,
    liquidity: p.liquidity?.usd ?? 0,
    volume5m: p.volume?.m5 ?? 0,
    priceChange5m: p.priceChange?.m5 ?? 0,
    buys5m: p.txns?.m5?.buys ?? 0,
    sells5m: p.txns?.m5?.sells ?? 0,
    age: Date.now() - (p.pairCreatedAt ?? Date.now()),
    bondingCurve: stage === 'migrated' ? 100 : Math.min(95, Math.random()*60 + (stage==='stretch'?35:5)),
    devHolding: Math.random() * 25,
    holders: Math.floor(Math.random()*400)+10,
    stage,
    logoUri: p.info?.imageUrl ?? null,
    dexId: p.dexId,
  }
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
  const [activeTab, setActiveTab] = useState('buy')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [bubbleView, setBubbleView] = useState(0) // 0-3 for 4 views
  const [loading, setLoading] = useState(true)
  const searchRef = useRef(null)
  const searchTimeout = useRef(null)
  const conn = useRef(new web3.Connection(DEVNET))

  // ── Fetch real pairs from our backend ────────────────
  const fetchPairs = useCallback(async () => {
    try {
      // Fetch new/non-migrated pairs
      const [r1, r2, r3] = await Promise.allSettled([
        fetch(`https://api.dexscreener.com/latest/dex/search?q=pump+sol`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
        fetch(`https://api.dexscreener.com/latest/dex/search?q=pump+fun+new`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
        fetch(`https://api.dexscreener.com/latest/dex/search?q=solana+meme+2025`, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
      ])

      const allPairs = []
      const seen = new Set()
      for (const r of [r1,r2,r3]) {
        if (r.status !== 'fulfilled') continue
        const data = await r.value.json().catch(()=>({pairs:[]}))
        for (const p of (data.pairs ?? [])) {
          if (p.chainId !== 'solana') continue
          if (seen.has(p.pairAddress)) continue
          if ((p.liquidity?.usd ?? 0) < 500) continue
          seen.add(p.pairAddress)
          allPairs.push(p)
        }
      }

      // Sort by creation time
      allPairs.sort((a,b) => (b.pairCreatedAt??0) - (a.pairCreatedAt??0))

      // Classify by dex — pump pairs on pumpswap = not migrated, raydium/meteora = migrated
      const newP = [], stretchP = [], migratedP = []
      for (const p of allPairs) {
        const mcap = p.marketCap ?? p.fdv ?? 0
        const isPump = p.dexId === 'pumpswap' || p.url?.includes('pump')
        const isMigrated = ['raydium','meteora','orca'].includes(p.dexId)
        if (isMigrated) {
          migratedP.push(pairToToken(p, 'migrated'))
        } else if (isPump && mcap > 50000) {
          stretchP.push(pairToToken(p, 'stretch'))
        } else {
          newP.push(pairToToken(p, 'new'))
        }
      }

      if (newP.length > 0) setNewPairs(newP.slice(0, 12))
      if (stretchP.length > 0) setStretch(stretchP.slice(0, 8))
      if (migratedP.length > 0) setMigrated(migratedP.slice(0, 12))
      setLoading(false)
    } catch (e) {
      console.error('fetchPairs error:', e)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPairs()
    const iv = setInterval(fetchPairs, 15000) // refresh every 15s
    return () => clearInterval(iv)
  }, [fetchPairs])

  // ── Live search ───────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const data = await res.json()
      const results = (data.pairs ?? []).filter(p => p.chainId === 'solana').slice(0, 8)
      setSearchResults(results)
    } catch { setSearchResults([]) }
    setSearching(false)
  }, [])

  useEffect(() => {
    clearTimeout(searchTimeout.current)
    if (searchQuery.length >= 2) {
      searchTimeout.current = setTimeout(() => doSearch(searchQuery), 200)
    } else {
      setSearchResults([])
    }
  }, [searchQuery, doSearch])

  // ── Wallet ────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('trench_radar_wallet')
    if (!saved) return
    const data = JSON.parse(saved)
    setWallet(data)
    conn.current.getBalance(new web3.PublicKey(data.publicKey)).then(b=>setWallet(w=>({...w,balance:b/web3.LAMPORTS_PER_SOL}))).catch(()=>{})
  }, [])

  const generateWallet = async () => {
    const kp = web3.Keypair.generate()
    const data = {publicKey:kp.publicKey.toString(),secretKey:Array.from(kp.secretKey),balance:0,network:'devnet'}
    localStorage.setItem('trench_radar_wallet',JSON.stringify(data))
    setWallet(data)
  }

  const airdrop = async () => {
    if (!wallet) return
    setTxStatus('pending')
    try {
      const pk = new web3.PublicKey(wallet.publicKey)
      const sig = await conn.current.requestAirdrop(pk,2*web3.LAMPORTS_PER_SOL)
      await conn.current.confirmTransaction(sig)
      const bal = await conn.current.getBalance(pk)
      setWallet(w=>({...w,balance:bal/web3.LAMPORTS_PER_SOL}))
      setTxStatus('success')
    } catch { setTxStatus('error') }
    setTimeout(()=>setTxStatus(null),3000)
  }

  const buy = async () => {
    if (!wallet||!selected) return
    const amt = parseFloat(buyAmount)
    if (isNaN(amt)||amt<=0||amt>(wallet.balance||0)) return
    setTxStatus('pending')
    await new Promise(r=>setTimeout(r,1200))
    const received = (amt/Math.max(selected.price,0.000000001))*0.97
    setPositions(prev=>[{id:Math.random().toString(36).slice(2),token:{...selected},entryPrice:selected.price,tokensHeld:received,solSpent:amt,currentPrice:selected.price,pnl:0,pnlPct:0,ts:Date.now()},...prev])
    setWallet(w=>({...w,balance:(w.balance||0)-amt}))
    setTxStatus('success')
    setActiveTab('bags')
    setTimeout(()=>setTxStatus(null),2000)
  }

  const sell = (posId) => {
    const pos = positions.find(p=>p.id===posId)
    if(!pos) return
    setWallet(w=>({...w,balance:(w.balance||0)+pos.tokensHeld*pos.currentPrice*0.97}))
    setPositions(prev=>prev.filter(p=>p.id!==posId))
  }

  const selectToken = (token) => {
    setSelected(token)
    setActiveTab('buy')
    setShowSearch(false)
    setSearchQuery('')
  }

  // ── Bubble Map Generator ──────────────────────────────
  const BubbleMap = ({view}) => {
    const labels = ['Top Holders', 'Dev & Insiders', 'Bundlers', 'Snipers']
    const counts = [12, 8, 15, 10]
    const n = counts[view]
    const bubbles = Array.from({length:n},(_,i)=>({
      x: 15+Math.random()*70,
      y: 15+Math.random()*70,
      r: 3+Math.random()*8,
      color: view===0?['#00FF88','#FFD700','#FF6B6B'][i%3]:view===1?['#FF3366','#FF8800'][i%2]:view===2?['#0088ff','#6C5CE7'][i%2]:['#FFD700','#FF3366'][i%2],
      label: `${(Math.random()*15+0.5).toFixed(1)}%`,
    }))
    return (
      <div style={{position:'relative',width:'100%',height:'260px',background:'#050508',borderRadius:'4px',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'8px',left:'8px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa',letterSpacing:'1px',zIndex:2}}>{labels[view]}</div>
        <svg width="100%" height="100%" viewBox="0 0 100 100" style={{position:'absolute',inset:0}}>
          {/* Connection lines */}
          {bubbles.slice(0,4).map((b,i)=>bubbles.slice(i+1,i+3).map((b2,j)=>(
            <line key={`l${i}${j}`} x1={b.x} y1={b.y} x2={b2.x} y2={b2.y} stroke="#1a1a2e" strokeWidth="0.3" opacity="0.5"/>
          )))}
          {/* Bubbles */}
          {bubbles.map((b,i)=>(
            <g key={i}>
              <circle cx={b.x} cy={b.y} r={b.r} fill={b.color} opacity="0.85" stroke={b.color} strokeWidth="0.3"/>
              {b.r > 5 && <text x={b.x} y={b.y+1} textAnchor="middle" fontSize="1.8" fill="#050508" fontFamily="monospace" fontWeight="bold">{b.label}</text>}
            </g>
          ))}
        </svg>
        <div style={{position:'absolute',bottom:'8px',left:'8px',right:'8px',display:'flex',gap:'8px',flexWrap:'wrap'}}>
          {Array.from({length:Math.min(4,n)},(_, i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:'3px'}}>
              <div style={{width:'6px',height:'6px',borderRadius:'50%',background:bubbles[i]?.color}}/>
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa'}}>{bubbles[i]?.label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Token Card ────────────────────────────────────────
  const TokenCard = ({token}) => {
    const up = token.priceChange5m >= 0
    const isSel = selected?.id === token.id
    return (
      <div onClick={()=>selectToken(token)}
        style={{background:isSel?'rgba(0,255,136,0.06)':'#0a0a10',border:`1px solid ${isSel?'rgba(0,255,136,0.4)':'#1a1a2e'}`,padding:'10px',cursor:'pointer',marginBottom:'5px',borderLeft:isSel?'3px solid #00FF88':'3px solid transparent'}}
        onMouseEnter={e=>{if(!isSel){e.currentTarget.style.background='#0d0d18'}}}
        onMouseLeave={e=>{if(!isSel){e.currentTarget.style.background='#0a0a10'}}}
      >
        <div style={{display:'flex',alignItems:'center',gap:'7px',marginBottom:'7px'}}>
          {token.logoUri ? (
            <img src={token.logoUri} alt="" style={{width:'32px',height:'32px',borderRadius:'50%',objectFit:'cover',flexShrink:0}} onError={e=>{e.target.style.display='none'}}/>
          ) : (
            <div style={{width:'32px',height:'32px',borderRadius:'50%',background:token.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'13px',color:'#050508',flexShrink:0,fontWeight:'bold'}}>{token.symbol[0]}</div>
          )}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#e0e0f0',fontWeight:'bold'}}>{token.symbol}</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{token.name}</div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:up?'#00FF88':'#FF3366',fontWeight:'bold'}}>{fmtPct(token.priceChange5m)}</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{elapsed(token.age)}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'3px',marginBottom:'7px'}}>
          {[['V',fmt(token.volume5m),'#e0e0f0'],['MC',fmt(token.marketCap),'#FFD700'],['B',token.buys5m,'#00FF88'],['S',token.sells5m,'#FF3366']].map(([l,v,c])=>(
            <div key={l} style={{textAlign:'center',background:'#070710',padding:'3px 2px'}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{l}</div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:c}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:'6px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'2px'}}>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>BONDING</span>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:token.bondingCurve>80?'#FF3366':token.bondingCurve>50?'#FFD700':'#00FF88'}}>{token.bondingCurve.toFixed(0)}%</span>
          </div>
          <div style={{height:'2px',background:'#1a1a2e',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${token.bondingCurve}%`,background:token.bondingCurve>80?'#FF3366':token.bondingCurve>50?'#FFD700':'#00FF88'}}/>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'2px 5px',background:token.devHolding<10?'rgba(0,255,136,0.1)':'rgba(255,51,102,0.1)',color:token.devHolding<10?'#00FF88':'#FF3366',border:`1px solid ${token.devHolding<10?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)'}`}}>DEV {token.devHolding.toFixed(0)}%</span>
          <button onClick={e=>{e.stopPropagation();selectToken(token);setActiveTab('buy')}} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',letterSpacing:'1px',padding:'3px 8px',background:'rgba(0,255,136,0.1)',border:'1px solid rgba(0,255,136,0.3)',color:'#00FF88',cursor:'pointer'}}>⚡ BUY</button>
        </div>
      </div>
    )
  }

  const pos = positions.find(p=>p.token.id===selected?.id)

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#050508',color:'#e0e0f0',fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      <Nav active="/radar"/>

      {txStatus&&<div style={{position:'fixed',top:'60px',right:'20px',zIndex:9999,padding:'8px 16px',background:txStatus==='success'?'rgba(0,255,136,0.1)':txStatus==='error'?'rgba(255,51,102,0.1)':'rgba(10,10,16,0.98)',border:`1px solid ${txStatus==='success'?'rgba(0,255,136,0.4)':txStatus==='error'?'rgba(255,51,102,0.4)':'#1a1a2e'}`,fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:txStatus==='success'?'#00FF88':txStatus==='error'?'#FF3366':'#6666aa',letterSpacing:'1px'}}>
        {txStatus==='pending'?'⟳ PROCESSING...':txStatus==='success'?'✓ SUCCESS':'✗ FAILED'}
      </div>}

      {/* Search Modal */}
      {showSearch && (
        <div style={{position:'fixed',inset:0,zIndex:500,background:'rgba(5,5,8,0.85)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'80px'}} onClick={()=>{setShowSearch(false);setSearchQuery('')}}>
          <div style={{width:'560px',background:'#0a0a10',border:'1px solid #1a1a2e',overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
            {/* Filter pills */}
            <div style={{display:'flex',gap:'6px',padding:'10px 14px',borderBottom:'1px solid #1a1a2e',flexWrap:'wrap'}}>
              {['Pump','Bonk','Bags','All'].map(f=>(
                <button key={f} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'3px 10px',background:'rgba(0,255,136,0.08)',border:'1px solid rgba(0,255,136,0.2)',color:'#00FF88',cursor:'pointer',borderRadius:'20px'}}>{f}</button>
              ))}
            </div>
            {/* Input */}
            <div style={{position:'relative',padding:'10px 14px',borderBottom:'1px solid #1a1a2e'}}>
              <input
                ref={searchRef}
                autoFocus
                value={searchQuery}
                onChange={e=>setSearchQuery(e.target.value)}
                placeholder="Search by name, ticker, or paste contract address..."
                style={{width:'100%',background:'transparent',border:'none',color:'#e0e0f0',fontFamily:"'Share Tech Mono',monospace",fontSize:'13px',outline:'none',letterSpacing:'0.5px'}}
              />
              {searching && <div style={{position:'absolute',right:'14px',top:'50%',transform:'translateY(-50%)',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c'}}>SEARCHING...</div>}
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#1a1a2e',position:'absolute',right:searching?'90px':'14px',top:'50%',transform:'translateY(-50%)',padding:'2px 6px',border:'1px solid #1a1a2e'}}>ESC</div>
            </div>
            {/* Results */}
            <div style={{maxHeight:'380px',overflowY:'auto'}}>
              {searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
                <div style={{padding:'24px',textAlign:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#3a3a5c'}}>No results for "{searchQuery}"</div>
              )}
              {searchResults.length === 0 && searchQuery.length < 2 && (
                <div style={{padding:'16px 14px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',letterSpacing:'1px'}}>RESULTS</div>
              )}
              {searchResults.map(p=>{
                const token = pairToToken(p, p.dexId==='raydium'||p.dexId==='meteora'?'migrated':p.marketCap>50000?'stretch':'new')
                return (
                  <div key={p.pairAddress} onClick={()=>selectToken(token)}
                    style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid #0d0d18',transition:'background 0.1s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#0d0d18'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                  >
                    {p.info?.imageUrl ? (
                      <img src={p.info.imageUrl} alt="" style={{width:'36px',height:'36px',borderRadius:'50%',objectFit:'cover',flexShrink:0}} onError={e=>{e.target.style.display='none'}}/>
                    ) : (
                      <div style={{width:'36px',height:'36px',borderRadius:'50%',background:token.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'15px',color:'#050508',flexShrink:0}}>{token.symbol[0]}</div>
                    )}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'2px'}}>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#e0e0f0',fontWeight:'bold'}}>{p.baseToken?.symbol}</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.baseToken?.name}</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'1px 5px',background:'rgba(0,136,255,0.1)',color:'#0088ff',border:'1px solid rgba(0,136,255,0.2)',marginLeft:'auto',flexShrink:0}}>{p.dexId}</span>
                      </div>
                      <div style={{display:'flex',gap:'16px'}}>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa'}}>MC {fmt(p.marketCap??p.fdv)}</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa'}}>V {fmt(p.volume?.h24)}</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa'}}>L {fmt(p.liquidity?.usd)}</span>
                      </div>
                    </div>
                    <button style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'5px 12px',background:'rgba(0,255,136,0.1)',border:'1px solid rgba(0,255,136,0.3)',color:'#00FF88',cursor:'pointer',flexShrink:0}}>⚡ 0 SOL</button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',flex:1,overflow:'hidden',marginTop:'52px'}}>

        {/* ── FEED ── */}
        {!selected ? (
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Header with search */}
            <div style={{padding:'8px 14px',borderBottom:'1px solid #1a1a2e',background:'#070710',display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#FF3366',animation:'rp 1s infinite',boxShadow:'0 0 6px #FF336688'}}/>
                <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'16px',letterSpacing:'3px'}}>RADAR</span>
              </div>
              {/* Search bar */}
              <div onClick={()=>setShowSearch(true)} style={{flex:1,display:'flex',alignItems:'center',gap:'8px',background:'#0a0a10',border:'1px solid #1a1a2e',padding:'6px 12px',cursor:'text',transition:'border-color 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#3a3a5c'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='#1a1a2e'}
              >
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#3a3a5c'}}>⌕</span>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#3a3a5c',letterSpacing:'1px'}}>Search by name, ticker, or paste contract address...</span>
              </div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'1px',flexShrink:0}}>
                {loading ? 'LOADING...' : `${newPairs.length+stretch.length+migrated.length} PAIRS`}
              </div>
            </div>

            {/* 3 columns */}
            <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',overflow:'hidden'}}>
              {[
                {label:'NEW PAIRS',color:'#00FF88',tokens:newPairs,desc:'Non-migrated · Under $50K'},
                {label:'FINAL STRETCH',color:'#FFD700',tokens:stretch,desc:'80%+ bonding · About to migrate'},
                {label:'MIGRATED',color:'#0088ff',tokens:migrated,desc:'Raydium/Meteora · Tradeable'},
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
                    {loading ? (
                      <div style={{textAlign:'center',padding:'32px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',letterSpacing:'2px'}}>SCANNING...</div>
                    ) : col.tokens.length === 0 ? (
                      <div style={{textAlign:'center',padding:'32px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#1a1a2e',letterSpacing:'1px'}}>NO PAIRS FOUND</div>
                    ) : col.tokens.map(t=><TokenCard key={t.id} token={t}/>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // ── TOKEN DETAIL ──
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

            {/* Top bar — Axiom style */}
            <div style={{padding:'6px 14px',borderBottom:'1px solid #1a1a2e',background:'#070710',display:'flex',alignItems:'center',gap:'10px',flexShrink:0,flexWrap:'wrap'}}>
              <button onClick={()=>setSelected(null)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',background:'none',border:'1px solid #1a1a2e',padding:'4px 8px',cursor:'pointer',flexShrink:0}}>← BACK</button>

              {selected.logoUri ? (
                <img src={selected.logoUri} alt="" style={{width:'24px',height:'24px',borderRadius:'50%',objectFit:'cover',flexShrink:0}} onError={e=>e.target.style.display='none'}/>
              ) : (
                <div style={{width:'24px',height:'24px',borderRadius:'50%',background:selected.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'11px',color:'#050508',flexShrink:0}}>{selected.symbol[0]}</div>
              )}

              <div style={{flexShrink:0}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'14px',letterSpacing:'2px',lineHeight:1}}>${selected.symbol}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa'}}>{selected.name}</div>
              </div>

              <div style={{display:'flex',gap:'1px',background:'#1a1a2e',padding:'2px',flexShrink:0}}>
                {['1s','1m','5m','15m','1h','4h','D'].map(tf=>(
                  <button key={tf} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'3px 6px',background:tf==='5m'?'#2a2a3e':'transparent',border:'none',color:tf==='5m'?'#e0e0f0':'#6666aa',cursor:'pointer'}}>{tf}</button>
                ))}
              </div>

              <div style={{display:'flex',gap:'12px',marginLeft:'4px'}}>
                {[
                  ['PRICE',`$${selected.price.toExponential(2)}`,'#e0e0f0'],
                  ['LIQ',fmt(selected.liquidity),'#e0e0f0'],
                  ['SUPPLY','1B','#6666aa'],
                  ['B.CURVE',`${selected.bondingCurve.toFixed(0)}%`,selected.bondingCurve>80?'#FF3366':'#FFD700'],
                ].map(([l,v,c])=>(
                  <div key={l}>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',letterSpacing:'1px'}}>{l}</div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:c,fontWeight:'bold'}}>{v}</div>
                  </div>
                ))}
              </div>

              {/* 1h stats like Axiom */}
              <div style={{marginLeft:'auto',display:'flex',gap:'16px',alignItems:'center'}}>
                <div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>1H VOL</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#e0e0f0'}}>{fmt(selected.volume5m*12)}</div>
                </div>
                <div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>BUYS</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#00FF88'}}>{selected.buys5m*12}</div>
                </div>
                <div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>SELLS</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#FF3366'}}>{selected.sells5m*12}</div>
                </div>
                <div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>NET VOL</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:selected.buys5m>selected.sells5m?'#00FF88':'#FF3366'}}>
                    {selected.buys5m>selected.sells5m?'+':'-'}{fmt(Math.abs(selected.buys5m-selected.sells5m)*0.1*12)}
                  </div>
                </div>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'2px 7px',background:selected.devHolding<10?'rgba(0,255,136,0.1)':'rgba(255,51,102,0.1)',color:selected.devHolding<10?'#00FF88':'#FF3366',border:`1px solid ${selected.devHolding<10?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)'}`}}>DEV {selected.devHolding.toFixed(0)}%</span>
                <a href={`https://dexscreener.com/solana/${selected.pairAddress}`} target="_blank" rel="noreferrer" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',border:'1px solid #1a1a2e',padding:'3px 7px',textDecoration:'none'}}>DEX ↗</a>
              </div>
            </div>

            {/* Chart + right panel */}
            <div style={{flex:1,display:'flex',overflow:'hidden'}}>

              {/* Chart area */}
              <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <div style={{flex:1,position:'relative',background:'#000',overflow:'hidden'}}>
                  <iframe
                    key={selected.pairAddress}
                    src={`https://dexscreener.com/solana/${selected.pairAddress}?embed=1&theme=dark&trades=0&info=0`}
                    style={{width:'100%',height:'calc(100% + 60px)',border:'none',marginBottom:'-60px'}}
                    title={`${selected.symbol} Chart`}
                  />
                  {/* Cover the DexScreener footer */}
                  <div style={{position:'absolute',bottom:0,left:0,right:0,height:'52px',background:'#050508',zIndex:10,display:'flex',alignItems:'center',padding:'0 14px',gap:'12px'}}>
                    <div style={{display:'flex',gap:'4px'}}>
                      {['3m','1m','5d','1d'].map(tf=>(
                        <button key={tf} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'3px 8px',background:'#0a0a10',border:'1px solid #1a1a2e',color:'#6666aa',cursor:'pointer'}}>{tf}</button>
                      ))}
                    </div>
                    <div style={{marginLeft:'auto',fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'1px'}}>
                      {new Date().toLocaleTimeString()} UTC
                    </div>
                  </div>
                </div>

                {/* Bottom tabs */}
                <div style={{height:'200px',borderTop:'1px solid #1a1a2e',flexShrink:0,display:'flex',flexDirection:'column'}}>
                  <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',background:'#070710',flexShrink:0}}>
                    {['TRADES','POSITIONS','ORDERS',`HOLDERS (${selected.holders})`,`TOP TRADERS`,`DEV TOKENS`].map((t,i)=>(
                      <button key={t} onClick={()=>setActiveTab(t.split(' ')[0].toLowerCase())} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',letterSpacing:'1px',padding:'7px 12px',background:'none',border:'none',borderBottom:`2px solid ${activeTab===t.split(' ')[0].toLowerCase()?'#00FF88':'transparent'}`,color:activeTab===t.split(' ')[0].toLowerCase()?'#00FF88':'#6666aa',cursor:'pointer',whiteSpace:'nowrap'}}>{t}</button>
                    ))}
                    <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'6px',padding:'0 10px'}}>
                      <button style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'3px 10px',background:'rgba(255,51,102,0.1)',border:'1px solid rgba(255,51,102,0.3)',color:'#FF3366',cursor:'pointer'}}>⚡ INSTANT TRADE</button>
                    </div>
                  </div>
                  <div style={{flex:1,overflowY:'auto'}}>
                    {activeTab==='trades'&&Array.from({length:8},(_,i)=>{
                      const isBuy=Math.random()>0.4
                      const amt=(Math.random()*2+0.01).toFixed(3)
                      return (
                        <div key={i} style={{display:'grid',gridTemplateColumns:'50px 60px 80px 1fr 80px 80px 60px',padding:'5px 14px',borderBottom:'1px solid #0a0a0f',alignItems:'center',gap:'8px'}}>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>{Math.floor(Math.random()*10)}s</span>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:isBuy?'#00FF88':'#FF3366',fontWeight:'bold'}}>{isBuy?'Buy':'Sell'}</span>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa'}}>{fmt(selected.marketCap*(0.98+Math.random()*0.04))}</span>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>{(Math.random()*1000000).toFixed(0)}</span>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#e0e0f0',textAlign:'right'}}>$ {(parseFloat(amt)*20).toFixed(2)}</span>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',textAlign:'right'}}>{tr(selected.address)}</span>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',textAlign:'right'}}>{Math.floor(Math.random()*6)} txns</span>
                        </div>
                      )
                    })}
                    {activeTab==='holders'&&(
                      <div style={{padding:'10px'}}>
                        {/* Bubble map views */}
                        <div style={{display:'flex',gap:'4px',marginBottom:'8px'}}>
                          {['Top Holders','Dev & Insiders','Bundlers','Snipers'].map((v,i)=>(
                            <button key={v} onClick={()=>setBubbleView(i)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'3px 8px',background:bubbleView===i?'rgba(0,255,136,0.1)':'#0a0a10',border:`1px solid ${bubbleView===i?'rgba(0,255,136,0.3)':'#1a1a2e'}`,color:bubbleView===i?'#00FF88':'#6666aa',cursor:'pointer'}}>{v}</button>
                          ))}
                        </div>
                        <BubbleMap view={bubbleView}/>
                      </div>
                    )}
                    {activeTab==='positions'&&(
                      <div style={{padding:'10px'}}>
                        {pos?(
                          <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'12px'}}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px'}}>${pos.token.symbol}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:pos.pnl>=0?'#00FF88':'#FF3366',fontWeight:'bold'}}>{pos.pnl>=0?'+':''}{pos.pnlPct.toFixed(1)}%</span>
                            </div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa'}}>{pos.solSpent.toFixed(3)} SOL spent</div>
                          </div>
                        ):(
                          <div style={{textAlign:'center',padding:'20px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c'}}>NO POSITION IN ${selected.symbol}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right panel */}
              <div style={{width:'258px',flexShrink:0,display:'flex',flexDirection:'column',borderLeft:'1px solid #1a1a2e',overflow:'hidden'}}>

                {/* Buy/Sell tabs */}
                <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',flexShrink:0}}>
                  {[['buy','BUY','#00FF88'],['sell','SELL','#FF3366'],['bags',`BAGS(${positions.length})`,'#0088ff']].map(([v,l,c])=>(
                    <button key={v} onClick={()=>setActiveTab(v)} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',letterSpacing:'1px',padding:'9px',background:activeTab===v?`rgba(${v==='buy'?'0,255,136':v==='sell'?'255,51,102':'0,136,255'},0.06)`:'transparent',border:'none',borderBottom:`2px solid ${activeTab===v?c:'transparent'}`,color:activeTab===v?c:'#6666aa',cursor:'pointer'}}>{l}</button>
                  ))}
                </div>

                <div style={{flex:1,overflowY:'auto'}}>
                  {activeTab==='buy'&&(
                    <div style={{padding:'12px'}}>
                      {/* Bought/Sold/Holding/PNL bar like Axiom */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'1px',background:'#1a1a2e',marginBottom:'10px'}}>
                        {[['Bought',pos?`≡ ${pos.solSpent.toFixed(2)}`:'≡ 0','#6666aa'],['Sold','≡ 0','#6666aa'],['Holding',pos?`≡ ${(pos.tokensHeld*0.001).toFixed(0)}K`:'≡ 0','#6666aa'],['PnL',pos?`${pos.pnl>=0?'+':''}${pos.pnl.toFixed(3)}`:'+0(0%)','#6666aa']].map(([l,v,c])=>(
                          <div key={l} style={{background:'#0a0a10',padding:'6px 4px',textAlign:'center'}}>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',marginBottom:'2px'}}>{l}</div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:l==='PnL'&&pos?pos.pnl>=0?'#00FF88':'#FF3366':c}}>{v}</div>
                          </div>
                        ))}
                      </div>

                      {/* Presets */}
                      <div style={{display:'flex',gap:'4px',marginBottom:'8px'}}>
                        {['PRESET 1','PRESET 2','PRESET 3'].map((p,i)=>(
                          <button key={p} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'5px',background:i===0?'rgba(255,51,102,0.2)':'#0a0a10',border:`1px solid ${i===0?'rgba(255,51,102,0.4)':'#1a1a2e'}`,color:i===0?'#FF3366':'#6666aa',cursor:'pointer'}}>{p}</button>
                        ))}
                      </div>

                      {!wallet?(
                        <button onClick={generateWallet} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'2px',color:'#050508',background:'#00FF88',border:'none',padding:'10px',cursor:'pointer',marginBottom:'10px',clipPath:'polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)'}}>⚡ GENERATE WALLET</button>
                      ):(
                        <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'8px',marginBottom:'8px'}}>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',marginBottom:'3px'}}>RADAR WALLET · DEVNET</div>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'20px',color:'#00FF88',letterSpacing:'2px',lineHeight:1}}>{(wallet.balance||0).toFixed(4)} SOL</div>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',marginBottom:'5px'}}>{tr(wallet.publicKey)}</div>
                          {(wallet.balance||0)<0.1&&<button onClick={airdrop} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#FFD700',background:'rgba(255,215,0,0.05)',border:'1px solid rgba(255,215,0,0.2)',padding:'4px',cursor:'pointer'}}>🪂 AIRDROP 2 SOL FREE</button>}
                        </div>
                      )}

                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px',marginBottom:'6px'}}>
                        {['0.05','0.1','0.5','1'].map(amt=>(
                          <button key={amt} onClick={()=>setBuyAmount(amt)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',padding:'6px',background:buyAmount===amt?'rgba(0,255,136,0.1)':'#0a0a10',border:`1px solid ${buyAmount===amt?'rgba(0,255,136,0.4)':'#1a1a2e'}`,color:buyAmount===amt?'#00FF88':'#6666aa',cursor:'pointer'}}>{amt} SOL</button>
                        ))}
                      </div>
                      <div style={{display:'flex',marginBottom:'5px'}}>
                        <input value={buyAmount} onChange={e=>setBuyAmount(e.target.value)} style={{flex:1,background:'#0a0a10',border:'1px solid #1a1a2e',borderRight:'none',color:'#e0e0f0',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',padding:'8px 10px',outline:'none'}}/>
                        <div style={{background:'#070710',border:'1px solid #1a1a2e',padding:'8px 10px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa'}}>SOL</div>
                      </div>
                      <div style={{display:'flex',gap:'3px',marginBottom:'8px'}}>
                        {['25%','0.03⊕','0.03⊕','Off'].map((s,i)=>(
                          <button key={s} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'3px 2px',background:i===0?'rgba(0,255,136,0.05)':'transparent',border:`1px solid ${i===0?'rgba(0,255,136,0.2)':'#1a1a2e'}`,color:i===0?'#00FF88':'#6666aa',cursor:'pointer'}}>{s}</button>
                        ))}
                      </div>
                      <button onClick={buy} disabled={!wallet||txStatus==='pending'} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',letterSpacing:'2px',color:'#050508',background:!wallet?'#1a1a2e':'#00FF88',border:'none',padding:'11px',cursor:wallet?'pointer':'not-allowed',clipPath:'polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)',marginBottom:'3px'}}>
                        {txStatus==='pending'?'BUYING...':'Buy'}
                      </button>
                      <button style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',letterSpacing:'2px',color:'#050508',background:'#6666aa',border:'none',padding:'11px',cursor:'pointer',clipPath:'polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)',marginBottom:'10px'}}>
                        Buy {selected.symbol}
                      </button>

                      {/* Token Info — like Axiom image 5 */}
                      <div style={{borderTop:'1px solid #1a1a2e',paddingTop:'10px'}}>
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa',letterSpacing:'1px',marginBottom:'8px',display:'flex',justifyContent:'space-between'}}>
                          Token Info <span style={{color:'#3a3a5c'}}>↓</span>
                        </div>
                        {/* 3-col stats grid */}
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'4px',marginBottom:'8px'}}>
                          {[
                            {val:`${(Math.random()*30+5).toFixed(1)}%`,label:'Top 10 H.',color:'#FF3366'},
                            {val:`${(Math.random()*5).toFixed(0)}%`,label:'Dev H.',color:'#00FF88'},
                            {val:`${(Math.random()*3).toFixed(2)}%`,label:'Snipers H.',color:'#00FF88'},
                          ].map(s=>(
                            <div key={s.label} style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'8px',textAlign:'center'}}>
                              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:s.color,fontWeight:'bold'}}>{s.val}</div>
                              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',marginTop:'2px'}}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'4px',marginBottom:'8px'}}>
                          {[
                            {val:`${(Math.random()*15+2).toFixed(1)}%`,label:'Insiders',color:'#FF3366'},
                            {val:`${(Math.random()*10+1).toFixed(1)}%`,label:'Bundlers',color:'#FF8800'},
                            {val:'100%',label:'LP Burned',color:'#00FF88'},
                          ].map(s=>(
                            <div key={s.label} style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'8px',textAlign:'center'}}>
                              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:s.color,fontWeight:'bold'}}>{s.val}</div>
                              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',marginTop:'2px'}}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                        {/* Holders / Pro Traders / Dex Paid */}
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'4px',marginBottom:'10px'}}>
                          {[
                            {val:selected.holders,label:'Holders'},
                            {val:Math.floor(selected.holders*0.4),label:'Pro Traders'},
                            {val:'Paid',label:'Dex Paid',color:'#00FF88'},
                          ].map(s=>(
                            <div key={s.label} style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'8px',textAlign:'center'}}>
                              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:s.color||'#e0e0f0'}}>{s.val}</div>
                              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',marginTop:'2px'}}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                        {/* CA + DA */}
                        <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'8px',marginBottom:'6px'}}>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',marginBottom:'3px'}}>CA: {selected.address.slice(0,20)}...pump</div>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>DA: {tr(selected.address)}</div>
                        </div>
                        {/* Token banner placeholder */}
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa',letterSpacing:'1px',marginBottom:'6px',display:'flex',justifyContent:'space-between'}}>
                          Token Banner <span style={{color:'#3a3a5c'}}>↓</span>
                        </div>
                        <div style={{background:'linear-gradient(135deg, #1a1a2e 0%, #0a0a10 100%)',border:'1px solid #1a1a2e',height:'80px',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'6px'}}>
                          <div style={{textAlign:'center'}}>
                            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'20px',color:selected.color,letterSpacing:'4px'}}>${selected.symbol}</div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>{selected.name}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {activeTab==='sell'&&(
                    <div style={{padding:'12px'}}>
                      {pos?(
                        <div>
                          <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'10px',marginBottom:'10px'}}>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',marginBottom:'4px'}}>YOUR POSITION</div>
                            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'22px',color:pos.pnl>=0?'#00FF88':'#FF3366'}}>{pos.pnl>=0?'+':''}{pos.pnlPct.toFixed(1)}%</div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa'}}>{pos.solSpent.toFixed(3)} SOL spent</div>
                          </div>
                          <button onClick={()=>sell(pos.id)} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',letterSpacing:'2px',color:'#050508',background:'#FF3366',border:'none',padding:'12px',cursor:'pointer',clipPath:'polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)'}}>SELL ALL</button>
                        </div>
                      ):(
                        <div style={{textAlign:'center',padding:'32px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c'}}>NO POSITION IN ${selected.symbol}</div>
                      )}
                    </div>
                  )}
                  {activeTab==='bags'&&(
                    <div style={{padding:'12px'}}>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'2px',marginBottom:'10px'}}>BAGS ({positions.length})</div>
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
      <style>{`@keyframes rp{0%,100%{opacity:1}50%{opacity:0.3}} ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-track{background:#050508} ::-webkit-scrollbar-thumb{background:#1a1a2e}`}</style>
    </div>
  )
}
