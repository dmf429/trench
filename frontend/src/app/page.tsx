'use client'
import { useState } from 'react'

export default function HomePage() {
  const [email, setEmail] = useState('')
  const [joined, setJoined] = useState(false)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050508',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      padding: '40px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Grid background */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(0,255,136,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.04) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
      }} />

      {/* Logo */}
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 'clamp(80px, 15vw, 140px)',
        letterSpacing: '16px',
        color: '#00FF88',
        textShadow: '0 0 40px rgba(0,255,136,0.6), 0 0 80px rgba(0,255,136,0.3)',
        lineHeight: 1,
        position: 'relative',
        zIndex: 1,
        marginBottom: '8px',
      }}>
        TRENCH
      </div>

      {/* Tagline */}
      <div style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '12px',
        letterSpacing: '6px',
        color: 'rgba(0,255,136,0.5)',
        textTransform: 'uppercase',
        marginBottom: '40px',
        position: 'relative',
        zIndex: 1,
      }}>
        The Trenches, Upgraded
      </div>

      {/* Description */}
      <div style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '13px',
        color: '#6666aa',
        textAlign: 'center',
        maxWidth: '480px',
        lineHeight: 1.8,
        marginBottom: '48px',
        position: 'relative',
        zIndex: 1,
        letterSpacing: '1px',
      }}>
        One platform. Every coin. Real-time KOL tracking.<br />
        25% sell alerts. On-chain truth. Built for degens.
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        gap: '40px',
        marginBottom: '48px',
        position: 'relative',
        zIndex: 1,
      }}>
        {[
          { val: '24,891', label: 'Active Rooms' },
          { val: '340+', label: 'KOLs Tracked' },
          { val: '<3s', label: 'Alert Speed' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '36px', color: '#00FF88', letterSpacing: '2px', textShadow: '0 0 16px rgba(0,255,136,0.4)' }}>{s.val}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '2px', color: '#3a3a5c', textTransform: 'uppercase', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Waitlist */}
      <div style={{ display: 'flex', gap: 0, maxWidth: '420px', width: '100%', position: 'relative', zIndex: 1 }}>
        <input
          type="text"
          placeholder="Wallet address or email..."
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{
            flex: 1,
            background: '#0a0a10',
            border: '1px solid #1a1a2e',
            borderRight: 'none',
            color: '#e0e0f0',
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '12px',
            padding: '14px 18px',
            outline: 'none',
            letterSpacing: '1px',
          }}
        />
        <button
          onClick={() => { if (email.trim()) setJoined(true) }}
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '11px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#050508',
            background: joined ? '#00ffaa' : '#00FF88',
            border: 'none',
            padding: '14px 24px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
          }}
        >
          {joined ? '✓ YOU\'RE IN' : 'JOIN WAITLIST'}
        </button>
      </div>

      <div style={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '9px',
        color: '#3a3a5c',
        letterSpacing: '2px',
        marginTop: '12px',
        position: 'relative',
        zIndex: 1,
      }}>
        // 847 SPOTS REMAINING · NO SPAM · EVER
      </div>

      {/* Bottom ticker */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: '32px',
        background: 'rgba(10,10,16,0.9)',
        borderTop: '1px solid #1a1a2e',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        zIndex: 10,
      }}>
        <div style={{
          display: 'flex',
          gap: '48px',
          animation: 'ticker 25s linear infinite',
          whiteSpace: 'nowrap',
          padding: '0 24px',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '10px',
        }}>
          {['$WIF ▲ +67% · 8 KOLs', '$BONK ▼ -12% · 3 exited', '$POPCAT ▲ +431% · 19 KOLs', '⚠ KOL sold 47% · 3s ago', '$MOODENG ▲ +189% · 14 KOLs', '$GOAT ▼ -34% · 7 exited', '$FWOG ▲ +92% · 11 KOLs'].map((t, i) => (
            <span key={i} style={{ color: t.includes('▲') ? '#00FF88' : t.includes('▼') ? '#ff3366' : t.includes('⚠') ? '#ffd700' : '#6666aa', flexShrink: 0 }}>{t}</span>
          ))}
        </div>
        <style>{`@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      </div>
    </div>
  )
}
