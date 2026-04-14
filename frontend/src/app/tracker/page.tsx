// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

interface KOL {
  id: string
  address: string
  displayName: string
  twitterHandle: string
  isVerified: boolean
  reputationScore: number
  stats: {
    pnl24h: number; pnl7d: number; pnl30d: number
    winRate: number; totalTrades: number; isStillHolding: boolean
  }
}

export default function TrackerPage() {
  const [kols, setKols] = useState<KOL[]>([])
  const [sort, setSort] = useState<'pnl7d'|'pnl24h'|'winrate'|'trades'>('pnl7d')
  const [search, setSearch] = useState('')
  const [tracked, setTracked] = useState<Set<string>>(new Set())
  const [newWallet, setNewWallet] = useState('')

  useEffect(() => {
    fetch(`${API}/kols`).then(r => r.json()).then(d => setKols(d.kols ?? []))
  }, [])

  const sorted = [...kols]
    .filter(k => !search || k.displayName.toLowerCase().includes(search.toLowerCase()) || k.twitterHandle.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'pnl24h') return b.stats.pnl24h - a.stats.pnl24h
      if (sort === 'winrate') return b.stats.winRate - a.stats.winRate
      if (sort === 'trades') return b.stats.totalTrades - a.stats.totalTrades
      return b.stats.pnl7d - a.stats.pnl7d
    })

  const toggleTrack = (id: string) => {
    setTracked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const addCustomWallet = () => {
    if (!newWallet.trim() || newWallet.trim().length < 32) return
    const w = newWallet.trim()
    const custom: KOL = {
      id: `custom-${Date.now()}`, address: w,
      displayName: `${w.slice(0,4)}...${w.slice(-4)}`,
      twitterHandle: 'unknown', isVerified: false, reputationScore: 50,
      stats: { pnl24h: 0, pnl7d: 0, pnl30d: 0, winRate: 0, totalTrades: 0, isStillHolding: false }
    }
    setKols(prev => [...prev, custom])
    setTracked(prev => new Set([...prev, custom.id]))
    setNewWallet('')
  }

  const fmt = (n: number) => {
    const abs = Math.abs(n)
    const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : abs >= 1_000 ? `$${(abs/1_000).toFixed(1)}K` : `$${abs.toFixed(0)}`
    return n >= 0 ? `+${s}` : `-${s}`
  }

  const trackedKols = sorted.filter(k => tracked.has(k.id))
  const allKols = sorted.filter(k => !tracked.has(k.id))

  return (
    <div style={{ minHeight: '100vh', background: '#050508', color: '#e0e0f0', fontFamily: "'DM Sans', sans-serif" }}>
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '52px', background: 'rgba(5,5,8,0.95)', borderBottom: '1px solid #1a1a2e', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <a href="/" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', letterSpacing: '4px', color: '#00FF88', textDecoration: 'none' }}>TRENCH</a>
          <span style={{ color: '#1a1a2e' }}>|</span>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', letterSpacing: '3px', color: '#6666aa' }}>KOL TRACKER</span>
        </div>
        <a href="/" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '2px', color: '#6666aa', textDecoration: 'none' }}>← ROOMS</a>
      </nav>

      <div style={{ paddingTop: '52px', padding: '72px 24px 48px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(40px,6vw,72px)', letterSpacing: '6px', lineHeight: 1, marginBottom: '8px' }}>
            KOL <span style={{ color: '#00FF88' }}>TRACKER</span>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: '#6666aa', letterSpacing: '2px' }}>
            // TRACK {kols.length} VERIFIED WALLETS · REAL-TIME PNL · 25% SELL ALERTS
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '32px' }}>
          {[
            { label: 'Tracking', val: `${tracked.size}/${kols.length}` },
            { label: 'Avg Win Rate', val: `${Math.round(kols.reduce((a,k) => a + k.stats.winRate, 0) / (kols.length||1))}%` },
            { label: 'Top 7D PNL', val: kols.length ? fmt(Math.max(...kols.map(k => k.stats.pnl7d))) : '+$0' },
            { label: 'Active Alerts', val: '0' },
          ].map(s => (
            <div key={s.label} style={{ background: '#0a0a10', border: '1px solid #1a1a2e', padding: '16px' }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#3a3a5c', letterSpacing: '2px', marginBottom: '8px' }}>{s.label.toUpperCase()}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '32px', color: '#00FF88', letterSpacing: '2px', lineHeight: 1 }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Add Wallet */}
        <div style={{ background: '#0a0a10', border: '1px solid #1a1a2e', padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '0' }}>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#00FF88', letterSpacing: '2px', padding: '0 16px 0 0', flexShrink: 0 }}>+ ADD WALLET</span>
          <input value={newWallet} onChange={e => setNewWallet(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomWallet()}
            placeholder="Paste any Solana wallet address to track..."
            style={{ flex: 1, background: '#070710', border: '1px solid #1a1a2e', borderRight: 'none', color: '#e0e0f0', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', padding: '10px 14px', outline: 'none' }} />
          <button onClick={addCustomWallet}
            style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', letterSpacing: '2px', background: '#00FF88', color: '#050508', border: 'none', padding: '10px 20px', cursor: 'pointer', flexShrink: 0 }}>
            TRACK
          </button>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search KOLs..."
            style={{ background: '#0a0a10', border: '1px solid #1a1a2e', color: '#e0e0f0', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', padding: '8px 14px', outline: 'none', width: '200px' }} />
          {[['pnl7d','7D PNL'],['pnl24h','24H PNL'],['winrate','WIN RATE'],['trades','TRADES']].map(([v,l]) => (
            <button key={v} onClick={() => setSort(v as any)}
              style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '1px', padding: '8px 14px', background: sort === v ? 'rgba(0,255,136,0.1)' : '#0a0a10', border: `1px solid ${sort === v ? 'rgba(0,255,136,0.4)' : '#1a1a2e'}`, color: sort === v ? '#00FF88' : '#6666aa', cursor: 'pointer' }}>{l}</button>
          ))}
          <button onClick={() => setTracked(new Set(kols.map(k => k.id)))}
            style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '1px', padding: '8px 14px', background: '#0a0a10', border: '1px solid #1a1a2e', color: '#6666aa', cursor: 'pointer', marginLeft: 'auto' }}>SELECT ALL</button>
          <button onClick={() => setTracked(new Set())}
            style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '1px', padding: '8px 14px', background: '#0a0a10', border: '1px solid #1a1a2e', color: '#6666aa', cursor: 'pointer' }}>CLEAR ALL</button>
        </div>

        {/* Tracked */}
        {trackedKols.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#00FF88', letterSpacing: '3px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00FF88', animation: 'pulse 2s infinite' }} />
              TRACKING ({trackedKols.length})
            </div>
            <TableHeader />
            {trackedKols.map(k => <KOLRow key={k.id} kol={k} tracked={true} onToggle={() => toggleTrack(k.id)} fmt={fmt} />)}
          </div>
        )}

        {/* All KOLs */}
        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#3a3a5c', letterSpacing: '3px', marginBottom: '8px' }}>ALL KOLS ({allKols.length})</div>
          <TableHeader />
          {allKols.map(k => <KOLRow key={k.id} kol={k} tracked={false} onToggle={() => toggleTrack(k.id)} fmt={fmt} />)}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}

function TableHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 100px 100px 100px 80px 80px 110px 100px', padding: '8px 16px', background: '#070710', borderBottom: '1px solid #1a1a2e', fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#3a3a5c', letterSpacing: '1px' }}>
      <span>KOL</span><span>24H PNL</span><span>7D PNL</span><span>30D PNL</span><span>WIN %</span><span>TRADES</span><span>STATUS</span><span>ACTION</span>
    </div>
  )
}

function KOLRow({ kol, tracked, onToggle, fmt }: { kol: any; tracked: boolean; onToggle: () => void; fmt: (n:number) => string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 100px 100px 100px 80px 80px 110px 100px', padding: '12px 16px', background: tracked ? 'rgba(0,255,136,0.03)' : 'transparent', borderBottom: '1px solid #0d0d18', borderLeft: `2px solid ${tracked ? '#00FF88' : 'transparent'}`, transition: 'background 0.15s', cursor: 'default' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#0a0a10' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = tracked ? 'rgba(0,255,136,0.03)' : 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `hsl(${kol.reputationScore*3},60%,35%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '13px', color: '#fff', flexShrink: 0 }}>{kol.displayName[0]}</div>
        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: '#e0e0f0', display: 'flex', alignItems: 'center', gap: '4px' }}>{kol.displayName}{kol.isVerified && <span style={{ color: '#00FF88', fontSize: '8px' }}>✓</span>}</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#6666aa' }}>@{kol.twitterHandle}</div>
        </div>
      </div>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: kol.stats.pnl24h >= 0 ? '#00FF88' : '#FF3366', display: 'flex', alignItems: 'center' }}>{fmt(kol.stats.pnl24h)}</div>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', fontWeight: 'bold', color: kol.stats.pnl7d >= 0 ? '#00FF88' : '#FF3366', display: 'flex', alignItems: 'center' }}>{fmt(kol.stats.pnl7d)}</div>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: kol.stats.pnl30d >= 0 ? '#00FF88' : '#FF3366', display: 'flex', alignItems: 'center' }}>{fmt(kol.stats.pnl30d)}</div>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: kol.stats.winRate >= 60 ? '#00FF88' : kol.stats.winRate >= 50 ? '#FFD700' : '#FF3366', display: 'flex', alignItems: 'center' }}>{kol.stats.winRate}%</div>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: '#6666aa', display: 'flex', alignItems: 'center' }}>{kol.stats.totalTrades.toLocaleString()}</div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', letterSpacing: '1px', padding: '3px 8px', background: kol.stats.isStillHolding ? 'rgba(0,255,136,0.1)' : 'rgba(255,51,102,0.1)', color: kol.stats.isStillHolding ? '#00FF88' : '#FF3366', border: `1px solid ${kol.stats.isStillHolding ? 'rgba(0,255,136,0.2)' : 'rgba(255,51,102,0.2)'}` }}>
          {kol.stats.isStillHolding ? '● HOLDING' : '○ EXITED'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button onClick={onToggle} style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', letterSpacing: '1px', padding: '5px 12px', cursor: 'pointer', background: tracked ? 'rgba(255,51,102,0.1)' : 'rgba(0,255,136,0.1)', border: `1px solid ${tracked ? 'rgba(255,51,102,0.3)' : 'rgba(0,255,136,0.3)'}`, color: tracked ? '#FF3366' : '#00FF88' }}>
          {tracked ? 'UNTRACK' : '+ TRACK'}
        </button>
      </div>
    </div>
  )
}
