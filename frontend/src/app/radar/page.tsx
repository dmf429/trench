// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import Nav from '../../components/Nav'
import * as web3 from '@solana/web3.js'

const DEVNET = 'https://api.devnet.solana.com'
const fmt = (n) => { if (!n||n===0) return '$0'; if (n>=1_000_000) return `$${(n/1_000_000).toFixed(1)}M`; if (n>=1_000) return `$${(n/1_000).toFixed(1)}K`; return `$${n.toFixed(0)}` }
const fmtPct = (n) => `${n>=0?'+':''}${n.toFixed(0)}%`
const elapsed = (ts) => { const s=Math.floor((Date.now()-ts)/1000); if(s<60) return `${s}s`; if(s<3600) return `${Math.floor(s/60)}m`; return `${Math.floor(s/3600)}h` }
const tr = (a) => a?`${a.slice(0,4)}...${a.slice(-4)}`:''

const SYMS = ['MOON','DOGE','PEPE','APE','CAT','CHAD','BASED','FROG','BEAR','BULL','BONK','WIF','GIGA','SIGMA','ALPHA','DEGEN','GEM','PUMP','SEND','TURBO','WAGMI','NGMI','SAFE','COPE','SEETHE','GIGACHAD','BASED','LARP','COPE','BAGS']
const NAMES = ['The Moon Token','Doge But Better','Pepe Classic','Ape Strong','Cat Season','Chad Energy','Based Forever','Frog Nation','Bear Market Survivor','Bull Run Token','Bonk Again','Wif Dat Hat','Giga Brain','Sigma Male Token','Alpha Calls','Degen Life','Hidden Gem','Pump It Up','Send It','Turbo Mode','We All Gonna Make It','Not Gonna Make It','Stay Safe','Cope Token','Seethe Token','Giga Chad Energy','Very Based','Live Action RolePlay','Maximum Cope','Bag Holder']
const COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9']

function mockToken(stage='new') {
  const i = Math.floor(Math.random()*SYMS.length)
  const sym = SYMS[i]
  const mcapBase = stage==='new' ? Math.random()*15000+500 : stage==='stretch' ? Math.random()*60000+15000 : Math.random()*500000+60000
  const bondingBase = stage==='new' ? Math.random()*40 : stage==='stretch' ? Math.random()*30+60 : 100
  const ageBase = stage==='new' ? Math.random()*600000 : stage==='stretch' ? Math.random()*3600000+600000 : Math.random()*86400000+3600000
  return {
    id: Math.random().toString(36).slice(2),
    symbol: sym,
    name: NAMES[i],
    address: Array.from({length:44},()=>'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789'[Math.floor(Math.random()*58)]).join(''),
    price: Math.random()*0.001+0.000001,
    marketCap: mcapBase,
    liquidity: mcapBase * 0.3,
    volume5m: Math.random()*mcapBase*0.1+100,
    priceChange5m: (Math.random()-0.3)*200,
    buys5m: Math.floor(Math.random()*80)+1,
    sells5m: Math.floor(Math.random()*30),
    age: Date.now()-ageBase,
    bondingCurve: bondingBase,
    devHolding: Math.random()*30,
    score: Math.floor(Math.random()*100),
    holders: Math.floor(Math.random()*500)+10,
    stage,
    color: COLORS[Math.floor(Math.random()*COLORS.length)],
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
  const [paused, setPaused] = useState(false)
  const [activeTab, setActiveTab] = useState('chart') // chart | buy | positions
  const conn = useRef(new web3.Connection(DEVNET))

  // ── Feed ──────────────────────────────────────────────
  useEffect(() => {
    setNewPairs(Array.from({length:6},()=>mockToken('new')))
    setStretch(Array.from({length:6},()=>mockToken('stretch')))
    setMigrated(Array.from({length:8},()=>mockToken('migrated')))

    const iv = setInterval(() => {
      if (paused) return
      // Add new token to new pairs
      setNewPairs(prev => [mockToken('new'), ...prev.slice(0,7)])
      // Randomly graduate a token to stretch
      if (Math.random()>0.7) setStretch(prev=>[mockToken('stretch'),...prev.slice(0,7)])
      // Update prices
      const update = (arr) => arr.map(t=>({
        ...t,
        price: Math.max(0.000001,t.price*(1+(Math.random()-0.45)*0.15)),
        priceChange5m: t.priceChange5m+(Math.random()-0.5)*30,
        buys5m: t.buys5m+Math.floor(Math.random()*5),
        sells5m: t.sells5m+Math.floor(Math.random()*3),
        marketCap: Math.max(100,t.marketCap*(1+(Math.random()-0.45)*0.12)),
        bondingCurve: Math.min(100,t.bondingCurve+Math.random()*2),
        volume5m: t.volume5m+Math.random()*1000,
      }))
      setNewPairs(update)
      setStretch(update)
      setMigrated(update)
      // Update selected
      if (selected) {
        setSelected(prev => prev ? ({
          ...prev,
          price: Math.max(0.000001,prev.price*(1+(Math.random()-0.45)*0.1)),
          priceChange5m: prev.priceChange5m+(Math.random()-0.5)*20,
          marketCap: Math.max(100,prev.marketCap*(1+(Math.random()-0.45)*0.08)),
          bondingCurve: Math.min(100,prev.bondingCurve+Math.random()*1),
          buys5m: prev.buys5m+Math.floor(Math.random()*3),
          sells5m: prev.sells5m+Math.floor(Math.random()*2),
        }) : null)
      }
    }, 2500)
    return () => clearInterval(iv)
  }, [paused])

  // ── Wallet ────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('trench_radar_wallet')
    if (!saved) return
    const data = JSON.parse(saved)
    setWallet(data)
    conn.current.getBalance(new web3.PublicKey(data.publicKey))
      .then(b=>setWallet(w=>({...w,balance:b/web3.LAMPORTS_PER_SOL}))).catch(()=>{})
  }, [])

  const generateWallet = async () => {
    const kp = web3.Keypair.generate()
    const data = {publicKey:kp.publicKey.toString(),secretKey:Array.from(kp.secretKey),balance:0,network:'devnet'}
    localStorage.setItem('trench_radar_wallet', JSON.stringify(data))
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
    const received = (amt/selected.price)*0.97
    setPositions(prev=>[{id:Math.random().toString(36).slice(2),token:{...selected},entryPrice:selected.price,tokensHeld:received,solSpent:amt,currentPrice:selected.price,pnl:0,pnlPct:0,ts:Date.now()},...prev])
    setWallet(w=>({...w,balance:(w.balance||0)-amt}))
    setTxStatus('success')
    setActiveTab('positions')
    setTimeout(()=>setTxStatus(null),2000)
  }

  const sell = (posId) => {
    const pos = positions.find(p=>p.id===posId)
    if(!pos) return
    const val = pos.tokensHeld*pos.currentPrice*0.97
    setWallet(w=>({...w,balance:(w.balance||0)+val}))
    setPositions(prev=>prev.filter(p=>p.id!==posId))
  }

  const clickToken = (token) => {
    setSelected(token)
    setActiveTab('chart')
  }

  const riskColor = (s) => s>=70?'#00FF88':s>=40?'#FFD700':'#FF3366'

  // ── Token Card ────────────────────────────────────────
  const TokenCard = ({token}) => {
    const up = token.priceChange5m >= 0
    const isSel = selected?.id === token.id
    return (
      <div onClick={()=>clickToken(token)} style={{background:isSel?'rgba(0,255,136,0.06)':'#0a0a10',border:`1px solid ${isSel?'rgba(0,255,136,0.4)':'#1a1a2e'}`,padding:'12px',cursor:'pointer',transition:'all 0.15s',marginBottom:'6px'}}
        onMouseEnter={e=>{if(!isSel){e.currentTarget.style.background='#0d0d18';e.currentTarget.style.borderColor='#1f1f3a'}}}
        onMouseLeave={e=>{if(!isSel){e.currentTarget.style.background='#0a0a10';e.currentTarget.style.borderColor='#1a1a2e'}}}
      >
        {/* Top row */}
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
          <div style={{width:'36px',height:'36px',borderRadius:'50%',background:token.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'15px',color:'#fff',flexShrink:0,fontWeight:'bold'}}>{token.symbol[0]}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#e0e0f0',fontWeight:'bold'}}>{token.symbol}</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{token.name}</div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:up?'#00FF88':'#FF3366',fontWeight:'bold'}}>{fmtPct(token.priceChange5m)}</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>{elapsed(token.age)}</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'1px'}}>VOL</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#e0e0f0'}}>{fmt(token.volume5m)}</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'1px'}}>MCAP</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#FFD700'}}>{fmt(token.marketCap)}</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'1px'}}>BUYS</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#00FF88'}}>{token.buys5m}</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'1px'}}>SELLS</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#FF3366'}}>{token.sells5m}</div>
          </div>
        </div>

        {/* Bonding curve bar */}
        <div style={{marginBottom:'8px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',letterSpacing:'1px'}}>BONDING CURVE</span>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:token.bondingCurve>80?'#FF3366':token.bondingCurve>50?'#FFD700':'#00FF88'}}>{token.bondingCurve.toFixed(0)}%</span>
          </div>
          <div style={{height:'3px',background:'#1a1a2e',borderRadius:'2px',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${token.bondingCurve}%`,background:token.bondingCurve>80?'#FF3366':token.bondingCurve>50?'#FFD700':'#00FF88',transition:'width 0.5s ease'}}/>
          </div>
        </div>

        {/* Bottom row */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'2px 6px',background:token.devHolding<10?'rgba(0,255,136,0.1)':'rgba(255,51,102,0.1)',color:token.devHolding<10?'#00FF88':'#FF3366',border:`1px solid ${token.devHolding<10?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)'}`,letterSpacing:'1px'}}>DEV {token.devHolding.toFixed(0)}%</span>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{token.holders} holders</span>
          </div>
          <button onClick={e=>{e.stopPropagation();clickToken(token);setActiveTab('buy')}} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',letterSpacing:'1px',padding:'4px 12px',background:'rgba(0,255,136,0.1)',border:'1px solid rgba(0,255,136,0.3)',color:'#00FF88',cursor:'pointer'}}>
            ⚡ BUY
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#050508',color:'#e0e0f0',fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      <Nav active="/radar"/>

      {/* TX Toast */}
      {txStatus&&<div style={{position:'fixed',top:'60px',right:'20px',zIndex:9999,padding:'10px 18px',background:txStatus==='success'?'rgba(0,255,136,0.1)':txStatus==='error'?'rgba(255,51,102,0.1)':'rgba(10,10,16,0.95)',border:`1px solid ${txStatus==='success'?'rgba(0,255,136,0.4)':txStatus==='error'?'rgba(255,51,102,0.4)':'#1a1a2e'}`,fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:txStatus==='success'?'#00FF88':txStatus==='error'?'#FF3366':'#6666aa',letterSpacing:'1px',borderRadius:'2px'}}>
        {txStatus==='pending'?'⟳ PROCESSING...':txStatus==='success'?'✓ SUCCESS':'✗ FAILED'}
      </div>}

      <div style={{display:'flex',flex:1,overflow:'hidden',marginTop:'52px'}}>

        {/* ── LEFT: Feed OR Detail ── */}
        {!selected ? (
          // ── 3-COLUMN FEED ─────────────────────────────
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Feed header */}
            <div style={{padding:'8px 16px',borderBottom:'1px solid #1a1a2e',background:'#070710',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#FF3366',animation:'rp 1s infinite',boxShadow:'0 0 6px #FF336688'}}/>
                <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'18px',letterSpacing:'4px',color:'#e0e0f0'}}>RADAR</span>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'2px'}}>// PUMP.FUN LIVE SCANNER · DEVNET</span>
              </div>
              <button onClick={()=>setPaused(p=>!p)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'4px 10px',background:paused?'rgba(255,215,0,0.1)':'rgba(255,51,102,0.1)',border:`1px solid ${paused?'rgba(255,215,0,0.3)':'rgba(255,51,102,0.3)'}`,color:paused?'#FFD700':'#FF3366',cursor:'pointer'}}>{paused?'▶ RESUME':'⏸ PAUSE'}</button>
            </div>

            {/* 3 columns */}
            <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0',overflow:'hidden'}}>
              {[
                {key:'new',label:'NEW PAIRS',color:'#00FF88',tokens:newPairs,desc:'Just launched · Under $15K mcap'},
                {key:'stretch',label:'FINAL STRETCH',color:'#FFD700',tokens:stretch,desc:'80%+ bonding curve · About to migrate'},
                {key:'migrated',label:'MIGRATED',color:'#0088ff',tokens:migrated,desc:'Live on Raydium · Tradeable'},
              ].map((col,ci)=>(
                <div key={col.key} style={{display:'flex',flexDirection:'column',overflow:'hidden',borderRight:ci<2?'1px solid #1a1a2e':'none'}}>
                  {/* Column header */}
                  <div style={{padding:'10px 12px',borderBottom:'1px solid #1a1a2e',background:'#050508',flexShrink:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'2px'}}>
                      <div style={{width:'6px',height:'6px',borderRadius:'50%',background:col.color}}/>
                      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'14px',letterSpacing:'3px',color:col.color}}>{col.label}</span>
                      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',marginLeft:'auto'}}>{col.tokens.length}</span>
                    </div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',letterSpacing:'1px'}}>{col.desc}</div>
                  </div>
                  {/* Cards */}
                  <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
                    {col.tokens.map(t=><TokenCard key={t.id} token={t}/>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // ── TOKEN DETAIL VIEW (Axiom-style) ───────────
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

            {/* Token top bar */}
            <div style={{padding:'8px 16px',borderBottom:'1px solid #1a1a2e',background:'#070710',display:'flex',alignItems:'center',gap:'12px',flexShrink:0}}>
              <button onClick={()=>setSelected(null)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa',background:'none',border:'1px solid #1a1a2e',padding:'5px 10px',cursor:'pointer',flexShrink:0}}>← BACK</button>

              <div style={{width:'28px',height:'28px',borderRadius:'50%',background:selected.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'13px',color:'#fff',flexShrink:0}}>{selected.symbol[0]}</div>

              <div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'16px',letterSpacing:'3px',color:'#e0e0f0',lineHeight:1}}>${selected.symbol}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa'}}>{selected.name}</div>
              </div>

              <div style={{display:'flex',gap:'20px',marginLeft:'8px'}}>
                {[
                  ['PRICE',`$${selected.price.toExponential(2)}`,'#e0e0f0'],
                  ['MCAP',fmt(selected.marketCap),'#FFD700'],
                  ['5M',fmtPct(selected.priceChange5m),selected.priceChange5m>=0?'#00FF88':'#FF3366'],
                  ['VOL',fmt(selected.volume5m),'#e0e0f0'],
                  ['LIQ',fmt(selected.liquidity),'#e0e0f0'],
                  ['BUYS',selected.buys5m,'#00FF88'],
                  ['SELLS',selected.sells5m,'#FF3366'],
                ].map(([l,v,c])=>(
                  <div key={l}>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',letterSpacing:'1px'}}>{l}</div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:c,fontWeight:'bold'}}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{marginLeft:'auto',display:'flex',gap:'8px',alignItems:'center'}}>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'3px 8px',background:selected.devHolding<10?'rgba(0,255,136,0.1)':'rgba(255,51,102,0.1)',color:selected.devHolding<10?'#00FF88':'#FF3366',border:`1px solid ${selected.devHolding<10?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)'}`}}>DEV {selected.devHolding.toFixed(0)}%</span>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>{tr(selected.address)}</span>
              </div>
            </div>

            {/* Main area: chart + right panel */}
            <div style={{flex:1,display:'flex',overflow:'hidden'}}>

              {/* Chart (takes most space) */}
              <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                {/* Chart area */}
                <div style={{flex:1,position:'relative',background:'#070710'}}>
                  <iframe
                    src={`https://dexscreener.com/solana/${selected.address}?embed=1&theme=dark&trades=0&info=0`}
                    style={{width:'100%',height:'100%',border:'none'}}
                    title="Chart"
                  />
                  {/* Devnet overlay */}
                  <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'rgba(5,5,8,0.88)',backdropFilter:'blur(2px)'}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'14px',letterSpacing:'4px',color:'#3a3a5c',marginBottom:'16px'}}>DEVNET MODE — SIMULATED TOKEN</div>
                    {/* Fake candlestick chart */}
                    <svg width="600" height="200" style={{opacity:0.7}}>
                      {Array.from({length:60},(_, i)=>{
                        const x = i*10+5
                        const open = 100+Math.sin(i*0.3)*30+Math.random()*20
                        const close = open+(Math.random()-0.45)*15
                        const high = Math.max(open,close)+Math.random()*8
                        const low = Math.min(open,close)-Math.random()*8
                        const up = close>=open
                        return (
                          <g key={i}>
                            <line x1={x} y1={200-high} x2={x} y2={200-low} stroke={up?'#00FF88':'#FF3366'} strokeWidth="1" opacity="0.6"/>
                            <rect x={x-3} y={200-Math.max(open,close)} width="6" height={Math.abs(open-close)||1} fill={up?'#00FF88':'#FF3366'} opacity="0.8"/>
                          </g>
                        )
                      })}
                    </svg>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#3a3a5c',marginTop:'12px',letterSpacing:'2px'}}>SWITCH TO MAINNET FOR REAL CHARTS</div>
                  </div>
                </div>

                {/* Trades / Holders bottom tabs */}
                <div style={{height:'180px',borderTop:'1px solid #1a1a2e',flexShrink:0,display:'flex',flexDirection:'column'}}>
                  <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',background:'#070710',flexShrink:0}}>
                    {['TRADES','HOLDERS','DEV TOKENS'].map(t=>(
                      <button key={t} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',letterSpacing:'1px',padding:'7px 14px',background:'none',border:'none',borderBottom:`2px solid ${t==='TRADES'?'#00FF88':'transparent'}`,color:t==='TRADES'?'#00FF88':'#6666aa',cursor:'pointer'}}>{t}</button>
                    ))}
                  </div>
                  {/* Mock trades */}
                  <div style={{flex:1,overflowY:'auto'}}>
                    {Array.from({length:8},(_,i)=>{
                      const isBuy = Math.random()>0.4
                      const amt = (Math.random()*2+0.01).toFixed(3)
                      const time = Math.floor(Math.random()*300)
                      return (
                        <div key={i} style={{display:'grid',gridTemplateColumns:'60px 80px 1fr 80px 60px',padding:'5px 14px',borderBottom:'1px solid #0a0a0f',alignItems:'center'}}>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:isBuy?'#00FF88':'#FF3366'}}>{isBuy?'BUY':'SELL'}</span>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#e0e0f0'}}>{amt} SOL</span>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>{tr(selected.address)}</span>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa'}}>{fmt(selected.marketCap)}</span>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>{time}s ago</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* RIGHT: Buy panel (like Axiom) */}
              <div style={{width:'260px',flexShrink:0,display:'flex',flexDirection:'column',borderLeft:'1px solid #1a1a2e',overflow:'hidden'}}>

                {/* Buy/Sell tabs */}
                <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',flexShrink:0}}>
                  <button onClick={()=>setActiveTab('buy')} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'1px',padding:'10px',background:activeTab==='buy'?'rgba(0,255,136,0.08)':'transparent',border:'none',borderBottom:`2px solid ${activeTab==='buy'?'#00FF88':'transparent'}`,color:activeTab==='buy'?'#00FF88':'#6666aa',cursor:'pointer'}}>BUY</button>
                  <button onClick={()=>setActiveTab('sell')} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'1px',padding:'10px',background:activeTab==='sell'?'rgba(255,51,102,0.08)':'transparent',border:'none',borderBottom:`2px solid ${activeTab==='sell'?'#FF3366':'transparent'}`,color:activeTab==='sell'?'#FF3366':'#6666aa',cursor:'pointer'}}>SELL</button>
                  <button onClick={()=>setActiveTab('positions')} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',letterSpacing:'1px',padding:'10px',background:activeTab==='positions'?'rgba(0,136,255,0.08)':'transparent',border:'none',borderBottom:`2px solid ${activeTab==='positions'?'#0088ff':'transparent'}`,color:activeTab==='positions'?'#0088ff':'#6666aa',cursor:'pointer'}}>BAGS</button>
                </div>

                <div style={{flex:1,overflowY:'auto',padding:'14px'}}>
                  {activeTab==='buy' && (
                    <>
                      {/* Wallet */}
                      {!wallet ? (
                        <button onClick={generateWallet} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'2px',color:'#050508',background:'#00FF88',border:'none',padding:'10px',cursor:'pointer',marginBottom:'12px',clipPath:'polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)'}}>
                          ⚡ GENERATE WALLET
                        </button>
                      ) : (
                        <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'10px',marginBottom:'12px'}}>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',marginBottom:'4px'}}>RADAR WALLET · DEVNET</div>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'22px',color:'#00FF88',letterSpacing:'2px'}}>{(wallet.balance||0).toFixed(4)} SOL</div>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',marginTop:'2px'}}>{tr(wallet.publicKey)}</div>
                        </div>
                      )}

                      {/* Amount presets */}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'8px'}}>
                        {['0.05','0.1','0.5','1'].map(amt=>(
                          <button key={amt} onClick={()=>setBuyAmount(amt)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',padding:'8px',background:buyAmount===amt?'rgba(0,255,136,0.1)':'#0a0a10',border:`1px solid ${buyAmount===amt?'rgba(0,255,136,0.4)':'#1a1a2e'}`,color:buyAmount===amt?'#00FF88':'#6666aa',cursor:'pointer'}}>{amt} SOL</button>
                        ))}
                      </div>

                      <div style={{display:'flex',marginBottom:'8px'}}>
                        <input value={buyAmount} onChange={e=>setBuyAmount(e.target.value)}
                          style={{flex:1,background:'#0a0a10',border:'1px solid #1a1a2e',borderRight:'none',color:'#e0e0f0',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',padding:'10px 12px',outline:'none'}}/>
                        <div style={{background:'#070710',border:'1px solid #1a1a2e',padding:'10px 10px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa'}}>SOL</div>
                      </div>

                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',marginBottom:'12px'}}>
                        ≈ {parseFloat(buyAmount||0)>0?((parseFloat(buyAmount)/selected.price)*0.97).toExponential(2):'0'} {selected.symbol}
                      </div>

                      {/* Slippage */}
                      <div style={{display:'flex',gap:'4px',marginBottom:'12px'}}>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',display:'flex',alignItems:'center',marginRight:'4px'}}>SLIPPAGE</span>
                        {['1%','3%','5%','10%'].map(s=>(
                          <button key={s} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'3px 7px',background:s==='3%'?'rgba(0,255,136,0.1)':'transparent',border:`1px solid ${s==='3%'?'rgba(0,255,136,0.3)':'#1a1a2e'}`,color:s==='3%'?'#00FF88':'#6666aa',cursor:'pointer'}}>{s}</button>
                        ))}
                      </div>

                      <button onClick={buy} disabled={!wallet||txStatus==='pending'}
                        style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',letterSpacing:'3px',color:'#050508',background:!wallet?'#1a1a2e':'#00FF88',border:'none',padding:'14px',cursor:wallet?'pointer':'not-allowed',clipPath:'polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)',marginBottom:'8px'}}>
                        {txStatus==='pending'?'BUYING...':'⚡ BUY NOW'}
                      </button>

                      {!wallet && (
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',textAlign:'center',letterSpacing:'1px'}}>GENERATE WALLET TO TRADE</div>
                      )}

                      {wallet && (wallet.balance||0) < parseFloat(buyAmount||0) && (
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#FFD700',textAlign:'center'}}>
                          NEED MORE SOL →{' '}
                          <button onClick={airdrop} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#FFD700',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>AIRDROP 2 SOL FREE</button>
                        </div>
                      )}

                      {/* Token info */}
                      <div style={{marginTop:'16px',display:'flex',flexDirection:'column',gap:'6px'}}>
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'2px',marginBottom:'4px'}}>TOKEN INFO</div>
                        {[
                          ['Market Cap',fmt(selected.marketCap)],
                          ['Liquidity',fmt(selected.liquidity)],
                          ['Dev Holding',`${selected.devHolding.toFixed(1)}%`],
                          ['Bonding Curve',`${selected.bondingCurve.toFixed(1)}%`],
                          ['Holders',selected.holders],
                          ['Age',elapsed(selected.age)],
                        ].map(([k,v])=>(
                          <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #0d0d18'}}>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>{k}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#e0e0f0'}}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {activeTab==='sell' && (
                    <div style={{textAlign:'center',padding:'24px 0',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#3a3a5c'}}>
                      NO POSITION IN ${selected.symbol}<br/>
                      <span style={{fontSize:'8px',letterSpacing:'1px'}}>BUY FIRST TO SELL</span>
                    </div>
                  )}

                  {activeTab==='positions' && (
                    <>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',letterSpacing:'2px',marginBottom:'12px'}}>OPEN BAGS ({positions.length})</div>
                      {positions.length===0?(
                        <div style={{textAlign:'center',padding:'24px 0',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#1a1a2e'}}>
                          NO OPEN POSITIONS<br/>
                          <span style={{fontSize:'8px'}}>BUY A TOKEN TO START</span>
                        </div>
                      ):positions.map(pos=>{
                        const up=pos.pnl>=0
                        return (
                          <div key={pos.id} style={{background:'#0a0a10',border:`1px solid ${up?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)'}`,padding:'10px',marginBottom:'8px'}}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#e0e0f0'}}>${pos.token.symbol}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:up?'#00FF88':'#FF3366',fontWeight:'bold'}}>{up?'+':''}{pos.pnlPct.toFixed(1)}%</span>
                            </div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',marginBottom:'6px'}}>{pos.solSpent.toFixed(3)} SOL → {up?'+':''}{pos.pnl.toFixed(4)} SOL</div>
                            <button onClick={()=>sell(pos.id)} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',letterSpacing:'1px',color:'#FF3366',background:'rgba(255,51,102,0.05)',border:'1px solid rgba(255,51,102,0.3)',padding:'5px',cursor:'pointer'}}>SELL ALL</button>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes rp{0%,100%{opacity:1}50%{opacity:0.3}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#050508}
        ::-webkit-scrollbar-thumb{background:#1a1a2e;border-radius:2px}
      `}</style>
    </div>
  )
}
