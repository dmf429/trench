// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import Nav from '../../components/Nav'
import * as web3 from '@solana/web3.js'

const DEVNET = 'https://api.devnet.solana.com'
const fmt = (n) => { if (!n) return '$0'; if (n>=1_000_000) return `$${(n/1_000_000).toFixed(1)}M`; if (n>=1_000) return `$${(n/1_000).toFixed(1)}K`; return `$${n.toFixed(0)}` }
const elapsed = (ts) => { const s=Math.floor((Date.now()-ts)/1000); if(s<60) return `${s}s`; if(s<3600) return `${Math.floor(s/60)}m`; return `${Math.floor(s/3600)}h` }

const SYMS = ['MOON','DOGE','PEPE','APE','CAT','CHAD','BASED','FROG','BEAR','BULL','BONK','WIF','GIGA','SIGMA','ALPHA','DEGEN','GEM','PUMP','SEND','TURBO','WAGMI','NGMI','RUG','SAFE','CHAD','COPE','SEETHE']
const ADJS = ['SUPER','MEGA','ULTRA','BASED','SIGMA','ALPHA','BABY','MINI','MAXI','TURBO','HYPER','GIGACHAD']

function mockToken() {
  const sym = SYMS[Math.floor(Math.random()*SYMS.length)]
  const name = `${ADJS[Math.floor(Math.random()*ADJS.length)]} ${sym}`
  const addr = Array.from({length:44},()=>'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789'[Math.floor(Math.random()*58)]).join('')
  return {
    id: Math.random().toString(36).slice(2),
    symbol: sym, name, address: addr,
    price: Math.random()*0.0001 + 0.000001,
    marketCap: Math.random()*80000+1000,
    liquidity: Math.random()*15000+500,
    volume5m: Math.random()*8000+100,
    priceChange5m: (Math.random()-0.35)*300,
    buys5m: Math.floor(Math.random()*60)+1,
    sells5m: Math.floor(Math.random()*25),
    age: Date.now()-Math.floor(Math.random()*600000),
    bondingCurve: Math.random()*95,
    devHolding: Math.random()*80,
    score: Math.floor(Math.random()*100),
    migrated: false,
  }
}

export default function RadarPage() {
  const [tokens, setTokens] = useState([])
  const [selected, setSelected] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [walletLoading, setWalletLoading] = useState(false)
  const [buyAmount, setBuyAmount] = useState('0.1')
  const [positions, setPositions] = useState([])
  const [txStatus, setTxStatus] = useState(null)
  const [paused, setPaused] = useState(false)
  const [sortBy, setSortBy] = useState('new')
  const [maxMcap, setMaxMcap] = useState(100000)
  const [showTab, setShowTab] = useState('chart') // chart | info | positions
  const conn = useRef(new web3.Connection(DEVNET, 'confirmed'))

  // ── Feed ──────────────────────────────────────────────
  useEffect(() => {
    setTokens(Array.from({length:20},mockToken))
    const iv = setInterval(() => {
      if (paused) return
      setTokens(prev => {
        const newTok = mockToken()
        const updated = [newTok, ...prev.slice(0,49)].map(t => ({
          ...t,
          price: Math.max(0.000001, t.price*(1+(Math.random()-0.45)*0.12)),
          priceChange5m: t.priceChange5m+(Math.random()-0.5)*30,
          buys5m: t.buys5m+Math.floor(Math.random()*4),
          sells5m: t.sells5m+Math.floor(Math.random()*2),
          marketCap: Math.max(100,t.marketCap*(1+(Math.random()-0.45)*0.12)),
          bondingCurve: Math.min(100,t.bondingCurve+Math.random()*1.5),
          volume5m: t.volume5m+Math.random()*500,
        }))
        // Update selected token too
        if (selected) {
          const updated_sel = updated.find(t=>t.id===selected.id)
          if (updated_sel) setSelected(updated_sel)
        }
        return updated
      })
    }, 1800)
    return () => clearInterval(iv)
  }, [paused])

  // ── Wallet ────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('trench_radar_wallet')
    if (!saved) return
    const data = JSON.parse(saved)
    setWallet(data)
    new web3.Connection(DEVNET).getBalance(new web3.PublicKey(data.publicKey))
      .then(b => setWallet(w=>({...w,balance:b/web3.LAMPORTS_PER_SOL}))).catch(()=>{})
  }, [])

  const generateWallet = async () => {
    setWalletLoading(true)
    const kp = web3.Keypair.generate()
    const data = { publicKey: kp.publicKey.toString(), secretKey: Array.from(kp.secretKey), balance: 0, network: 'devnet' }
    localStorage.setItem('trench_radar_wallet', JSON.stringify(data))
    setWallet(data)
    setWalletLoading(false)
  }

  const airdrop = async () => {
    if (!wallet) return
    setTxStatus('pending')
    try {
      const pk = new web3.PublicKey(wallet.publicKey)
      const sig = await conn.current.requestAirdrop(pk, 2*web3.LAMPORTS_PER_SOL)
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
    if (isNaN(amt)||amt<=0||amt>wallet.balance) return
    setTxStatus('pending')
    await new Promise(r=>setTimeout(r,1200))
    const received = (amt/selected.price)*0.97
    setPositions(prev=>[{id:Math.random().toString(36).slice(2),token:{...selected},entryPrice:selected.price,tokensHeld:received,solSpent:amt,currentPrice:selected.price,pnl:0,pnlPct:0,ts:Date.now()},...prev])
    setWallet(w=>({...w,balance:w.balance-amt}))
    setTxStatus('success')
    setShowTab('positions')
    setTimeout(()=>setTxStatus(null),2000)
  }

  const sell = (posId) => {
    const pos = positions.find(p=>p.id===posId)
    if (!pos) return
    const val = pos.tokensHeld*pos.currentPrice*0.97
    setWallet(w=>({...w,balance:w.balance+val}))
    setPositions(prev=>prev.filter(p=>p.id!==posId))
  }

  // Update positions P&L
  useEffect(()=>{
    setPositions(prev=>prev.map(pos=>{
      const t=tokens.find(t=>t.id===pos.token.id)
      if(!t) return pos
      const pnl=(pos.tokensHeld*t.price)-pos.solSpent
      return {...pos,currentPrice:t.price,pnl,pnlPct:(pnl/pos.solSpent)*100}
    }))
  },[tokens])

  const sorted = [...tokens]
    .filter(t=>t.marketCap<=maxMcap)
    .sort((a,b)=>{
      if(sortBy==='gainers') return b.priceChange5m-a.priceChange5m
      if(sortBy==='volume') return b.volume5m-a.volume5m
      if(sortBy==='mcap') return b.marketCap-a.marketCap
      return a.age-b.age // newest = smallest timestamp diff
    })

  const riskColor = (s) => s>=70?'#00FF88':s>=40?'#FFD700':'#FF3366'
  const tr = (a) => a?`${a.slice(0,6)}...${a.slice(-4)}`:''

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#050508',color:'#e0e0f0',fontFamily:"'DM Sans',sans-serif",overflow:'hidden'}}>
      <Nav active="/radar"/>

      {/* TX Toast */}
      {txStatus&&<div style={{position:'fixed',top:'60px',right:'20px',zIndex:9999,padding:'10px 18px',background:txStatus==='success'?'rgba(0,255,136,0.1)':txStatus==='error'?'rgba(255,51,102,0.1)':'rgba(10,10,16,0.95)',border:`1px solid ${txStatus==='success'?'rgba(0,255,136,0.4)':txStatus==='error'?'rgba(255,51,102,0.4)':'#1a1a2e'}`,fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:txStatus==='success'?'#00FF88':txStatus==='error'?'#FF3366':'#6666aa',letterSpacing:'1px'}}>
        {txStatus==='pending'?'⟳ PROCESSING...':txStatus==='success'?'✓ SUCCESS':'✗ FAILED'}
      </div>}

      <div style={{display:'flex',flex:1,overflow:'hidden',marginTop:'52px'}}>

        {/* ── FEED (LEFT) ── */}
        <div style={{width:selected?'420px':'100%',flexShrink:0,display:'flex',flexDirection:'column',overflow:'hidden',borderRight:'1px solid #1a1a2e',transition:'width 0.2s'}}>

          {/* Feed header */}
          <div style={{padding:'10px 14px',borderBottom:'1px solid #1a1a2e',background:'#070710',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#FF3366',animation:'rp 1s infinite',boxShadow:'0 0 6px #FF336688'}}/>
                <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'16px',letterSpacing:'3px'}}>RADAR</span>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'2px'}}>PUMP.FUN · DEVNET · {sorted.length} PAIRS</span>
              </div>
              <button onClick={()=>setPaused(p=>!p)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'3px 8px',background:paused?'rgba(255,215,0,0.1)':'rgba(255,51,102,0.1)',border:`1px solid ${paused?'rgba(255,215,0,0.3)':'rgba(255,51,102,0.3)'}`,color:paused?'#FFD700':'#FF3366',cursor:'pointer'}}>{paused?'▶ RESUME':'⏸ PAUSE'}</button>
            </div>
            <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
              {[['new','🆕 NEW'],['gainers','📈 GAINERS'],['volume','🔥 VOL'],['mcap','💰 MCAP']].map(([v,l])=>(
                <button key={v} onClick={()=>setSortBy(v)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'3px 8px',background:sortBy===v?'rgba(0,255,136,0.1)':'transparent',border:`1px solid ${sortBy===v?'rgba(0,255,136,0.3)':'#1a1a2e'}`,color:sortBy===v?'#00FF88':'#6666aa',cursor:'pointer'}}>{l}</button>
              ))}
              <select value={maxMcap} onChange={e=>setMaxMcap(parseInt(e.target.value))} style={{marginLeft:'auto',background:'#0a0a10',border:'1px solid #1a1a2e',color:'#6666aa',fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'3px 6px'}}>
                <option value={10000}>≤$10K</option><option value={50000}>≤$50K</option><option value={100000}>≤$100K</option><option value={1000000}>ALL</option>
              </select>
            </div>
          </div>

          {/* Column headers */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 70px 70px 55px 55px 45px',padding:'5px 14px',background:'#050508',borderBottom:'1px solid #0d0d18',fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',letterSpacing:'1px',flexShrink:0}}>
            <span>TOKEN</span><span>MCAP</span><span>5M CHG</span><span>BUYS</span><span>SELLS</span><span>AGE</span>
          </div>

          {/* Token rows */}
          <div style={{flex:1,overflowY:'auto'}}>
            {sorted.map(token=>{
              const up=token.priceChange5m>=0
              const isSel=selected?.id===token.id
              return (
                <div key={token.id} onClick={()=>{setSelected(isSel?null:token);if(!isSel)setShowTab('chart')}}
                  style={{display:'grid',gridTemplateColumns:'1fr 70px 70px 55px 55px 45px',padding:'7px 14px',borderBottom:'1px solid #0a0a0f',background:isSel?'rgba(0,255,136,0.05)':'transparent',cursor:'pointer',transition:'background 0.1s',alignItems:'center',borderLeft:isSel?'2px solid #00FF88':'2px solid transparent'}}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background='#0a0a10'}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background='transparent'}}
                >
                  <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
                    <div style={{width:'22px',height:'22px',borderRadius:'50%',background:`hsl(${token.symbol.charCodeAt(0)*13},55%,30%)`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'10px',color:'#fff',flexShrink:0}}>{token.symbol[0]}</div>
                    <div>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:isSel?'#00FF88':'#e0e0f0',fontWeight:isSel?'bold':'normal'}}>{token.symbol}</div>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{tr(token.address)}</div>
                    </div>
                  </div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#e0e0f0'}}>{fmt(token.marketCap)}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:up?'#00FF88':'#FF3366',fontWeight:'bold'}}>{up?'+':''}{token.priceChange5m.toFixed(0)}%</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#00FF88'}}>{token.buys5m}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#FF3366'}}>{token.sells5m}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c'}}>{elapsed(token.age)}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── DETAIL PANEL (RIGHT) ── */}
        {selected && (
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

            {/* Token header */}
            <div style={{padding:'12px 16px',borderBottom:'1px solid #1a1a2e',background:'#070710',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <div style={{width:'32px',height:'32px',borderRadius:'50%',background:`hsl(${selected.symbol.charCodeAt(0)*13},55%,30%)`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'14px',color:'#fff'}}>{selected.symbol[0]}</div>
                <div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'20px',letterSpacing:'3px',color:'#e0e0f0'}}>${selected.symbol}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa'}}>{selected.name}</div>
                </div>
                <div style={{marginLeft:'12px'}}>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'14px',color:selected.priceChange5m>=0?'#00FF88':'#FF3366',fontWeight:'bold'}}>
                    {selected.priceChange5m>=0?'+':''}{selected.priceChange5m.toFixed(1)}% <span style={{fontSize:'10px',color:'#3a3a5c'}}>5M</span>
                  </div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#6666aa'}}>{fmt(selected.marketCap)} MCAP</div>
                </div>
              </div>
              <button onClick={()=>setSelected(null)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#3a3a5c',background:'none',border:'1px solid #1a1a2e',padding:'6px 12px',cursor:'pointer'}}>✕ CLOSE</button>
            </div>

            {/* Tabs */}
            <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',background:'#0a0a10',flexShrink:0}}>
              {[['chart','📈 CHART'],['buy','⚡ BUY'],['info','📊 INFO'],['positions',`💼 POSITIONS (${positions.length})`]].map(([v,l])=>(
                <button key={v} onClick={()=>setShowTab(v)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',letterSpacing:'1px',padding:'10px 16px',background:'none',border:'none',borderBottom:`2px solid ${showTab===v?'#00FF88':'transparent'}`,color:showTab===v?'#00FF88':'#6666aa',cursor:'pointer'}}>{l}</button>
              ))}
            </div>

            {/* CHART TAB */}
            {showTab==='chart' && (
              <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <div style={{flex:1,background:'#070710',position:'relative'}}>
                  <iframe
                    src={`https://dexscreener.com/solana/${selected.address}?embed=1&theme=dark&trades=0&info=0`}
                    style={{width:'100%',height:'100%',border:'none'}}
                    title="Chart"
                  />
                  {/* Overlay for devnet tokens (no real chart) */}
                  <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'rgba(5,5,8,0.85)',pointerEvents:'none'}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'28px',letterSpacing:'4px',color:'#00FF88',marginBottom:'8px'}}>DEVNET MODE</div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#6666aa',letterSpacing:'2px',textAlign:'center',lineHeight:2}}>
                      REAL CHARTS LOAD ON MAINNET<br/>
                      TOKEN: {selected.symbol}<br/>
                      MCAP: {fmt(selected.marketCap)}<br/>
                      5M CHG: {selected.priceChange5m>=0?'+':''}{selected.priceChange5m.toFixed(1)}%<br/>
                      BONDING: {selected.bondingCurve.toFixed(1)}%
                    </div>
                    <div style={{marginTop:'20px',fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'1px'}}>SWITCH TO MAINNET FOR LIVE CHARTS</div>
                  </div>
                </div>
                {/* Quick buy bar at bottom */}
                <div style={{padding:'12px 16px',borderTop:'1px solid #1a1a2e',background:'#070710',display:'flex',gap:'8px',alignItems:'center',flexShrink:0}}>
                  {['0.1','0.5','1','2'].map(amt=>(
                    <button key={amt} onClick={()=>{setBuyAmount(amt);setShowTab('buy')}} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',padding:'8px 14px',background:'rgba(0,255,136,0.08)',border:'1px solid rgba(0,255,136,0.25)',color:'#00FF88',cursor:'pointer'}}>{amt} SOL</button>
                  ))}
                  <button onClick={()=>setShowTab('buy')} style={{marginLeft:'auto',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'2px',color:'#050508',background:'#00FF88',border:'none',padding:'8px 20px',cursor:'pointer',clipPath:'polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)'}}>⚡ BUY</button>
                </div>
              </div>
            )}

            {/* BUY TAB */}
            {showTab==='buy' && (
              <div style={{flex:1,padding:'24px',overflowY:'auto'}}>
                <div style={{maxWidth:'400px',margin:'0 auto'}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'24px',letterSpacing:'4px',marginBottom:'4px'}}>BUY <span style={{color:'#00FF88'}}>${selected.symbol}</span></div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',letterSpacing:'2px',marginBottom:'24px'}}>DEVNET · SIMULATED TRADE</div>

                  {!wallet ? (
                    <div style={{background:'rgba(255,51,102,0.05)',border:'1px solid rgba(255,51,102,0.2)',padding:'16px',marginBottom:'16px',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#FF3366',letterSpacing:'1px',textAlign:'center'}}>
                      ⚠ GENERATE A RADAR WALLET FIRST
                    </div>
                  ) : (
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#6666aa',marginBottom:'16px'}}>
                      BALANCE: <span style={{color:'#00FF88'}}>{wallet.balance?.toFixed(4)} SOL</span>
                    </div>
                  )}

                  {/* Amount buttons */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'8px',marginBottom:'12px'}}>
                    {['0.1','0.5','1','2'].map(amt=>(
                      <button key={amt} onClick={()=>setBuyAmount(amt)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',padding:'10px',background:buyAmount===amt?'rgba(0,255,136,0.1)':'#0a0a10',border:`1px solid ${buyAmount===amt?'rgba(0,255,136,0.4)':'#1a1a2e'}`,color:buyAmount===amt?'#00FF88':'#6666aa',cursor:'pointer'}}>{amt} SOL</button>
                    ))}
                  </div>

                  <div style={{display:'flex',marginBottom:'8px'}}>
                    <input value={buyAmount} onChange={e=>setBuyAmount(e.target.value)} style={{flex:1,background:'#0a0a10',border:'1px solid #1a1a2e',borderRight:'none',color:'#e0e0f0',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',padding:'12px 14px',outline:'none'}}/>
                    <div style={{background:'#070710',border:'1px solid #1a1a2e',padding:'12px 14px',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#6666aa'}}>SOL</div>
                  </div>

                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',marginBottom:'20px'}}>
                    ≈ {parseFloat(buyAmount||0)>0?((parseFloat(buyAmount)/selected.price)*0.97).toExponential(2):'0'} {selected.symbol} · 3% slippage
                  </div>

                  {/* Stats */}
                  <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'12px',marginBottom:'20px',display:'flex',flexDirection:'column',gap:'8px'}}>
                    {[['Price',`$${selected.price.toExponential(3)}`],['Market Cap',fmt(selected.marketCap)],['5M Change',`${selected.priceChange5m>=0?'+':''}${selected.priceChange5m.toFixed(1)}%`],['Buys 5M',selected.buys5m],['Sells 5M',selected.sells5m],['Bonding Curve',`${selected.bondingCurve.toFixed(1)}%`]].map(([k,v])=>(
                      <div key={k} style={{display:'flex',justifyContent:'space-between'}}>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c'}}>{k}</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#e0e0f0'}}>{v}</span>
                      </div>
                    ))}
                  </div>

                  <button onClick={buy} disabled={!wallet||txStatus==='pending'} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',letterSpacing:'3px',color:'#050508',background:!wallet?'#1a1a2e':'#00FF88',border:'none',padding:'16px',cursor:wallet?'pointer':'not-allowed',clipPath:'polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%)',marginBottom:'8px'}}>
                    {txStatus==='pending'?'BUYING...':'⚡ BUY NOW'}
                  </button>

                  {!wallet && (
                    <button onClick={()=>setShowTab('info')} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'2px',color:'#FFD700',background:'rgba(255,215,0,0.05)',border:'1px solid rgba(255,215,0,0.2)',padding:'10px',cursor:'pointer'}}>
                      → GENERATE WALLET FIRST
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* INFO TAB */}
            {showTab==='info' && (
              <div style={{flex:1,padding:'24px',overflowY:'auto'}}>
                <div style={{maxWidth:'500px'}}>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',letterSpacing:'2px',marginBottom:'16px'}}>// TOKEN INTELLIGENCE</div>

                  {/* Risk score */}
                  <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'16px',marginBottom:'16px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#6666aa'}}>TRENCH SCORE</span>
                      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'32px',color:riskColor(selected.score),letterSpacing:'2px'}}>{selected.score}</span>
                    </div>
                    <div style={{height:'4px',background:'#1a1a2e',marginBottom:'4px'}}>
                      <div style={{height:'100%',width:`${selected.score}%`,background:riskColor(selected.score)}}/>
                    </div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:riskColor(selected.score),letterSpacing:'1px'}}>{selected.score>=70?'LOW RISK':selected.score>=40?'MEDIUM RISK':'HIGH RISK'}</div>
                  </div>

                  {/* Stats grid */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'16px'}}>
                    {[
                      ['Contract',`${selected.address.slice(0,8)}...`,'#6666aa'],
                      ['Bonding Curve',`${selected.bondingCurve.toFixed(1)}%`,selected.bondingCurve>80?'#FF3366':'#00FF88'],
                      ['Dev Holding',`${selected.devHolding.toFixed(1)}%`,selected.devHolding>20?'#FF3366':'#00FF88'],
                      ['Liquidity',fmt(selected.liquidity),'#e0e0f0'],
                      ['Buy Pressure',`${Math.round(selected.buys5m/(selected.buys5m+selected.sells5m+1)*100)}%`,selected.buys5m>selected.sells5m?'#00FF88':'#FF3366'],
                      ['Age',elapsed(selected.age),'#e0e0f0'],
                    ].map(([k,v,c])=>(
                      <div key={k} style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'10px'}}>
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',marginBottom:'4px'}}>{k}</div>
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:c}}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Wallet */}
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',letterSpacing:'2px',marginBottom:'12px'}}>// RADAR WALLET · DEVNET</div>
                  {!wallet?(
                    <button onClick={generateWallet} disabled={walletLoading} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'2px',color:'#050508',background:'#00FF88',border:'none',padding:'12px',cursor:'pointer',clipPath:'polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)'}}>
                      {walletLoading?'GENERATING...':'⚡ GENERATE WALLET'}
                    </button>
                  ):(
                    <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'12px'}}>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',marginBottom:'4px'}}>ADDRESS</div>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa',wordBreak:'break-all',marginBottom:'8px'}}>{wallet.publicKey}</div>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'24px',color:'#00FF88',marginBottom:'8px'}}>{wallet.balance?.toFixed(4)} SOL</div>
                      <button onClick={airdrop} disabled={txStatus==='pending'} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',letterSpacing:'1px',color:'#FFD700',background:'rgba(255,215,0,0.05)',border:'1px solid rgba(255,215,0,0.2)',padding:'8px',cursor:'pointer'}}>🪂 AIRDROP 2 SOL FREE</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* POSITIONS TAB */}
            {showTab==='positions' && (
              <div style={{flex:1,padding:'16px',overflowY:'auto'}}>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',letterSpacing:'2px',marginBottom:'16px'}}>// OPEN POSITIONS ({positions.length})</div>
                {positions.length===0?(
                  <div style={{textAlign:'center',padding:'40px',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#1a1a2e'}}>NO OPEN POSITIONS<br/><span style={{fontSize:'8px',letterSpacing:'1px'}}>BUY A TOKEN TO GET STARTED</span></div>
                ):positions.map(pos=>{
                  const up=pos.pnl>=0
                  return (
                    <div key={pos.id} style={{background:'#0a0a10',border:`1px solid ${up?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)'}`,padding:'14px',marginBottom:'8px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'10px'}}>
                        <div>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#e0e0f0'}}>${pos.token.symbol}</div>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>{pos.solSpent.toFixed(3)} SOL spent</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'14px',color:up?'#00FF88':'#FF3366',fontWeight:'bold'}}>{up?'+':''}{pos.pnlPct.toFixed(1)}%</div>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:up?'#00FF88':'#FF3366'}}>{up?'+':''}{pos.pnl.toFixed(4)} SOL</div>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:'6px'}}>
                        <button onClick={()=>sell(pos.id)} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',letterSpacing:'1px',color:'#FF3366',background:'rgba(255,51,102,0.05)',border:'1px solid rgba(255,51,102,0.3)',padding:'6px',cursor:'pointer'}}>SELL ALL</button>
                        <button onClick={()=>{setSelected(pos.token);setShowTab('chart')}} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',letterSpacing:'1px',color:'#6666aa',background:'#0a0a10',border:'1px solid #1a1a2e',padding:'6px 10px',cursor:'pointer'}}>CHART</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes rp{0%,100%{opacity:1}50%{opacity:0.3}} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#050508} ::-webkit-scrollbar-thumb{background:#1a1a2e}`}</style>
    </div>
  )
}
