// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'

export default function Sidebar({ active = '' }) {
  const [expanded, setExpanded] = useState(false)
  const [wallet, setWallet] = useState(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('trench_wallet')
    if (saved) setWallet(saved)
  }, [])

  const connect = async () => {
    setConnecting(true)
    try {
      const p = window?.phantom?.solana ?? window?.solana
      if (!p?.isPhantom) { window.open('https://phantom.app/', '_blank'); setConnecting(false); return }
      const r = await p.connect()
      setWallet(r.publicKey.toString())
      localStorage.setItem('trench_wallet', r.publicKey.toString())
    } catch {}
    setConnecting(false)
  }

  const disconnect = async () => {
    try { const p = window?.phantom?.solana ?? window?.solana; if (p) await p.disconnect() } catch {}
    setWallet(null); localStorage.removeItem('trench_wallet')
  }

  const tr = (a) => a ? `${a.slice(0,4)}...${a.slice(-4)}` : ''

  const NAV = [
    { href:'/radar', label:'Radar', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 010 8.49M7.76 16.24a6 6 0 010-8.49M19.07 4.93a10 10 0 010 14.14M4.93 19.07a10 10 0 010-14.14"/></svg> },
    { href:'/pnl', label:'PNL', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
    { href:'/portfolio', label:'Portfolio', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg> },
    { href:'/perps', label:'Perps', divider:'TRADING', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
    { href:'/', label:'Rooms', divider:'COMMUNITY', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> },
    { href:'/tracker', label:'Tracker', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
    { href:'/leaderboard', label:'Leaderboard', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg> },
    { href:'/token', label:'\$TRENCH', divider:'TOKEN', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg> },
  ]

  const isActive = (href) => {
    if (typeof window === 'undefined') return active === href
    return active === href || window.location.pathname === href
  }

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        position:'fixed',top:0,left:0,bottom:0,
        width:expanded?'220px':'60px',
        transition:'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        background:'linear-gradient(180deg,#0d0e13 0%,#090a0e 100%)',
        borderRight:'1px solid rgba(255,255,255,0.045)',
        display:'flex',flexDirection:'column',
        zIndex:1000,overflow:'hidden',
        boxShadow:expanded?'0 0 0 1px rgba(0,255,136,0.04),4px 0 32px rgba(0,0,0,0.6)':'none',
      }}
    >
      <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:0,backgroundImage:'linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)',backgroundSize:'20px 20px',maskImage:'linear-gradient(180deg,transparent,rgba(0,0,0,0.4) 30%,rgba(0,0,0,0.4) 70%,transparent)'}}/>
      <a href="/" style={{display:'flex',alignItems:'center',gap:'11px',padding:'0 14px',height:'60px',textDecoration:'none',flexShrink:0,borderBottom:'1px solid rgba(255,255,255,0.04)',position:'relative',zIndex:1,overflow:'hidden'}}>
        <div style={{width:'32px',height:'32px',borderRadius:'9px',flexShrink:0,background:'linear-gradient(135deg,#00ff88 0%,#00e67a 40%,#00bfff 100%)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:'800',color:'#000',boxShadow:'0 0 0 1px rgba(0,255,136,0.3),0 4px 16px rgba(0,255,136,0.25)',letterSpacing:'-0.5px',fontFamily:'system-ui,sans-serif'}}>T</div>
        <div style={{opacity:expanded?1:0,transform:`translateX(${expanded?0:-6}px)`,transition:'opacity 0.18s,transform 0.18s',overflow:'hidden',whiteSpace:'nowrap'}}>
          <div style={{fontSize:'15px',fontWeight:'700',color:'#fff',letterSpacing:'0.8px',lineHeight:1.1,fontFamily:"system-ui,-apple-system,sans-serif"}}>TRENCH</div>
          <div style={{fontSize:'9px',color:'rgba(0,255,136,0.5)',letterSpacing:'2.5px',marginTop:'1px',fontFamily:'monospace',fontWeight:'500'}}>TERMINAL</div>
        </div>
      </a>
      <div style={{flex:1,overflowY:'auto',overflowX:'hidden',padding:'10px 8px 8px',position:'relative',zIndex:1}}>
        {NAV.map((item) => {
          const act = isActive(item.href)
          return (
            <div key={item.href}>
              {item.divider&&(
                <div style={{height:expanded?'auto':0,overflow:'hidden',opacity:expanded?1:0,transition:'opacity 0.15s',padding:expanded?'12px 10px 4px':'0'}}>
                  <div style={{fontSize:'9px',fontWeight:'700',letterSpacing:'1.8px',color:'rgba(255,255,255,0.15)',fontFamily:'monospace'}}>{item.divider}</div>
                </div>
              )}
              <a href={item.href} style={{
                display:'flex',alignItems:'center',gap:'11px',height:'40px',padding:'0 10px',borderRadius:'8px',
                textDecoration:'none',justifyContent:expanded?'flex-start':'center',
                background:act?'linear-gradient(135deg,rgba(0,255,136,0.1) 0%,rgba(0,191,255,0.05) 100%)':'transparent',
                border:act?'1px solid rgba(0,255,136,0.12)':'1px solid transparent',
                color:act?'#00ff88':'rgba(255,255,255,0.38)',marginBottom:'2px',
                position:'relative',transition:'all 0.13s',overflow:'hidden',
              }}
              onMouseEnter={e=>{if(!act){e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.color='rgba(255,255,255,0.7)';e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'}}}
              onMouseLeave={e=>{if(!act){e.currentTarget.style.background='transparent';e.currentTarget.style.color='rgba(255,255,255,0.38)';e.currentTarget.style.borderColor='transparent'}}}
              >
                {act&&<div style={{position:'absolute',left:0,top:'25%',bottom:'25%',width:'2.5px',background:'linear-gradient(180deg,#00ff88,#00bfff)',borderRadius:'0 2px 2px 0'}}/>}
                <span style={{display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,width:'18px'}}>{item.icon}</span>
                <span style={{fontSize:'13px',fontWeight:act?'600':'400',whiteSpace:'nowrap',opacity:expanded?1:0,transform:`translateX(${expanded?0:-6}px)`,transition:'opacity 0.14s,transform 0.14s',letterSpacing:'0.1px',fontFamily:"system-ui,-apple-system,sans-serif"}}>{item.label}</span>
                {act&&expanded&&<div style={{marginLeft:'auto',width:'5px',height:'5px',borderRadius:'50%',background:'#00ff88',boxShadow:'0 0 8px #00ff88,0 0 16px rgba(0,255,136,0.4)'}}/>}
              </a>
            </div>
          )
        })}
      </div>
      <div style={{borderTop:'1px solid rgba(255,255,255,0.04)',padding:'10px 8px 12px',display:'flex',flexDirection:'column',gap:'5px',position:'relative',zIndex:1}}>
        <button style={{display:'flex',alignItems:'center',gap:'11px',height:'38px',padding:'0 10px',borderRadius:'8px',background:'transparent',border:'1px solid rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.35)',cursor:'pointer',width:'100%',justifyContent:expanded?'flex-start':'center',transition:'all 0.13s'}}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.05)';e.currentTarget.style.color='rgba(255,255,255,0.65)';e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'}}
          onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='rgba(255,255,255,0.35)';e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'}}>
          <span style={{display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,width:'18px'}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
          <span style={{fontSize:'13px',fontWeight:'500',whiteSpace:'nowrap',opacity:expanded?1:0,transform:`translateX(${expanded?0:-6}px)`,transition:'opacity 0.14s,transform 0.14s',fontFamily:"system-ui,sans-serif"}}>Log In</span>
        </button>
        {wallet ? (
          <button onClick={disconnect} style={{display:'flex',alignItems:'center',gap:'11px',height:'38px',padding:'0 10px',borderRadius:'8px',background:'rgba(0,255,136,0.06)',border:'1px solid rgba(0,255,136,0.15)',cursor:'pointer',width:'100%',justifyContent:expanded?'flex-start':'center',transition:'all 0.13s'}}>
            <div style={{width:'8px',height:'8px',borderRadius:'50%',flexShrink:0,background:'#00ff88',boxShadow:'0 0 0 2px rgba(0,255,136,0.2),0 0 10px rgba(0,255,136,0.5)'}}/>
            <span style={{fontSize:'11px',color:'#00ff88',fontFamily:'monospace',whiteSpace:'nowrap',opacity:expanded?1:0,transform:`translateX(${expanded?0:-6}px)`,transition:'opacity 0.14s,transform 0.14s'}}>{tr(wallet)}</span>
          </button>
        ) : (
          <button onClick={connect} disabled={connecting} style={{display:'flex',alignItems:'center',gap:'11px',height:'38px',padding:'0 10px',borderRadius:'8px',background:expanded?'linear-gradient(135deg,#00ff88 0%,#00cc6a 100%)':'rgba(0,255,136,0.08)',border:'1px solid rgba(0,255,136,0.25)',color:expanded?'#000':'#00ff88',cursor:'pointer',width:'100%',justifyContent:expanded?'flex-start':'center',transition:'all 0.18s',boxShadow:expanded?'0 4px 20px rgba(0,255,136,0.2)':'none',fontWeight:expanded?'700':'400'}}>
            <span style={{display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,width:'18px'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></span>
            <span style={{fontSize:'13px',fontWeight:'700',whiteSpace:'nowrap',opacity:expanded?1:0,transform:`translateX(${expanded?0:-6}px)`,transition:'opacity 0.14s,transform 0.14s',fontFamily:"system-ui,sans-serif"}}>{connecting?'Connecting...':'Connect Wallet'}</span>
          </button>
        )}
      </div>
    </div>
  )
}
