// @ts-nocheck
'use client'
import { useEffect, useState } from 'react'

export default function WelcomePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setTimeout(() => setMounted(true), 50) }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#09090e',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
      }}/>

      {/* Green radial glow top */}
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '800px', height: '500px', background: 'radial-gradient(ellipse, rgba(0,255,136,0.07) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }}/>

      {/* Subtle bottom glow */}
      <div style={{ position: 'absolute', bottom: '-10%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '300px', background: 'radial-gradient(ellipse, rgba(77,159,255,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }}/>

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
        textAlign: 'center',
        padding: '0 24px',
        maxWidth: '640px',
      }}>
        {/* Logo */}
        <div style={{
          width: '64px', height: '64px', borderRadius: '18px',
          background: 'linear-gradient(135deg, #00ff88 0%, #00e07a 40%, #00bfff 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '28px', fontWeight: '900', color: '#000',
          marginBottom: '28px',
          boxShadow: '0 0 0 1px rgba(0,255,136,0.3), 0 8px 32px rgba(0,255,136,0.2), 0 0 80px rgba(0,255,136,0.08)',
          letterSpacing: '-1px',
        }}>T</div>

        {/* Eyebrow */}
        <div style={{
          fontSize: '11px', fontWeight: '600', letterSpacing: '3px',
          color: 'rgba(0,255,136,0.6)', marginBottom: '16px',
          fontFamily: 'monospace', textTransform: 'uppercase',
        }}>Welcome to Trench</div>

        {/* Headline */}
        <h1 style={{
          fontSize: '52px', fontWeight: '800', color: '#fff',
          margin: '0 0 20px', letterSpacing: '-2px', lineHeight: 1.05,
        }}>
          The Trenches,{' '}
          <span style={{
            background: 'linear-gradient(135deg, #00ff88, #00bfff)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Upgraded.</span>
        </h1>

        {/* Subhead */}
        <p style={{
          fontSize: '17px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6,
          margin: '0 0 40px', maxWidth: '480px',
          fontWeight: '400',
        }}>
          Real-time memecoin pulse feed, PNL tracking, portfolio management, and paper trading — all in one terminal.
        </p>

        {/* Stats row */}
        <div style={{
          display: 'flex', gap: '32px', marginBottom: '44px',
          padding: '16px 28px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '14px',
          backdropFilter: 'blur(12px)',
        }}>
          {[['Live Pairs', '1,000+'], ['Chains', 'Solana'], ['Data', 'Real-time']].map(([l, v]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: '4px' }}>{v}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.5px' }}>{l}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <a href="/radar" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '14px 32px',
            background: 'linear-gradient(135deg, #00ff88, #00cc6a)',
            border: 'none', color: '#000',
            fontSize: '15px', fontWeight: '700',
            textDecoration: 'none', borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(0,255,136,0.25), 0 0 0 1px rgba(0,255,136,0.3)',
            letterSpacing: '0.2px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 32px rgba(0,255,136,0.4), 0 0 0 1px rgba(0,255,136,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,255,136,0.25), 0 0 0 1px rgba(0,255,136,0.3)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            Enter Platform
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
          <a href="#" style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            padding: '14px 24px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '14px', fontWeight: '500',
            textDecoration: 'none', borderRadius: '12px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
          >Learn more</a>
        </div>

        {/* Footer note */}
        <div style={{ marginTop: '48px', fontSize: '12px', color: 'rgba(255,255,255,0.18)', letterSpacing: '0.3px' }}>
          Built for degens. Powered by Solana. ⚡
        </div>
      </div>

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
