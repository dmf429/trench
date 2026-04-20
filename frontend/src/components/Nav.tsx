// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'

export default function Nav({ active = '' }) {
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
      if (!p?.isPhantom) { window.open('https://phantom.app/','_blank'); setConnecting(false); return }
      const r = await p.connect()
      const addr = r.publicKey.toString()
      setWallet(addr); localStorage.setItem('trench_wallet', addr)
    } catch {}
    setConnecting(false)
  }

  const disconnect = async () => {
    try { const p = window?.phantom?.solana ?? window?.solana; if (p) await p.disconnect() } catch {}
    setWallet(null); localStorage.removeItem('trench_wallet')
  }

  const tr = (a) => a ? `${a.slice(0,4)}...${a.slice(-4)}` : ''
  const links = [['/', 'ROOMS'],['/tracker','TRACKER'],['/leaderboard','LEADERBOARD'],['/pnl','PNL'],['/portfolio','PORTFOLIO'],['/perps','PERPS'],['/token','$TRENCH'],['/radar','📡 RADAR']]

  return (
    <nav style={{position:'fixed',top:0,left:0,right:0,zIndex:1000,height:'52px',background:'rgba(5,5,8,0.97)',borderBottom:'1px solid #1a1a2e',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px'}}>
      <a href="/" style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'22px',letterSpacing:'4px',color:'#00FF88',textDecoration:'none',textShadow:'0 0 16px rgba(0,255,136,0.4)',flexShrink:0}}>TRENCH</a>
      <div style={{display:'flex',gap:'24px',position:'absolute',left:'50%',transform:'translateX(-50%)'}}>
        {links.map(([href,label]) => (
          <a key={href} href={href} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'2px',color:active===href?'#00FF88':'#6666aa',textDecoration:'none',borderBottom:active===href?'1px solid #00FF88':'1px solid transparent',paddingBottom:'2px'}}>{label}</a>
        ))}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
        {wallet ? (
          <div onClick={disconnect} title="Click to disconnect" style={{display:'flex',alignItems:'center',gap:'6px',background:'rgba(0,255,136,0.05)',border:'1px solid rgba(0,255,136,0.2)',padding:'5px 10px',cursor:'pointer'}}>
            <div style={{width:'5px',height:'5px',borderRadius:'50%',background:'#00FF88',animation:'np 2s infinite'}}/>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#00FF88',letterSpacing:'1px'}}>{tr(wallet)}</span>
          </div>
        ) : (
          <button onClick={connect} disabled={connecting} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',letterSpacing:'2px',color:'#050508',background:connecting?'#3a3a5c':'#00FF88',border:'none',padding:'7px 14px',cursor:'pointer',clipPath:'polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)',whiteSpace:'nowrap'}}>
            {connecting?'...':'⚡ CONNECT'}
          </button>
        )}
      </div>
      <style>{`@keyframes np{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </nav>
  )
}
