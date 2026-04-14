// @ts-nocheck
'use client'
import Nav from '../../components/Nav'

import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

const MOCK_LEADERBOARD = [
  { rank: 1, address: 'ANSMhFpT8RFkXpZGvohFc8EBvn6MRmAHMPT14CiUxRwM', displayName: 'Ansem', twitterHandle: 'blknoiz06', pnl7d: 84000, pnl30d: 420000, winRate: 68, totalTrades: 847, badge: 'top-caller' },
  { rank: 2, address: 'FnXBBsZRFjBdYX6YmSQQYXnmL2yZWcTDrPwEFGDGpump', displayName: 'DegenSpartan', twitterHandle: 'DegenSpartanAI', pnl7d: 42000, pnl30d: 210000, winRate: 63, totalTrades: 891, badge: 'whale' },
  { rank: 3, address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKH', displayName: 'Murad', twitterHandle: 'MustStopMurad', pnl7d: 54000, pnl30d: 280000, winRate: 61, totalTrades: 223, badge: 'kol' },
  { rank: 4, address: 'HVh6wHNBAsQDXVL42aCBB6R3UWrMBBV5sMfpbmZfDPQT', displayName: 'Hsaka', twitterHandle: 'HsakaTrades', pnl7d: 28000, pnl30d: 142000, winRate: 64, totalTrades: 634, badge: 'kol' },
  { rank: 5, address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', displayName: 'Cobie', twitterHandle: 'cobie', pnl7d: 31000, pnl30d: 190000, winRate: 72, totalTrades: 412, badge: 'top-caller' },
  { rank: 6, address: 'BVJNTRSMr1FdHDMCxSRCMNqnqwKMCnFHcYkCVxDEAyeW', displayName: 'Weremeow', twitterHandle: 'weremeow', pnl7d: 18000, pnl30d: 94000, winRate: 59, totalTrades: 2104, badge: null },
  { rank: 7, address: 'GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgj', displayName: 'KookiesMons', twitterHandle: 'KookiesMons', pnl7d: 8400, pnl30d: 62000, winRate: 55, totalTrades: 1204, badge: null },
]

const BADGES = {
  'top-caller': { label: '📈 TOP CALLER', color: '#FFD700', bg: 'rgba(255,215,0,0.1)', border: 'rgba(255,215,0,0.3)' },
  'whale': { label: '🐋 WHALE', color: '#0088ff', bg: 'rgba(0,136,255,0.1)', border: 'rgba(0,136,255,0.3)' },
  'kol': { label: '⭐ KOL', color: '#00FF88', bg: 'rgba(0,255,136,0.1)', border: 'rgba(0,255,136,0.3)' },
}

const RANK_COLORS = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' }

export default function LeaderboardPage() {
  const [period, setPeriod] = useState('7d')
  const [walletAddress, setWalletAddress] = useState(null)
  const [data, setData] = useState(MOCK_LEADERBOARD)

  useEffect(() => {
    const saved = localStorage.getItem('trench_wallet')
    if (saved) setWalletAddress(saved)
  }, [])

  const connectWallet = async () => {
    try {
      const provider = window?.phantom?.solana ?? window?.solana
      if (!provider?.isPhantom) { window.open('https://phantom.app/', '_blank'); return }
      const resp = await provider.connect()
      const addr = resp.publicKey.toString()
      setWalletAddress(addr)
      localStorage.setItem('trench_wallet', addr)
    } catch {}
  }

  const sorted = [...data].sort((a, b) => period === '30d' ? b.pnl30d - a.pnl30d : b.pnl7d - a.pnl7d)
    .map((k, i) => ({ ...k, rank: i + 1 }))

  const fmt = (n) => {
    const abs = Math.abs(n)
    const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : abs >= 1_000 ? `$${(abs/1_000).toFixed(1)}K` : `$${abs.toFixed(0)}`
    return n >= 0 ? `+${s}` : `-${s}`
  }

  const truncate = (addr) => addr ? `${addr.slice(0,4)}...${addr.slice(-4)}` : ''

  // Check if connected wallet is on leaderboard
  const userRank = walletAddress ? sorted.findIndex(k => k.address === walletAddress) + 1 : null

  return (
    <div style={{ minHeight: '100vh', background: '#050508', color: '#e0e0f0', fontFamily: "'DM Sans', sans-serif" }}>

      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '52px', background: 'rgba(5,5,8,0.95)', borderBottom: '1px solid #1a1a2e', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <a href="/" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', letterSpacing: '4px', color: '#00FF88', textDecoration: 'none', textShadow: '0 0 16px rgba(0,255,136,0.4)' }}>TRENCH</a>
          <div style={{ display: 'flex', gap: '20px' }}>
            {[['/', 'ROOMS'], ['/tracker', 'TRACKER'], ['/leaderboard', 'LEADERBOARD']].map(([href, label]) => (
              <a key={href} href={href} style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', letterSpacing: '2px', color: href === '/leaderboard' ? '#00FF88' : '#6666aa', textDecoration: 'none', borderBottom: href === '/leaderboard' ? '1px solid #00FF88' : '1px solid transparent', paddingBottom: '2px' }}>{label}</a>
            ))}
          </div>
        </div>
        {walletAddress ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)', padding: '6px 12px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00FF88', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#00FF88', letterSpacing: '1px' }}>{truncate(walletAddress)}</span>
          </div>
        ) : (
          <button onClick={connectWallet} style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', letterSpacing: '2px', color: '#050508', background: '#00FF88', border: 'none', padding: '8px 18px', cursor: 'pointer', clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)' }}>
            ⚡ CONNECT WALLET
          </button>
        )}
      </nav>

      <div style={{ paddingTop: '72px', padding: '72px 24px 48px', maxWidth: '1000px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(48px,7vw,80px)', letterSpacing: '6px', lineHeight: 1, marginBottom: '8px' }}>
              DEGEN <span style={{ color: '#FFD700' }}>LEADERBOARD</span>
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: '#6666aa', letterSpacing: '2px' }}>
              // RANKED BY ACTUAL ON-CHAIN PNL · NOT FOLLOWERS · NOT VIBES
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[['7d','7 DAYS'],['30d','30 DAYS']].map(([v,l]) => (
              <button key={v} onClick={() => setPeriod(v)}
                style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '1px', padding: '8px 16px', background: period === v ? 'rgba(255,215,0,0.1)' : '#0a0a10', border: `1px solid ${period === v ? 'rgba(255,215,0,0.4)' : '#1a1a2e'}`, color: period === v ? '#FFD700' : '#6666aa', cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Top 3 Podium */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '8px', marginBottom: '32px', alignItems: 'flex-end' }}>
          {[sorted[1], sorted[0], sorted[2]].map((kol, i) => {
            if (!kol) return <div key={i} />
            const isFirst = kol.rank === 1
            const rankColor = RANK_COLORS[kol.rank] || '#6666aa'
            const pnl = period === '30d' ? kol.pnl30d : kol.pnl7d
            return (
              <div key={kol.rank} style={{ background: isFirst ? 'rgba(255,215,0,0.05)' : '#0a0a10', border: `1px solid ${isFirst ? 'rgba(255,215,0,0.3)' : '#1a1a2e'}`, padding: isFirst ? '28px 20px' : '20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                {isFirst && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, transparent, #FFD700, transparent)' }} />}
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isFirst ? '48px' : '36px', color: rankColor, lineHeight: 1, marginBottom: '8px', textShadow: isFirst ? `0 0 20px ${rankColor}44` : 'none' }}>#{kol.rank}</div>
                <div style={{ width: isFirst ? '48px' : '40px', height: isFirst ? '48px' : '40px', borderRadius: '50%', background: `hsl(${kol.rank * 40 + 120}, 60%, 35%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: isFirst ? '20px' : '16px', color: '#fff', margin: '0 auto 12px' }}>
                  {kol.displayName[0]}
                </div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: isFirst ? '14px' : '12px', color: '#e0e0f0', marginBottom: '4px' }}>{kol.displayName}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#6666aa', marginBottom: '12px' }}>@{kol.twitterHandle}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isFirst ? '28px' : '22px', color: '#00FF88', letterSpacing: '2px' }}>{fmt(pnl)}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#3a3a5c', letterSpacing: '1px', marginTop: '4px' }}>{period.toUpperCase()} PNL</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#6666aa', marginTop: '8px' }}>{kol.winRate}% win rate</div>
                {kol.badge && BADGES[kol.badge] && (
                  <div style={{ display: 'inline-block', fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', letterSpacing: '1px', padding: '3px 8px', background: BADGES[kol.badge].bg, color: BADGES[kol.badge].color, border: `1px solid ${BADGES[kol.badge].border}`, marginTop: '10px' }}>
                    {BADGES[kol.badge].label}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Full Table */}
        <div style={{ background: '#0a0a10', border: '1px solid #1a1a2e' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px 120px 80px 80px', padding: '10px 20px', background: '#070710', borderBottom: '1px solid #1a1a2e', fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#3a3a5c', letterSpacing: '2px' }}>
            <span>RANK</span><span>TRADER</span><span>{period.toUpperCase()} PNL</span><span>30D PNL</span><span>WIN %</span><span>TRADES</span>
          </div>
          {sorted.map(kol => {
            const pnl = period === '30d' ? kol.pnl30d : kol.pnl7d
            const rankColor = RANK_COLORS[kol.rank] || '#6666aa'
            const isUser = walletAddress && kol.address === walletAddress
            return (
              <div key={kol.rank} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px 120px 80px 80px', padding: '14px 20px', borderBottom: '1px solid #0d0d18', background: isUser ? 'rgba(0,255,136,0.03)' : 'transparent', borderLeft: isUser ? '2px solid #00FF88' : '2px solid transparent', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = isUser ? 'rgba(0,255,136,0.06)' : '#0d0d18'}
                onMouseLeave={e => e.currentTarget.style.background = isUser ? 'rgba(0,255,136,0.03)' : 'transparent'}
              >
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', color: rankColor, lineHeight: 1, display: 'flex', alignItems: 'center' }}>#{kol.rank}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `hsl(${kol.rank * 40 + 120}, 60%, 35%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '14px', color: '#fff', flexShrink: 0 }}>{kol.displayName[0]}</div>
                  <div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', color: '#e0e0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {kol.displayName}
                      {isUser && <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#00FF88', border: '1px solid rgba(0,255,136,0.3)', padding: '1px 6px' }}>YOU</span>}
                      {kol.badge && BADGES[kol.badge] && <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '7px', padding: '2px 6px', background: BADGES[kol.badge].bg, color: BADGES[kol.badge].color, border: `1px solid ${BADGES[kol.badge].border}` }}>{BADGES[kol.badge].label}</span>}
                    </div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#6666aa' }}>@{kol.twitterHandle} · {truncate(kol.address)}</div>
                  </div>
                </div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '13px', fontWeight: 'bold', color: '#00FF88', display: 'flex', alignItems: 'center' }}>{fmt(pnl)}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: '#6666aa', display: 'flex', alignItems: 'center' }}>{fmt(kol.pnl30d)}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: kol.winRate >= 65 ? '#00FF88' : kol.winRate >= 55 ? '#FFD700' : '#FF3366', display: 'flex', alignItems: 'center' }}>{kol.winRate}%</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: '#6666aa', display: 'flex', alignItems: 'center' }}>{kol.totalTrades.toLocaleString()}</div>
              </div>
            )
          })}
        </div>

        {/* Your rank CTA */}
        {!walletAddress && (
          <div style={{ marginTop: '24px', background: 'rgba(0,255,136,0.03)', border: '1px solid rgba(0,255,136,0.15)', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', letterSpacing: '4px', color: '#e0e0f0', marginBottom: '8px' }}>WHERE DO YOU RANK?</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: '#6666aa', marginBottom: '20px', letterSpacing: '1px' }}>Connect your wallet to see your position on the leaderboard</div>
            <button onClick={connectWallet}
              style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', letterSpacing: '2px', color: '#050508', background: '#00FF88', border: 'none', padding: '12px 28px', cursor: 'pointer', clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)' }}>
              ⚡ CONNECT PHANTOM
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
