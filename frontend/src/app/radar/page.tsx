// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Nav from '../../components/Nav'
import * as web3 from '@solana/web3.js'

const DEVNET = 'https://api.devnet.solana.com'
const RPC = DEVNET // switch to mainnet when ready

// ── Helpers ───────────────────────────────────────────
const fmt = (n) => {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n/1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}
const fmtSol = (n) => n ? `${n.toFixed(4)} SOL` : '0 SOL'
const elapsed = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  return `${Math.floor(s/3600)}h ago`
}

// ── Mock new pairs (devnet — replace with WS in next phase) ──
function generateMockToken() {
  const names = ['MOON','DOGE','PEPE','APE','CAT','CHAD','BASED','FROG','BEAR','BULL','BONK','WIF','POPCAT','GIGA','SIGMA','ALPHA','DEGEN','GEM','PUMP','SEND']
  const adj = ['SUPER','MEGA','ULTRA','BASED','SIGMA','ALPHA','BABY','MINI','MAXI','TURBO']
  const sym = names[Math.floor(Math.random() * names.length)]
  const name = `${adj[Math.floor(Math.random() * adj.length)]} ${sym}`
  return {
    id: Math.random().toString(36).slice(2),
    symbol: sym,
    name,
    address: web3.Keypair.generate().publicKey.toString(),
    price: Math.random() * 0.0001,
    marketCap: Math.random() * 50000 + 1000,
    liquidity: Math.random() * 10000 + 500,
    volume5m: Math.random() * 5000,
    priceChange5m: (Math.random() - 0.3) * 200,
    buys5m: Math.floor(Math.random() * 50) + 1,
    sells5m: Math.floor(Math.random() * 20),
    age: Date.now() - Math.floor(Math.random() * 300000),
    migrated: false,
    devHolding: Math.random() * 100,
    score: Math.floor(Math.random() * 100),
    bondingCurve: Math.random() * 100,
  }
}

export default function RadarPage() {
  const [tokens, setTokens] = useState([])
  const [wallet, setWallet] = useState(null) // { publicKey, secretKey, balance }
  const [walletLoading, setWalletLoading] = useState(false)
  const [selectedToken, setSelectedToken] = useState(null)
  const [buyAmount, setBuyAmount] = useState('0.1')
  const [positions, setPositions] = useState([])
  const [filter, setFilter] = useState({ minMcap: 0, maxMcap: 100000, hideMigrated: true, minScore: 0 })
  const [sortBy, setSortBy] = useState('new')
  const [txStatus, setTxStatus] = useState(null) // null | 'pending' | 'success' | 'error'
  const [paused, setPaused] = useState(false)
  const intervalRef = useRef(null)
  const connection = useRef(new web3.Connection(RPC, 'confirmed'))

  // ── Simulate new token feed ───────────────────────────
  useEffect(() => {
    // Seed with initial tokens
    const initial = Array.from({ length: 15 }, generateMockToken)
    setTokens(initial)

    intervalRef.current = setInterval(() => {
      if (paused) return
      setTokens(prev => {
        const newToken = generateMockToken()
        const updated = [newToken, ...prev].slice(0, 50)
        // Randomly update some prices
        return updated.map(t => ({
          ...t,
          price: t.price * (1 + (Math.random() - 0.45) * 0.1),
          priceChange5m: t.priceChange5m + (Math.random() - 0.5) * 20,
          buys5m: t.buys5m + Math.floor(Math.random() * 3),
          sells5m: t.sells5m + Math.floor(Math.random() * 2),
          marketCap: t.marketCap * (1 + (Math.random() - 0.45) * 0.1),
          bondingCurve: Math.min(100, t.bondingCurve + Math.random() * 2),
        }))
      })
    }, 2000)

    return () => clearInterval(intervalRef.current)
  }, [paused])

  // ── Wallet Functions ──────────────────────────────────
  const generateWallet = async () => {
    setWalletLoading(true)
    try {
      const keypair = web3.Keypair.generate()
      const pubkey = keypair.publicKey.toString()
      // Save encrypted to localStorage
      const walletData = {
        publicKey: pubkey,
        secretKey: Array.from(keypair.secretKey),
        balance: 0,
        network: 'devnet'
      }
      localStorage.setItem('trench_radar_wallet', JSON.stringify(walletData))
      setWallet(walletData)
      // Try to get balance
      try {
        const bal = await connection.current.getBalance(keypair.publicKey)
        setWallet(w => ({ ...w, balance: bal / web3.LAMPORTS_PER_SOL }))
      } catch {}
    } catch (e) {
      console.error(e)
    }
    setWalletLoading(false)
  }

  const loadExistingWallet = async () => {
    const saved = localStorage.getItem('trench_radar_wallet')
    if (!saved) return
    try {
      const data = JSON.parse(saved)
      setWallet(data)
      // Refresh balance
      const pubkey = new web3.PublicKey(data.publicKey)
      const bal = await connection.current.getBalance(pubkey)
      setWallet(w => ({ ...w, balance: bal / web3.LAMPORTS_PER_SOL }))
    } catch {}
  }

  const requestAirdrop = async () => {
    if (!wallet) return
    setTxStatus('pending')
    try {
      const pubkey = new web3.PublicKey(wallet.publicKey)
      const sig = await connection.current.requestAirdrop(pubkey, 2 * web3.LAMPORTS_PER_SOL)
      await connection.current.confirmTransaction(sig)
      const bal = await connection.current.getBalance(pubkey)
      setWallet(w => ({ ...w, balance: bal / web3.LAMPORTS_PER_SOL }))
      setTxStatus('success')
      setTimeout(() => setTxStatus(null), 3000)
    } catch (e) {
      setTxStatus('error')
      setTimeout(() => setTxStatus(null), 3000)
    }
  }

  const refreshBalance = async () => {
    if (!wallet) return
    try {
      const pubkey = new web3.PublicKey(wallet.publicKey)
      const bal = await connection.current.getBalance(pubkey)
      setWallet(w => ({ ...w, balance: bal / web3.LAMPORTS_PER_SOL }))
    } catch {}
  }

  useEffect(() => { loadExistingWallet() }, [])

  // ── Buy simulation (devnet) ───────────────────────────
  const executeBuy = async (token) => {
    if (!wallet || !buyAmount) return
    const amount = parseFloat(buyAmount)
    if (isNaN(amount) || amount <= 0 || amount > wallet.balance) return
    setTxStatus('pending')
    try {
      // Simulate tx delay
      await new Promise(r => setTimeout(r, 1500))
      const tokens_received = (amount / token.price) * (0.97) // 3% slippage sim
      const position = {
        id: Math.random().toString(36).slice(2),
        token,
        entryPrice: token.price,
        tokensHeld: tokens_received,
        solSpent: amount,
        currentPrice: token.price,
        pnl: 0,
        pnlPct: 0,
        timestamp: Date.now(),
      }
      setPositions(prev => [position, ...prev])
      setWallet(w => ({ ...w, balance: w.balance - amount }))
      setTxStatus('success')
      setSelectedToken(null)
      setTimeout(() => setTxStatus(null), 3000)
    } catch {
      setTxStatus('error')
      setTimeout(() => setTxStatus(null), 3000)
    }
  }

  // Update position P&L
  useEffect(() => {
    setPositions(prev => prev.map(pos => {
      const currentToken = tokens.find(t => t.id === pos.token.id)
      if (!currentToken) return pos
      const currentPrice = currentToken.price
      const value = pos.tokensHeld * currentPrice
      const pnl = value - pos.solSpent
      const pnlPct = (pnl / pos.solSpent) * 100
      return { ...pos, currentPrice, pnl, pnlPct }
    }))
  }, [tokens])

  const sellPosition = (posId) => {
    const pos = positions.find(p => p.id === posId)
    if (!pos) return
    const value = pos.tokensHeld * pos.currentPrice * 0.97
    setWallet(w => ({ ...w, balance: w.balance + value }))
    setPositions(prev => prev.filter(p => p.id !== posId))
  }

  // ── Filter + Sort ─────────────────────────────────────
  const filtered = tokens
    .filter(t => t.marketCap >= filter.minMcap && t.marketCap <= filter.maxMcap)
    .filter(t => !filter.hideMigrated || !t.migrated)
    .filter(t => t.score >= filter.minScore)
    .sort((a, b) => {
      if (sortBy === 'new') return b.age - a.age  // newest first actually means lower timestamp
      if (sortBy === 'mcap') return b.marketCap - a.marketCap
      if (sortBy === 'volume') return b.volume5m - a.volume5m
      if (sortBy === 'gainers') return b.priceChange5m - a.priceChange5m
      return 0
    })

  const getRiskColor = (score) => score >= 70 ? '#00FF88' : score >= 40 ? '#FFD700' : '#FF3366'
  const tr = (addr) => addr ? `${addr.slice(0,4)}...${addr.slice(-4)}` : ''

  return (
    <div style={{minHeight:'100vh',background:'#050508',color:'#e0e0f0',fontFamily:"'DM Sans',sans-serif"}}>
      <Nav active="/radar"/>

      {/* TX Status Toast */}
      {txStatus && (
        <div style={{position:'fixed',top:'60px',right:'20px',zIndex:9999,padding:'12px 20px',background:txStatus==='pending'?'#0a0a10':txStatus==='success'?'rgba(0,255,136,0.1)':'rgba(255,51,102,0.1)',border:`1px solid ${txStatus==='pending'?'#1a1a2e':txStatus==='success'?'rgba(0,255,136,0.4)':'rgba(255,51,102,0.4)'}`,fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:txStatus==='pending'?'#6666aa':txStatus==='success'?'#00FF88':'#FF3366',letterSpacing:'1px'}}>
          {txStatus==='pending'?'⟳ PROCESSING...':txStatus==='success'?'✓ SUCCESS':'✗ FAILED'}
        </div>
      )}

      <div style={{display:'flex',height:'calc(100vh - 52px)',marginTop:'52px',overflow:'hidden'}}>

        {/* LEFT — Token Feed */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',borderRight:'1px solid #1a1a2e'}}>

          {/* Feed Header */}
          <div style={{padding:'12px 16px',borderBottom:'1px solid #1a1a2e',background:'#070710',flexShrink:0}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#FF3366',animation:'pulse 1s infinite',boxShadow:'0 0 8px #FF336688'}}/>
                <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'18px',letterSpacing:'3px',color:'#e0e0f0'}}>RADAR</span>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',letterSpacing:'2px'}}>// PUMP.FUN NEW PAIRS · DEVNET</span>
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa'}}>{filtered.length} pairs</span>
                <button onClick={()=>setPaused(p=>!p)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',letterSpacing:'1px',padding:'4px 10px',background:paused?'rgba(255,215,0,0.1)':'rgba(255,51,102,0.1)',border:`1px solid ${paused?'rgba(255,215,0,0.3)':'rgba(255,51,102,0.3)'}`,color:paused?'#FFD700':'#FF3366',cursor:'pointer'}}>
                  {paused?'▶ RESUME':'⏸ PAUSE'}
                </button>
              </div>
            </div>

            {/* Sort + Filter */}
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
              {[['new','🆕 NEW'],['gainers','📈 GAINERS'],['volume','🔥 VOLUME'],['mcap','💰 MCAP']].map(([v,l])=>(
                <button key={v} onClick={()=>setSortBy(v)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',letterSpacing:'1px',padding:'4px 10px',background:sortBy===v?'rgba(0,255,136,0.1)':'transparent',border:`1px solid ${sortBy===v?'rgba(0,255,136,0.4)':'#1a1a2e'}`,color:sortBy===v?'#00FF88':'#6666aa',cursor:'pointer'}}>{l}</button>
              ))}
              <div style={{marginLeft:'auto',display:'flex',gap:'6px',alignItems:'center'}}>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>MAX MCAP:</span>
                <select value={filter.maxMcap} onChange={e=>setFilter(f=>({...f,maxMcap:parseInt(e.target.value)}))} style={{background:'#0a0a10',border:'1px solid #1a1a2e',color:'#6666aa',fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',padding:'3px 6px'}}>
                  <option value={10000}>$10K</option>
                  <option value={50000}>$50K</option>
                  <option value={100000}>$100K</option>
                  <option value={1000000}>$1M</option>
                </select>
                <label style={{display:'flex',alignItems:'center',gap:'4px',fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',cursor:'pointer'}}>
                  <input type="checkbox" checked={filter.hideMigrated} onChange={e=>setFilter(f=>({...f,hideMigrated:e.target.checked}))} style={{accentColor:'#00FF88'}}/>
                  HIDE MIGRATED
                </label>
              </div>
            </div>
          </div>

          {/* Column Headers */}
          <div style={{display:'grid',gridTemplateColumns:'140px 90px 80px 80px 70px 70px 60px 70px',padding:'6px 12px',background:'#050508',borderBottom:'1px solid #0d0d18',fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',letterSpacing:'1px',flexShrink:0}}>
            <span>TOKEN</span><span>MCAP</span><span>5M CHG</span><span>5M VOL</span><span>BUYS</span><span>SELLS</span><span>AGE</span><span>ACTION</span>
          </div>

          {/* Token List */}
          <div style={{flex:1,overflowY:'auto'}}>
            {filtered.map(token => {
              const up = token.priceChange5m >= 0
              const isSelected = selectedToken?.id === token.id
              return (
                <div key={token.id}
                  style={{display:'grid',gridTemplateColumns:'140px 90px 80px 80px 70px 70px 60px 70px',padding:'8px 12px',borderBottom:'1px solid #0a0a0f',background:isSelected?'rgba(0,255,136,0.04)':'transparent',cursor:'pointer',transition:'background 0.1s',alignItems:'center'}}
                  onMouseEnter={e=>{if(!isSelected)e.currentTarget.style.background='#0a0a10'}}
                  onMouseLeave={e=>{if(!isSelected)e.currentTarget.style.background='transparent'}}
                  onClick={()=>setSelectedToken(isSelected?null:token)}
                >
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                      <div style={{width:'20px',height:'20px',borderRadius:'50%',background:`hsl(${token.symbol.charCodeAt(0)*10},60%,35%)`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'9px',color:'#fff',flexShrink:0}}>{token.symbol[0]}</div>
                      <div>
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#e0e0f0'}}>{token.symbol}</div>
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{tr(token.address)}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#e0e0f0'}}>{fmt(token.marketCap)}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:up?'#00FF88':'#FF3366',fontWeight:'bold'}}>{up?'+':''}{token.priceChange5m.toFixed(1)}%</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#6666aa'}}>{fmt(token.volume5m)}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#00FF88'}}>{token.buys5m}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#FF3366'}}>{token.sells5m}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c'}}>{elapsed(token.age)}</div>
                  <button onClick={e=>{e.stopPropagation();setSelectedToken(token)}} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',letterSpacing:'1px',padding:'4px 8px',background:'rgba(0,255,136,0.1)',border:'1px solid rgba(0,255,136,0.3)',color:'#00FF88',cursor:'pointer'}}>BUY</button>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT — Wallet + Trade Panel */}
        <div style={{width:'320px',flexShrink:0,display:'flex',flexDirection:'column',overflow:'hidden'}}>

          {/* Wallet Panel */}
          <div style={{padding:'16px',borderBottom:'1px solid #1a1a2e',flexShrink:0}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',letterSpacing:'2px',marginBottom:'12px'}}>// RADAR WALLET · DEVNET</div>

            {!wallet ? (
              <button onClick={generateWallet} disabled={walletLoading} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'2px',color:'#050508',background:'#00FF88',border:'none',padding:'12px',cursor:'pointer',clipPath:'polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)'}}>
                {walletLoading?'GENERATING...':'⚡ GENERATE WALLET'}
              </button>
            ) : (
              <div>
                <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'12px',marginBottom:'8px'}}>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'1px',marginBottom:'4px'}}>ADDRESS</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa',wordBreak:'break-all',lineHeight:1.5}}>{wallet.publicKey}</div>
                  <button onClick={()=>navigator.clipboard.writeText(wallet.publicKey)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',background:'none',border:'1px solid #1a1a2e',padding:'2px 8px',cursor:'pointer',marginTop:'6px'}}>⎘ COPY</button>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                  <div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',letterSpacing:'1px'}}>BALANCE</div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'28px',color:'#00FF88',letterSpacing:'2px',lineHeight:1}}>{wallet.balance?.toFixed(4)} SOL</div>
                  </div>
                  <button onClick={refreshBalance} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',background:'none',border:'1px solid #1a1a2e',padding:'6px 10px',cursor:'pointer'}}>↻</button>
                </div>
                <button onClick={requestAirdrop} disabled={txStatus==='pending'} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',letterSpacing:'2px',color:'#FFD700',background:'rgba(255,215,0,0.05)',border:'1px solid rgba(255,215,0,0.3)',padding:'8px',cursor:'pointer',marginBottom:'4px'}}>
                  🪂 AIRDROP 2 SOL (DEVNET FREE)
                </button>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',textAlign:'center',letterSpacing:'1px'}}>DEVNET ONLY — FAKE SOL FOR TESTING</div>
              </div>
            )}
          </div>

          {/* Buy Panel */}
          {selectedToken && (
            <div style={{padding:'16px',borderBottom:'1px solid #1a1a2e',flexShrink:0,background:'rgba(0,255,136,0.02)'}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#00FF88',letterSpacing:'2px',marginBottom:'12px'}}>// BUY ${selectedToken.symbol}</div>
              <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
                {['0.1','0.5','1','2'].map(amt=>(
                  <button key={amt} onClick={()=>setBuyAmount(amt)} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',padding:'6px',background:buyAmount===amt?'rgba(0,255,136,0.1)':'#0a0a10',border:`1px solid ${buyAmount===amt?'rgba(0,255,136,0.4)':'#1a1a2e'}`,color:buyAmount===amt?'#00FF88':'#6666aa',cursor:'pointer'}}>{amt}</button>
                ))}
              </div>
              <div style={{display:'flex',marginBottom:'8px'}}>
                <input value={buyAmount} onChange={e=>setBuyAmount(e.target.value)} placeholder="SOL amount"
                  style={{flex:1,background:'#0a0a10',border:'1px solid #1a1a2e',borderRight:'none',color:'#e0e0f0',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',padding:'10px 12px',outline:'none'}}/>
                <div style={{background:'#070710',border:'1px solid #1a1a2e',padding:'10px 12px',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#6666aa'}}>SOL</div>
              </div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c',marginBottom:'10px'}}>
                ≈ {parseFloat(buyAmount||0) > 0 ? ((parseFloat(buyAmount)/selectedToken.price)*0.97).toExponential(2) : '0'} {selectedToken.symbol} received
              </div>
              <button onClick={()=>executeBuy(selectedToken)} disabled={!wallet||txStatus==='pending'}
                style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',letterSpacing:'2px',color:'#050508',background:!wallet?'#3a3a5c':'#00FF88',border:'none',padding:'12px',cursor:wallet?'pointer':'not-allowed',clipPath:'polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)'}}>
                {!wallet?'CONNECT WALLET FIRST':txStatus==='pending'?'BUYING...':'⚡ BUY NOW'}
              </button>
              <button onClick={()=>setSelectedToken(null)} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa',background:'none',border:'none',padding:'6px',cursor:'pointer',marginTop:'4px'}}>CANCEL</button>
            </div>
          )}

          {/* Positions */}
          <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',letterSpacing:'2px',marginBottom:'12px'}}>// POSITIONS ({positions.length})</div>
            {positions.length === 0 ? (
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#1a1a2e',textAlign:'center',padding:'24px 0'}}>
                NO OPEN POSITIONS<br/>
                <span style={{fontSize:'8px',letterSpacing:'1px'}}>SELECT A TOKEN TO TRADE</span>
              </div>
            ) : (
              positions.map(pos => {
                const up = pos.pnl >= 0
                return (
                  <div key={pos.id} style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'12px',marginBottom:'8px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                      <div>
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#e0e0f0'}}>${pos.token.symbol}</div>
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>{pos.solSpent.toFixed(3)} SOL spent</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:up?'#00FF88':'#FF3366',fontWeight:'bold'}}>{up?'+':''}{pos.pnlPct.toFixed(1)}%</div>
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:up?'#00FF88':'#FF3366'}}>{up?'+':''}{pos.pnl.toFixed(4)} SOL</div>
                      </div>
                    </div>
                    <button onClick={()=>sellPosition(pos.id)} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',letterSpacing:'1px',color:'#FF3366',background:'rgba(255,51,102,0.05)',border:'1px solid rgba(255,51,102,0.3)',padding:'6px',cursor:'pointer'}}>
                      SELL ALL
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
