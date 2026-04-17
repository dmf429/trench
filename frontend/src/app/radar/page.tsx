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

// Real pump.fun tokens with actual DexScreener charts
const REAL_TOKENS = [
  { symbol:'BONK', name:'Bonk', address:'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', pairAddress:'8QaXeHBrShJTdtN1rNqpUcgXd4JKEaHTHQgBexU8VJCu', color:'#FF6B35' },
  { symbol:'WIF',  name:'dogwifhat', address:'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', pairAddress:'EP2ib6dYdEeqD8MfE2ezHCxX3kP3K2eLKkirfPm5eyMx', color:'#4ECDC4' },
  { symbol:'POPCAT', name:'Popcat', address:'7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', pairAddress:'FRhB8L7Y9Qq41qZXYLtC2nw8An1RJfLLxRF2x9RwLLMo', color:'#FF9F43' },
  { symbol:'MEW', name:'cat in a dogs world', address:'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5', pairAddress:'879F697iuDJGMevRkRcnW21fcXiAeLJK1ffsw2ATebce', color:'#A29BFE' },
  { symbol:'BOME', name:'BOOK OF MEME', address:'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82', pairAddress:'DSUvc5qf5LJHHV5e2tD184ixotSnCnwj7i4jJa4Xsrmt', color:'#FD79A8' },
  { symbol:'MOODENG', name:'moo deng', address:'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzc8eu', pairAddress:'B4tKZGMvgpWRdTQVMDMVYv3BPvHrEXFUxExS6bVCxuUG', color:'#55EFC4' },
  { symbol:'PNUT', name:'Peanut the Squirrel', address:'2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump', pairAddress:'7kgkDpbvgFdQCKFDYBqRgBGFz2pjCJNXqtnnZDuFCZXs', color:'#FDCB6E' },
  { symbol:'FARTCOIN', name:'Fartcoin', address:'9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', pairAddress:'Bzc9NZfMqkXR6fz1DBph7BDf9BroyKd9rxMjKkFAVATa', color:'#00B894' },
  { symbol:'GOAT', name:'Goatseus Maximus', address:'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump', pairAddress:'4mFHq2M59U5oQVYTdJjB24q5dBQVXaAPbAQdsSdpump', color:'#E17055' },
  { symbol:'NEET', name:'NotInEmploymentEducation', address:'Ce2gx9KGXJ6C9Mp5b5x1sn9Mg87JwEbrQby4Zqo3pump', pairAddress:'5wNu5QhdpRGrL37ffcd6TMMqZugQgxwafgz477rShtHy', color:'#74B9FF' },
  { symbol:'SPIKE', name:'SPIKE', address:'BFiGUxnidogqcZAPVPDZRCfhx3nXnFLYqpQUaUGpump', pairAddress:'DeSYSGeEj9ytT55E9AmdFs9p2cm5fryXt61kGCammCrB', color:'#FD79A8' },
  { symbol:'POPCAT2', name:'Popcat V2', address:'7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', pairAddress:'DNsB9ERJmcHyFUAQLStDTLeMbZvkTaoemeuXNDQgda8R', color:'#6C5CE7' },
]

const COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9','#FF9F43','#A29BFE']

function buildToken(base, stage='new') {
  const mcapBase = stage==='new' ? Math.random()*15000+500 : stage==='stretch' ? Math.random()*60000+15000 : Math.random()*500000+60000
  const bondingBase = stage==='new' ? Math.random()*40 : stage==='stretch' ? Math.random()*30+60 : 100
  const ageBase = stage==='new' ? Math.random()*600000 : stage==='stretch' ? Math.random()*3600000+600000 : Math.random()*86400000
  return {
    id: base.symbol + '-' + stage + '-' + Math.random().toString(36).slice(2),
    symbol: base.symbol,
    name: base.name,
    address: base.address,
    pairAddress: base.pairAddress,
    color: base.color || COLORS[Math.floor(Math.random()*COLORS.length)],
    price: Math.random()*0.001+0.000001,
    marketCap: mcapBase,
    liquidity: mcapBase*0.3,
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
  }
}

function randomToken(stage) {
  const base = REAL_TOKENS[Math.floor(Math.random()*REAL_TOKENS.length)]
  return buildToken(base, stage)
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
  const [activeTab, setActiveTab] = useState('buy')
  const conn = useRef(new web3.Connection(DEVNET))

  useEffect(() => {
    setNewPairs(Array.from({length:6},()=>randomToken('new')))
    setStretch(Array.from({length:5},()=>randomToken('stretch')))
    setMigrated(Array.from({length:6},()=>randomToken('migrated')))

    const iv = setInterval(() => {
      if (paused) return
      setNewPairs(prev => [randomToken('new'), ...prev.slice(0,7)])
      const upd = arr => arr.map(t=>({
        ...t,
        price: Math.max(0.000001,t.price*(1+(Math.random()-0.45)*0.1)),
        priceChange5m: t.priceChange5m+(Math.random()-0.5)*20,
        buys5m: t.buys5m+Math.floor(Math.random()*4),
        sells5m: t.sells5m+Math.floor(Math.random()*2),
        marketCap: Math.max(100,t.marketCap*(1+(Math.random()-0.45)*0.08)),
        bondingCurve: Math.min(100,t.bondingCurve+Math.random()*1.5),
        volume5m: t.volume5m+Math.random()*500,
      }))
      setNewPairs(upd)
      setStretch(upd)
      setMigrated(upd)
      if (selected) setSelected(p=>p?({...p,price:Math.max(0.000001,p.price*(1+(Math.random()-0.45)*0.08)),priceChange5m:p.priceChange5m+(Math.random()-0.5)*10,buys5m:p.buys5m+Math.floor(Math.random()*3),sells5m:p.sells5m+Math.floor(Math.random()*2),marketCap:Math.max(100,p.marketCap*(1+(Math.random()-0.45)*0.06))}):null)
    }, 2500)
    return ()=>clearInterval(iv)
  }, [paused])

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
    const received = (amt/selected.price)*0.97
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

  useEffect(()=>{
    setPositions(prev=>prev.map(pos=>{
      const pnl=(pos.tokensHeld*(selected?.id===pos.token.id?selected.price:pos.currentPrice))-pos.solSpent
      return {...pos,currentPrice:selected?.id===pos.token.id?selected.price:pos.currentPrice,pnl,pnlPct:(pnl/pos.solSpent)*100}
    }))
  },[selected])

  const TokenCard = ({token}) => {
    const up = token.priceChange5m>=0
    const isSel = selected?.id===token.id
    return (
      <div onClick={()=>{setSelected(token);setActiveTab('buy')}}
        style={{background:isSel?'rgba(0,255,136,0.06)':'#0a0a10',border:`1px solid ${isSel?'rgba(0,255,136,0.4)':'#1a1a2e'}`,padding:'12px',cursor:'pointer',marginBottom:'6px',transition:'all 0.1s',borderLeft:isSel?`3px solid #00FF88`:'3px solid transparent'}}
        onMouseEnter={e=>{if(!isSel){e.currentTarget.style.background='#0d0d18';e.currentTarget.style.borderColor='#1f1f3a'}}}
        onMouseLeave={e=>{if(!isSel){e.currentTarget.style.background='#0a0a10';e.currentTarget.style.borderColor='#1a1a2e'}}}
      >
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
          <div style={{width:'36px',height:'36px',borderRadius:'50%',background:token.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'15px',color:'#050508',flexShrink:0,fontWeight:'bold'}}>{token.symbol[0]}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#e0e0f0',fontWeight:'bold'}}>{token.symbol}</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{token.name}</div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:up?'#00FF88':'#FF3366',fontWeight:'bold'}}>{fmtPct(token.priceChange5m)}</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>{elapsed(token.age)}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'4px',marginBottom:'8px'}}>
          {[['VOL',fmt(token.volume5m),'#e0e0f0'],['MCAP',fmt(token.marketCap),'#FFD700'],['BUYS',token.buys5m,'#00FF88'],['SELLS',token.sells5m,'#FF3366']].map(([l,v,c])=>(
            <div key={l} style={{textAlign:'center'}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',letterSpacing:'1px'}}>{l}</div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:c}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:'8px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',letterSpacing:'1px'}}>BONDING CURVE</span>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:token.bondingCurve>80?'#FF3366':token.bondingCurve>50?'#FFD700':'#00FF88'}}>{token.bondingCurve.toFixed(0)}%</span>
          </div>
          <div style={{height:'3px',background:'#1a1a2e',borderRadius:'2px',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${token.bondingCurve}%`,background:token.bondingCurve>80?'#FF3366':token.bondingCurve>50?'#FFD700':'#00FF88',transition:'width 0.5s'}}/>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'2px 5px',background:token.devHolding<10?'rgba(0,255,136,0.1)':'rgba(255,51,102,0.1)',color:token.devHolding<10?'#00FF88':'#FF3366',border:`1px solid ${token.devHolding<10?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)'}`}}>DEV {token.devHolding.toFixed(0)}%</span>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{token.holders}h</span>
          </div>
          <button onClick={e=>{e.stopPropagation();setSelected(token);setActiveTab('buy')}} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',letterSpacing:'1px',padding:'4px 10px',background:'rgba(0,255,136,0.1)',border:'1px solid rgba(0,255,136,0.3)',color:'#00FF88',cursor:'pointer'}}>⚡ BUY</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#050508',color:'#e0e0f0',fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      <Nav active="/radar"/>

      {txStatus&&<div style={{position:'fixed',top:'60px',right:'20px',zIndex:9999,padding:'10px 18px',background:txStatus==='success'?'rgba(0,255,136,0.1)':txStatus==='error'?'rgba(255,51,102,0.1)':'rgba(10,10,16,0.95)',border:`1px solid ${txStatus==='success'?'rgba(0,255,136,0.4)':txStatus==='error'?'rgba(255,51,102,0.4)':'#1a1a2e'}`,fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:txStatus==='success'?'#00FF88':txStatus==='error'?'#FF3366':'#6666aa',letterSpacing:'1px'}}>
        {txStatus==='pending'?'⟳ PROCESSING...':txStatus==='success'?'✓ SUCCESS':'✗ FAILED'}
      </div>}

      <div style={{display:'flex',flex:1,overflow:'hidden',marginTop:'52px'}}>

        {/* ── 3-COL FEED ── */}
        {!selected ? (
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'8px 16px',borderBottom:'1px solid #1a1a2e',background:'#070710',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#FF3366',animation:'rp 1s infinite',boxShadow:'0 0 6px #FF336688'}}/>
                <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'18px',letterSpacing:'4px'}}>RADAR</span>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'2px'}}>// PUMP.FUN LIVE SCANNER</span>
              </div>
              <button onClick={()=>setPaused(p=>!p)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'4px 10px',background:paused?'rgba(255,215,0,0.1)':'rgba(255,51,102,0.1)',border:`1px solid ${paused?'rgba(255,215,0,0.3)':'rgba(255,51,102,0.3)'}`,color:paused?'#FFD700':'#FF3366',cursor:'pointer'}}>{paused?'▶ RESUME':'⏸ PAUSE'}</button>
            </div>
            <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',overflow:'hidden'}}>
              {[
                {label:'NEW PAIRS',color:'#00FF88',tokens:newPairs,desc:'Just launched · Under $15K'},
                {label:'FINAL STRETCH',color:'#FFD700',tokens:stretch,desc:'80%+ bonding · About to migrate'},
                {label:'MIGRATED',color:'#0088ff',tokens:migrated,desc:'Live on Raydium · Tradeable'},
              ].map((col,ci)=>(
                <div key={col.label} style={{display:'flex',flexDirection:'column',overflow:'hidden',borderRight:ci<2?'1px solid #1a1a2e':'none'}}>
                  <div style={{padding:'8px 12px',borderBottom:'1px solid #1a1a2e',background:'#050508',flexShrink:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'2px'}}>
                      <div style={{width:'6px',height:'6px',borderRadius:'50%',background:col.color}}/>
                      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'13px',letterSpacing:'3px',color:col.color}}>{col.label}</span>
                      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',marginLeft:'auto'}}>{col.tokens.length}</span>
                    </div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{col.desc}</div>
                  </div>
                  <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
                    {col.tokens.map(t=><TokenCard key={t.id} token={t}/>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // ── TOKEN DETAIL ──
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Header */}
            <div style={{padding:'8px 16px',borderBottom:'1px solid #1a1a2e',background:'#070710',display:'flex',alignItems:'center',gap:'12px',flexShrink:0}}>
              <button onClick={()=>setSelected(null)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa',background:'none',border:'1px solid #1a1a2e',padding:'5px 10px',cursor:'pointer',flexShrink:0}}>← BACK</button>
              <div style={{width:'28px',height:'28px',borderRadius:'50%',background:selected.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'13px',color:'#050508',flexShrink:0,fontWeight:'bold'}}>{selected.symbol[0]}</div>
              <div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'16px',letterSpacing:'3px',lineHeight:1}}>${selected.symbol}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa'}}>{selected.name}</div>
              </div>
              <div style={{display:'flex',gap:'16px',marginLeft:'8px'}}>
                {[['MCAP',fmt(selected.marketCap),'#FFD700'],['5M',fmtPct(selected.priceChange5m),selected.priceChange5m>=0?'#00FF88':'#FF3366'],['VOL',fmt(selected.volume5m),'#e0e0f0'],['LIQ',fmt(selected.liquidity),'#e0e0f0'],['BUYS',selected.buys5m,'#00FF88'],['SELLS',selected.sells5m,'#FF3366']].map(([l,v,c])=>(
                  <div key={l}>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',letterSpacing:'1px'}}>{l}</div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:c,fontWeight:'bold'}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{marginLeft:'auto',display:'flex',gap:'8px',alignItems:'center'}}>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'3px 8px',background:selected.devHolding<10?'rgba(0,255,136,0.1)':'rgba(255,51,102,0.1)',color:selected.devHolding<10?'#00FF88':'#FF3366',border:`1px solid ${selected.devHolding<10?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)'}`}}>DEV {selected.devHolding.toFixed(0)}%</span>
                <a href={`https://dexscreener.com/solana/${selected.pairAddress}`} target="_blank" rel="noreferrer" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',border:'1px solid #1a1a2e',padding:'3px 8px',textDecoration:'none'}}>DEXSCREENER ↗</a>
              </div>
            </div>

            {/* Chart + right panel */}
            <div style={{flex:1,display:'flex',overflow:'hidden'}}>
              {/* REAL DEXSCREENER CHART */}
              <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <div style={{flex:1,background:'#000'}}>
                  <iframe
                    key={selected.pairAddress}
                    src={`https://dexscreener.com/solana/${selected.pairAddress}?embed=1&theme=dark&trades=0&info=0`}
                    style={{width:'100%',height:'100%',border:'none'}}
                    title={`${selected.symbol} Chart`}
                  />
                </div>

                {/* Trades feed */}
                <div style={{height:'160px',borderTop:'1px solid #1a1a2e',flexShrink:0,display:'flex',flexDirection:'column'}}>
                  <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',background:'#070710',flexShrink:0}}>
                    {['TRADES','HOLDERS','DEV TOKENS'].map((t,i)=>(
                      <button key={t} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',letterSpacing:'1px',padding:'6px 14px',background:'none',border:'none',borderBottom:`2px solid ${i===0?'#00FF88':'transparent'}`,color:i===0?'#00FF88':'#6666aa',cursor:'pointer'}}>{t}</button>
                    ))}
                  </div>
                  <div style={{flex:1,overflowY:'auto'}}>
                    {Array.from({length:10},(_,i)=>{
                      const isBuy=Math.random()>0.4
                      const amt=(Math.random()*2+0.01).toFixed(3)
                      const sec=Math.floor(Math.random()*300)
                      return (
                        <div key={i} style={{display:'grid',gridTemplateColumns:'50px 80px 1fr 80px 60px',padding:'4px 14px',borderBottom:'1px solid #0a0a0f',alignItems:'center'}}>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:isBuy?'#00FF88':'#FF3366',fontWeight:'bold'}}>{isBuy?'BUY':'SELL'}</span>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#e0e0f0'}}>{amt} SOL</span>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>{tr(selected.address)}</span>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa'}}>{fmt(selected.marketCap)}</span>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>{sec}s</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Right panel */}
              <div style={{width:'260px',flexShrink:0,display:'flex',flexDirection:'column',borderLeft:'1px solid #1a1a2e',overflow:'hidden'}}>
                <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',flexShrink:0}}>
                  {[['buy','BUY','#00FF88'],['sell','SELL','#FF3366'],['bags',`BAGS(${positions.length})`, '#0088ff']].map(([v,l,c])=>(
                    <button key={v} onClick={()=>setActiveTab(v)} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',letterSpacing:'1px',padding:'10px',background:activeTab===v?`rgba(${v==='buy'?'0,255,136':v==='sell'?'255,51,102':'0,136,255'},0.08)`:'transparent',border:'none',borderBottom:`2px solid ${activeTab===v?c:'transparent'}`,color:activeTab===v?c:'#6666aa',cursor:'pointer'}}>{l}</button>
                  ))}
                </div>

                <div style={{flex:1,overflowY:'auto',padding:'14px'}}>
                  {activeTab==='buy'&&(
                    <>
                      {!wallet?(
                        <button onClick={generateWallet} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'2px',color:'#050508',background:'#00FF88',border:'none',padding:'10px',cursor:'pointer',marginBottom:'12px',clipPath:'polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)'}}>⚡ GENERATE WALLET</button>
                      ):(
                        <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'10px',marginBottom:'12px'}}>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',marginBottom:'4px'}}>RADAR WALLET · DEVNET</div>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'22px',color:'#00FF88',letterSpacing:'2px'}}>{(wallet.balance||0).toFixed(4)} SOL</div>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',marginBottom:'6px'}}>{tr(wallet.publicKey)}</div>
                          {(wallet.balance||0)<0.1&&<button onClick={airdrop} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#FFD700',background:'rgba(255,215,0,0.05)',border:'1px solid rgba(255,215,0,0.2)',padding:'5px',cursor:'pointer'}}>🪂 AIRDROP 2 SOL FREE</button>}
                        </div>
                      )}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'8px'}}>
                        {['0.05','0.1','0.5','1'].map(amt=>(
                          <button key={amt} onClick={()=>setBuyAmount(amt)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',padding:'8px',background:buyAmount===amt?'rgba(0,255,136,0.1)':'#0a0a10',border:`1px solid ${buyAmount===amt?'rgba(0,255,136,0.4)':'#1a1a2e'}`,color:buyAmount===amt?'#00FF88':'#6666aa',cursor:'pointer'}}>{amt} SOL</button>
                        ))}
                      </div>
                      <div style={{display:'flex',marginBottom:'6px'}}>
                        <input value={buyAmount} onChange={e=>setBuyAmount(e.target.value)} style={{flex:1,background:'#0a0a10',border:'1px solid #1a1a2e',borderRight:'none',color:'#e0e0f0',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',padding:'10px 12px',outline:'none'}}/>
                        <div style={{background:'#070710',border:'1px solid #1a1a2e',padding:'10px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa'}}>SOL</div>
                      </div>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',marginBottom:'10px'}}>≈ {parseFloat(buyAmount||0)>0?((parseFloat(buyAmount)/selected.price)*0.97).toExponential(2):'0'} {selected.symbol} · 3% slip</div>
                      <div style={{display:'flex',gap:'4px',marginBottom:'10px'}}>
                        {['1%','3%','5%','10%'].map(s=>(
                          <button key={s} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'3px',background:s==='3%'?'rgba(0,255,136,0.1)':'transparent',border:`1px solid ${s==='3%'?'rgba(0,255,136,0.3)':'#1a1a2e'}`,color:s==='3%'?'#00FF88':'#6666aa',cursor:'pointer'}}>{s}</button>
                        ))}
                      </div>
                      <button onClick={buy} disabled={!wallet||txStatus==='pending'} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',letterSpacing:'2px',color:'#050508',background:!wallet?'#1a1a2e':'#00FF88',border:'none',padding:'13px',cursor:wallet?'pointer':'not-allowed',clipPath:'polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)',marginBottom:'12px'}}>
                        {txStatus==='pending'?'BUYING...':'⚡ BUY NOW'}
                      </button>
                      <div style={{display:'flex',flexDirection:'column',gap:'5px'}}>
                        {[['Market Cap',fmt(selected.marketCap)],['Liquidity',fmt(selected.liquidity)],['Dev Hold',`${selected.devHolding.toFixed(1)}%`],['Bonding',`${selected.bondingCurve.toFixed(1)}%`],['Holders',selected.holders],['Age',elapsed(selected.age)]].map(([k,v])=>(
                          <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #0d0d18'}}>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>{k}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#e0e0f0'}}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {activeTab==='sell'&&(
                    <div style={{textAlign:'center',padding:'32px 0',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#3a3a5c'}}>NO POSITION IN ${selected.symbol}<br/><span style={{fontSize:'8px'}}>BUY FIRST TO SELL</span></div>
                  )}
                  {activeTab==='bags'&&(
                    <>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',letterSpacing:'2px',marginBottom:'12px'}}>OPEN BAGS ({positions.length})</div>
                      {positions.length===0?<div style={{textAlign:'center',padding:'32px 0',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#1a1a2e'}}>NO OPEN POSITIONS</div>:
                        positions.map(pos=>{
                          const up=pos.pnl>=0
                          return <div key={pos.id} style={{background:'#0a0a10',border:`1px solid ${up?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)'}`,padding:'10px',marginBottom:'8px'}}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px'}}>${pos.token.symbol}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:up?'#00FF88':'#FF3366',fontWeight:'bold'}}>{up?'+':''}{pos.pnlPct.toFixed(1)}%</span>
                            </div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',marginBottom:'6px'}}>{pos.solSpent.toFixed(3)} SOL spent</div>
                            <button onClick={()=>sell(pos.id)} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#FF3366',background:'rgba(255,51,102,0.05)',border:'1px solid rgba(255,51,102,0.3)',padding:'5px',cursor:'pointer'}}>SELL ALL</button>
                          </div>
                        })
                      }
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes rp{0%,100%{opacity:1}50%{opacity:0.3}} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#050508} ::-webkit-scrollbar-thumb{background:#1a1a2e}`}</style>
    </div>
  )
}
