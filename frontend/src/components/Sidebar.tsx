// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'

const C = {
  bg:      '#0a0b10',
  bg2:     '#0f1117',
  bg3:     '#161b24',
  bg4:     '#1c2230',
  text1:   '#ffffff',
  text2:   'rgba(255,255,255,0.45)',
  text3:   'rgba(255,255,255,0.2)',
  accent:  '#00ff88',
  border:  'rgba(255,255,255,0.06)',
  border2: 'rgba(255,255,255,0.1)',
}

const NAV_ITEMS = [
  { href: '/radar',       icon: '📡', label: 'Radar',       section: null },
  { href: '/pnl',         icon: '📊', label: 'PNL',         section: null },
  { href: '/portfolio',   icon: '◎',  label: 'Portfolio',   section: null },
  { href: '/perps',       icon: '⚡', label: 'Perps',       section: null },
  { href: '/',            icon: '💬', label: 'Rooms',       section: 'SOCIAL' },
  { href: '/tracker',     icon: '🔍', label: 'Tracker',     section: null },
  { href: '/leaderboard', icon: '🏆', label: 'Leaderboard', section: null },
  { href: '/token',       icon: '🟢', label: '$TRENCH',     section: 'TOKEN' },
]

export default function Sidebar({ active = '' }) {
  const [expanded, setExpanded] = useState(false)
  const [wallet, setWallet] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [path, setPath] = useState('')

  useEffect(() => {
    setPath(window.location.pathname)
    const saved = localStorage.getItem('trench_wallet')
    if (saved) setWallet(saved)
  }, [])

  const connect = async () => {
    setConnecting(true)
    try {
      const p = window?.phantom?.solana ?? window?.solana
      if (!p?.isPhantom) { window.open('https://phantom.app/', '_blank'); setConnecting(false); return }
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
  const isActive = (href) => active === href || path === href

  const W = expanded ? 220 : 60

  return (
    <>
      {/* Sidebar */}
      <div
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          width: W + 'px',
          background: C.bg2,
          borderRight: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
          boxShadow: expanded ? '4px 0 24px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {/* Logo */}
        <a href="/" style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '0 16px', height: '64px',
          textDecoration: 'none', flexShrink: 0,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
            background: 'linear-gradient(135deg, #00ff88, #00cc6a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: '900', color: '#000',
            boxShadow: '0 0 16px rgba(0,255,136,0.4)',
          }}>T</div>
          {expanded && (
            <span style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '22px', letterSpacing: '3px', color: C.text1,
              whiteSpace: 'nowrap', opacity: expanded ? 1 : 0,
              transition: 'opacity 0.15s',
            }}>TRENCH</span>
          )}
        </a>

        {/* Nav items */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
          {(() => {
            const items = []
            let lastSection = undefined
            NAV_ITEMS.forEach(item => {
              if (item.section !== lastSection && item.section !== null && expanded) {
                items.push(
                  <div key={'s_'+item.section} style={{
                    padding: '12px 16px 4px',
                    fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px',
                    color: C.text3, whiteSpace: 'nowrap',
                    fontFamily: "-apple-system,sans-serif",
                  }}>{item.section}</div>
                )
              }
              lastSection = item.section
              const act = isActive(item.href)
              items.push(
                <a key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: expanded ? '9px 16px' : '9px 0',
                  justifyContent: expanded ? 'flex-start' : 'center',
                  textDecoration: 'none',
                  background: act ? 'rgba(0,255,136,0.08)' : 'transparent',
                  borderLeft: `3px solid ${act ? C.accent : 'transparent'}`,
                  transition: 'all 0.1s',
                  margin: '1px 0',
                }}
                onMouseEnter={e => { if(!act) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if(!act) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{
                    fontSize: '16px', flexShrink: 0,
                    width: '32px', textAlign: 'center',
                    filter: act ? 'none' : 'grayscale(0.3)',
                  }}>{item.icon}</span>
                  {expanded && (
                    <span style={{
                      fontSize: '13px', fontWeight: act ? '600' : '400',
                      color: act ? C.accent : C.text2,
                      whiteSpace: 'nowrap',
                      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
                    }}>{item.label}</span>
                  )}
                  {act && expanded && (
                    <div style={{ marginLeft: 'auto', width: '5px', height: '5px', borderRadius: '50%', background: C.accent, boxShadow: `0 0 6px ${C.accent}` }}/>
                  )}
                </a>
              )
            })
            return items
          })()}
        </div>

        {/* Bottom: wallet + login */}
        <div style={{
          borderTop: `1px solid ${C.border}`,
          padding: '12px 8px', flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: '6px',
        }}>
          {/* Login button */}
          <button style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: expanded ? '8px 12px' : '8px 0',
            justifyContent: expanded ? 'flex-start' : 'center',
            background: 'transparent',
            border: `1px solid ${C.border2}`,
            borderRadius: '8px', cursor: 'pointer',
            width: '100%', transition: 'all 0.1s',
            color: C.text2,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = C.text1 }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text2 }}
          >
            <span style={{ fontSize: '16px', flexShrink: 0, width: '32px', textAlign: 'center' }}>👤</span>
            {expanded && <span style={{ fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap', fontFamily: "-apple-system,sans-serif" }}>Log In</span>}
          </button>

          {/* Connect wallet */}
          {wallet ? (
            <button onClick={disconnect} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: expanded ? '8px 12px' : '8px 0',
              justifyContent: expanded ? 'flex-start' : 'center',
              background: 'rgba(0,255,136,0.06)',
              border: `1px solid rgba(0,255,136,0.2)`,
              borderRadius: '8px', cursor: 'pointer',
              width: '100%', transition: 'all 0.1s',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.accent, boxShadow: `0 0 6px ${C.accent}`, flexShrink: 0, marginLeft: expanded ? 0 : 12 }}/>
              {expanded && <span style={{ fontSize: '11px', color: C.accent, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{tr(wallet)}</span>}
            </button>
          ) : (
            <button onClick={connect} disabled={connecting} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: expanded ? '8px 12px' : '8px 0',
              justifyContent: expanded ? 'flex-start' : 'center',
              background: expanded ? 'linear-gradient(135deg, #00ff88, #00cc6a)' : 'rgba(0,255,136,0.1)',
              border: `1px solid ${C.accent}44`,
              borderRadius: '8px', cursor: 'pointer',
              width: '100%', transition: 'all 0.2s',
              color: expanded ? '#000' : C.accent,
              boxShadow: expanded ? '0 0 16px rgba(0,255,136,0.25)' : 'none',
            }}>
              <span style={{ fontSize: '14px', flexShrink: 0, width: '32px', textAlign: 'center' }}>⚡</span>
              {expanded && <span style={{ fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap', fontFamily: "-apple-system,sans-serif" }}>{connecting ? 'Connecting...' : 'Connect Wallet'}</span>}
            </button>
          )}
        </div>
      </div>

      {/* Spacer so content doesn't go under sidebar */}
      <div style={{ width: '60px', flexShrink: 0 }}/>
    </>
  )
}
