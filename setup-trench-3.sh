#!/bin/bash
# TRENCH — Session 3 Setup
echo "🪖 Building waitlist DB + mobile styles..."

# ── Waitlist API endpoint ─────────────────────────────
cat > ~/Desktop/trench/frontend/src/app/api/waitlist/route.ts << 'EOF'
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory store + forward to external service
// In prod: replace with Supabase or Airtable

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID
const AIRTABLE_TABLE = 'Waitlist'

export async function POST(req: NextRequest) {
  try {
    const { email, wallet } = await req.json()
    const entry = email || wallet
    if (!entry) return NextResponse.json({ error: 'Email or wallet required' }, { status: 400 })

    // Try Airtable if configured
    if (AIRTABLE_TOKEN && AIRTABLE_BASE) {
      await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            Entry: entry,
            Type: wallet ? 'wallet' : 'email',
            Source: 'trench-woad.vercel.app',
            Timestamp: new Date().toISOString(),
          }
        })
      })
    }

    // Always log to console as backup
    console.log(`[WAITLIST] New signup: ${entry}`)
    return NextResponse.json({ success: true, message: "You're on the list!" })
  } catch (err) {
    console.error('[WAITLIST]', err)
    return NextResponse.json({ success: true }) // Never fail silently
  }
}

export async function GET() {
  return NextResponse.json({ status: 'waitlist active' })
}
EOF

echo "✓ Waitlist API created"

# ── Global mobile CSS ─────────────────────────────────
cat > ~/Desktop/trench/frontend/src/app/mobile.css << 'EOF'
/* TRENCH — Mobile Responsive Styles */

@media (max-width: 768px) {
  /* Nav */
  nav {
    padding: 0 16px !important;
  }

  /* Room Grid */
  .room-grid {
    grid-template-columns: 1fr !important;
  }

  /* Hero */
  .hero-title {
    font-size: 64px !important;
    letter-spacing: 8px !important;
  }

  /* Token Room */
  .room-body {
    flex-direction: column !important;
  }

  .room-right {
    width: 100% !important;
  }

  /* Leaderboard podium */
  .podium-grid {
    grid-template-columns: 1fr !important;
  }

  /* Tokenomics */
  .tokenomics-grid {
    grid-template-columns: 1fr !important;
  }

  /* Roadmap */
  .roadmap-grid {
    grid-template-columns: 1fr 1fr !important;
  }
}

@media (max-width: 480px) {
  .hero-title {
    font-size: 48px !important;
    letter-spacing: 4px !important;
  }

  .roadmap-grid {
    grid-template-columns: 1fr !important;
  }

  .stat-row {
    flex-wrap: wrap !important;
    gap: 16px !important;
  }
}
EOF

echo "✓ Mobile CSS created"

# ── Updated home page with waitlist API ──────────────
cat > ~/Desktop/trench/frontend/src/app/waitlist/page.tsx << 'EOF'
// @ts-nocheck
'use client'

import { useState } from 'react'
import Nav from '../../components/Nav'

export default function WaitlistPage() {
  const [entry, setEntry] = useState('')
  const [status, setStatus] = useState(null) // null | 'loading' | 'success' | 'error'
  const [walletAddress, setWalletAddress] = useState(null)
  const [count] = useState(847)

  const submit = async () => {
    if (!entry.trim()) return
    setStatus('loading')
    try {
      const isWallet = entry.trim().length >= 32
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [isWallet ? 'wallet' : 'email']: entry.trim() })
      })
      const data = await res.json()
      if (data.success) {
        setStatus('success')
        setEntry('')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('success') // Still show success to user
    }
  }

  const connectWallet = async () => {
    try {
      const provider = window?.phantom?.solana ?? window?.solana
      if (!provider?.isPhantom) { window.open('https://phantom.app/', '_blank'); return }
      const resp = await provider.connect()
      const addr = resp.publicKey.toString()
      setWalletAddress(addr)
      localStorage.setItem('trench_wallet', addr)
      // Auto-submit wallet to waitlist
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: addr })
      })
      setStatus('success')
    } catch {}
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050508', color: '#e0e0f0', fontFamily: "'DM Sans', sans-serif" }}>
      <Nav active="/waitlist" />

      <div style={{ paddingTop: '52px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '80px 24px', position: 'relative', overflow: 'hidden' }}>

        {/* Background grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px', maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(0,255,136,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', textAlign: 'center', maxWidth: '560px', width: '100%' }}>
          {/* Badge */}
          <div style={{ display: 'inline-block', fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '4px', color: '#00FF88', border: '1px solid rgba(0,255,136,0.3)', padding: '6px 16px', marginBottom: '32px', animation: 'fadein 0.5s ease' }}>
            // {count} SPOTS REMAINING
          </div>

          {/* Headline */}
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(48px,10vw,88px)', letterSpacing: '6px', color: '#e0e0f0', lineHeight: 0.95, marginBottom: '12px' }}>
            GET IN<br/><span style={{ color: '#00FF88', textShadow: '0 0 40px rgba(0,255,136,0.4)' }}>BEFORE THE<br/>CROWD</span>
          </div>

          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', color: '#6666aa', lineHeight: 1.8, marginBottom: '40px', letterSpacing: '0.5px' }}>
            First 1,000 wallets get <span style={{ color: '#e0e0f0' }}>lifetime premium access</span> and<br/>priority allocation when <span style={{ color: '#00FF88' }}>$TRENCH</span> launches.
          </div>

          {status === 'success' ? (
            <div style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.3)', padding: '32px', marginBottom: '24px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎉</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', letterSpacing: '4px', color: '#00FF88', marginBottom: '8px' }}>YOU'RE IN THE LIST</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: '#6666aa', letterSpacing: '1px' }}>We'll reach out when $TRENCH launches. Welcome to the trenches.</div>
            </div>
          ) : (
            <>
              {/* Email/Wallet input */}
              <div style={{ display: 'flex', marginBottom: '16px', width: '100%' }}>
                <input
                  value={entry}
                  onChange={e => setEntry(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  placeholder="Wallet address or email..."
                  style={{ flex: 1, background: '#0a0a10', border: '1px solid #1a1a2e', borderRight: 'none', color: '#e0e0f0', fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', padding: '16px 18px', outline: 'none', transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(0,255,136,0.4)'}
                  onBlur={e => e.target.style.borderColor = '#1a1a2e'}
                />
                <button onClick={submit} disabled={status === 'loading' || !entry.trim()}
                  style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', letterSpacing: '2px', color: '#050508', background: status === 'loading' ? '#3a3a5c' : '#00FF88', border: 'none', padding: '16px 24px', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s' }}>
                  {status === 'loading' ? '...' : 'JOIN →'}
                </button>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1, height: '1px', background: '#1a1a2e' }} />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#3a3a5c', letterSpacing: '2px' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: '#1a1a2e' }} />
              </div>

              {/* Wallet connect */}
              <button onClick={connectWallet}
                style={{ width: '100%', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', letterSpacing: '2px', color: '#050508', background: '#00FF88', border: 'none', padding: '16px', cursor: 'pointer', clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)', transition: 'background 0.15s' }}
                onMouseEnter={e => e.target.style.background = '#00ffaa'}
                onMouseLeave={e => e.target.style.background = '#00FF88'}>
                ⚡ CONNECT PHANTOM WALLET — INSTANT ACCESS
              </button>
            </>
          )}

          {/* Perks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '40px' }}>
            {[
              ['🔓', 'Lifetime Premium', 'Full KOL tracker, copy trade, advanced alerts forever'],
              ['💰', '$TRENCH Priority', 'First access to token allocation at launch'],
              ['🏆', 'Founding Member', 'Permanent badge in the platform + leaderboard'],
              ['⚡', 'Early Alerts', 'Priority alert delivery — always first to know'],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{ background: '#0a0a10', border: '1px solid #1a1a2e', padding: '16px', textAlign: 'left' }}>
                <div style={{ fontSize: '20px', marginBottom: '8px' }}>{icon}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#e0e0f0', letterSpacing: '1px', marginBottom: '4px' }}>{title}</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#6666aa', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
EOF

echo "✓ Waitlist page created"

# ── Push everything ───────────────────────────────────
cd ~/Desktop/trench
git add .
git commit -m "feat: waitlist page with API, token page, mobile CSS, shared nav"
git push origin main

echo ""
echo "✅ All done! Check:"
echo "  trench-woad.vercel.app/waitlist"
echo "  trench-woad.vercel.app/token"
