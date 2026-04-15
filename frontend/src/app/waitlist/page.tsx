// @ts-nocheck
'use client'
import { useState } from 'react'
import Nav from '../../components/Nav'

export default function WaitlistPage() {
  const [entry, setEntry] = useState('')
  const [status, setStatus] = useState(null)

  const submit = async () => {
    if (!entry.trim()) return
    setStatus('loading')
    try {
      const isWallet = entry.trim().length >= 32
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({[isWallet?'wallet':'email']: entry.trim()})
      })
      setStatus('success')
      setEntry('')
    } catch { setStatus('success') }
  }

  const connectWallet = async () => {
    try {
      const p = window?.phantom?.solana ?? window?.solana
      if (!p?.isPhantom) { window.open('https://phantom.app/','_blank'); return }
      const r = await p.connect()
      const addr = r.publicKey.toString()
      localStorage.setItem('trench_wallet', addr)
      await fetch('/api/waitlist', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({wallet:addr})})
      setStatus('success')
    } catch {}
  }

  return (
    <div style={{minHeight:'100vh',background:'#050508',color:'#e0e0f0',fontFamily:"'DM Sans',sans-serif"}}>
      <Nav active="/waitlist"/>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',padding:'80px 24px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(0,255,136,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.03) 1px,transparent 1px)',backgroundSize:'60px 60px',maskImage:'radial-gradient(ellipse at center,black 40%,transparent 80%)'}}/>
        <div style={{position:'relative',textAlign:'center',maxWidth:'560px',width:'100%'}}>
          <div style={{display:'inline-block',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',letterSpacing:'4px',color:'#00FF88',border:'1px solid rgba(0,255,136,0.3)',padding:'6px 16px',marginBottom:'32px'}}>// 847 SPOTS REMAINING</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(48px,10vw,88px)',letterSpacing:'6px',lineHeight:0.95,marginBottom:'16px'}}>GET IN<br/><span style={{color:'#00FF88',textShadow:'0 0 40px rgba(0,255,136,0.4)'}}>BEFORE THE<br/>CROWD</span></div>
          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#6666aa',lineHeight:1.8,marginBottom:'40px'}}>
            First 1,000 wallets get <span style={{color:'#e0e0f0'}}>lifetime premium access</span> and priority allocation when <span style={{color:'#00FF88'}}>$TRENCH</span> launches.
          </div>

          {status === 'success' ? (
            <div style={{background:'rgba(0,255,136,0.05)',border:'1px solid rgba(0,255,136,0.3)',padding:'40px',marginBottom:'24px'}}>
              <div style={{fontSize:'40px',marginBottom:'12px'}}>🎉</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'32px',letterSpacing:'4px',color:'#00FF88',marginBottom:'8px'}}>YOU'RE IN THE LIST</div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#6666aa',letterSpacing:'1px'}}>We'll reach out when $TRENCH launches. Welcome to the trenches. 🪖</div>
            </div>
          ) : (
            <>
              <div style={{display:'flex',marginBottom:'16px'}}>
                <input value={entry} onChange={e=>setEntry(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()}
                  placeholder="Wallet address or email..."
                  style={{flex:1,background:'#0a0a10',border:'1px solid #1a1a2e',borderRight:'none',color:'#e0e0f0',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',padding:'16px 18px',outline:'none'}}/>
                <button onClick={submit} disabled={status==='loading'||!entry.trim()}
                  style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',letterSpacing:'2px',color:'#050508',background:status==='loading'?'#3a3a5c':'#00FF88',border:'none',padding:'16px 24px',cursor:'pointer',flexShrink:0}}>
                  {status==='loading'?'...':'JOIN →'}
                </button>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'16px'}}>
                <div style={{flex:1,height:'1px',background:'#1a1a2e'}}/>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',letterSpacing:'2px'}}>OR</span>
                <div style={{flex:1,height:'1px',background:'#1a1a2e'}}/>
              </div>
              <button onClick={connectWallet}
                style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',letterSpacing:'2px',color:'#050508',background:'#00FF88',border:'none',padding:'16px',cursor:'pointer',clipPath:'polygon(12px 0%,100% 0%,calc(100% - 12px) 100%,0% 100%)'}}>
                ⚡ CONNECT PHANTOM — INSTANT ACCESS
              </button>
            </>
          )}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'40px'}}>
            {[['🔓','Lifetime Premium','Full KOL tracker, copy trade, advanced alerts forever'],['💰','$TRENCH Priority','First access to token allocation at launch'],['🏆','Founding Member','Permanent badge on the platform + leaderboard'],['⚡','Early Alerts','Priority delivery — always first to know']].map(([icon,title,desc]) => (
              <div key={title} style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'16px',textAlign:'left'}}>
                <div style={{fontSize:'20px',marginBottom:'8px'}}>{icon}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#e0e0f0',letterSpacing:'1px',marginBottom:'4px'}}>{title}</div>
                <div style={{fontSize:'11px',color:'#6666aa',lineHeight:1.5}}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
