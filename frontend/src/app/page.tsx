// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

export default function HomePage() {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('volume')
  const [search, setSearch] = useState('')
  const [email, setEmail] = useState('')
  const [joined, setJoined] = useState(false)
  const [tab, setTab] = useState('rooms')

  // Wallet state
  const [walletAddress, setWalletAddress] = useState(null)
  const [walletConnecting, setWalletConnecting] = useState(false)
  const [walletError, setWalletError] = useState(null)

  const loadRooms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/rooms?sort=${sort}&search=${encodeURIComponent(search)}&limit=30`)
      const data = await res.json()
      setRooms(data.rooms ?? [])
    } catch { setRooms([]) }
    finally { setLoading(false) }
  }, [sort, search])

  useEffect(() => { loadRooms() }, [loadRooms])
  useEffect(() => {
    const interval = setInterval(loadRooms, 30000)
    return () => clearInterval(interval)
  }, [loadRooms])

  // Auto-reconnect wallet on load
  useEffect(() => {
    const saved = localStorage.getItem('trench_wallet')
    if (saved) setWalletAddress(saved)
    // Check if phantom is already connected
    if (window?.solana?.isConnected && window?.solana?.publicKey) {
      const addr = window.solana.publicKey.toString()
      setWalletAddress(addr)
      localStorage.setItem('trench_wallet', addr)
    }
  }, [])

  const connectWallet = async () => {
    setWalletConnecting(true)
    setWalletError(null)
    try {
      // Check for Phantom
      const provider = window?.phantom?.solana ?? window?.solana
      if (!provider || !provider.isPhantom) {
        window.open('https://phantom.app/', '_blank')
        setWalletError('Phantom not found — install it first')
        setWalletConnecting(false)
        return
      }
      const resp = await provider.connect()
      const addr = resp.publicKey.toString()
      setWalletAddress(addr)
      localStorage.setItem('trench_wallet', addr)
    } catch (err) {
      setWalletError('Connection rejected')
    } finally {
      setWalletConnecting(false)
    }
  }

  const disconnectWallet = async () => {
    try {
      const provider = window?.phantom?.solana ?? window?.solana
      if (provider) await provider.disconnect()
    } catch {}
    setWalletAddress(null)
    localStorage.removeItem('trench_wallet')
  }

  const formatPrice = (p) => {
    if (!p) return '$0'
    if (p < 0.000001) return `$${p.toExponential(2)}`
    if (p < 0.01) return `$${p.toFixed(6)}`
    if (p < 1) return `$${p.toFixed(4)}`
    return `$${p.toFixed(2)}`
  }

  const formatShort = (n) => {
    if (!n) return '$0'
    if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n/1_000).toFixed(1)}K`
    return `$${n.toFixed(0)}`
  }

  const getRisk = (s) => s >= 75 ? '#00FF88' : s >= 50 ? '#FFD700' : s >= 25 ? '#FF8800' : '#FF3366'
  const truncate = (addr) => addr ? `${addr.slice(0,4)}...${addr.slice(-4)}` : ''

  return (
    <div style={{ minHeight: '100vh', background: '#050508', color: '#e0e0f0', fontFamily: "'DM Sans', sans-serif", paddingBottom: '48px' }}>

      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '52px', background: 'rgba(5,5,8,0.95)', borderBottom: '1px solid #1a1a2e', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', letterSpacing: '4px', color: '#00FF88', textShadow: '0 0 16px rgba(0,255,136,0.4)' }}>TRENCH</div>
          <div style={{ display: 'flex', gap: '20px' }}>
            {[['rooms','ROOMS'],['waitlist','WAITLIST']].map(([v,l]) => (
              <button key={v} onClick={() => setTab(v)} style={{ background: 'none', border: 'none', fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', letterSpacing: '2px', color: tab === v ? '#00FF88' : '#6666aa', cursor: 'pointer', borderBottom: tab === v ? '1px solid #00FF88' : '1px solid transparent', paddingBottom: '2px' }}>{l}</button>
            ))}
            <a href="/tracker" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', letterSpacing: '2px', color: '#6666aa', textDecoration: 'none' }}>TRACKER</a>
          </div>
        </div>

        {/* Wallet Connect */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {walletError && <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#FF3366', letterSpacing: '1px' }}>{walletError}</span>}
          {walletAddress ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)', padding: '6px 12px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00FF88', animation: 'pulse 2s infinite' }} />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#00FF88', letterSpacing: '1px' }}>{truncate(walletAddress)}</span>
              </div>
              <button onClick={disconnectWallet} style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '1px', background: 'none', border: '1px solid #1a1a2e', color: '#6666aa', padding: '6px 10px', cursor: 'pointer' }}>DISCONNECT</button>
            </div>
          ) : (
            <button onClick={connectWallet} disabled={walletConnecting}
              style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', letterSpacing: '2px', color: '#050508', background: walletConnecting ? '#3a3a5c' : '#00FF88', border: 'none', padding: '8px 18px', cursor: walletConnecting ? 'default' : 'pointer', clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)', transition: 'all 0.2s' }}>
              {walletConnecting ? 'CONNECTING...' : '⚡ CONNECT WALLET'}
            </button>
          )}
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '2px', color: '#3a3a5c' }}>{rooms.length} ROOMS</span>
        </div>
      </nav>

      {/* BOTTOM TICKER */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '32px', background: 'rgba(10,10,16,0.95)', borderTop: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', overflow: 'hidden', zIndex: 100 }}>
        <div style={{ display: 'flex', gap: '48px', animation: 'ticker 30s linear infinite', whiteSpace: 'nowrap', padding: '0 24px', fontFamily: "'Share Tech Mono', monospace", fontSize: '10px' }}>
          {[...rooms.slice(0,8), ...rooms.slice(0,8)].map((r, i) => (
            <span key={i} style={{ color: r.priceChange24h >= 0 ? '#00FF88' : '#FF3366', flexShrink: 0 }}>
              ${r.token.symbol} {r.priceChange24h >= 0 ? '▲' : '▼'} {Math.abs(r.priceChange24h).toFixed(1)}%
            </span>
          ))}
        </div>
        <style>{`@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      </div>

      <div style={{ paddingTop: '52px' }}>
        {tab === 'rooms' && (
          <>
            {/* HERO */}
            <div style={{ textAlign: 'center', padding: '48px 24px 32px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px', maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)' }} />

              {/* Connected wallet banner */}
              {walletAddress && (
                <div style={{ position: 'relative', marginBottom: '24px', display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)', padding: '10px 20px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00FF88', animation: 'pulse 2s infinite' }} />
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: '#00FF88', letterSpacing: '2px' }}>WALLET CONNECTED — {truncate(walletAddress)}</span>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#3a3a5c', letterSpacing: '1px' }}>· EARLY ACCESS MEMBER</span>
                </div>
              )}

              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(60px,10vw,100px)', letterSpacing: '12px', color: '#00FF88', textShadow: '0 0 40px rgba(0,255,136,0.5)', lineHeight: 1, position: 'relative' }}>TRENCH</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', letterSpacing: '5px', color: 'rgba(0,255,136,0.4)', marginTop: '8px', marginBottom: '32px', position: 'relative' }}>THE TRENCHES, UPGRADED</div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginBottom: '32px', position: 'relative' }}>
                {[{ val: rooms.length || '...', label: 'Live Rooms' }, { val: '340+', label: 'KOLs Tracked' }, { val: '<3S', label: 'Alert Speed' }].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '36px', color: '#00FF88', letterSpacing: '2px' }}>{s.val}</div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '2px', color: '#3a3a5c', textTransform: 'uppercase' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontFamily: "'Share Tech Mono', monospace", fontSize: '14px', color: '#6666aa', pointerEvents: 'none' }}>⌕</span>
                  <input placeholder="Search token..." value={search} onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft: '36px', width: '220px', background: '#0a0a10', border: '1px solid #1a1a2e', color: '#e0e0f0', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', padding: '10px 14px 10px 36px', outline: 'none' }} />
                </div>
                {[['volume','🔥 HOT'],['new','⚡ NEW'],['health','💊 HEALTH']].map(([v,l]) => (
                  <button key={v} onClick={() => setSort(v)}
                    style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '1px', padding: '10px 14px', background: sort === v ? 'rgba(0,255,136,0.1)' : '#0a0a10', border: `1px solid ${sort === v ? 'rgba(0,255,136,0.4)' : '#1a1a2e'}`, color: sort === v ? '#00FF88' : '#6666aa', cursor: 'pointer' }}>{l}</button>
                ))}
                <button onClick={loadRooms}
                  style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '1px', padding: '10px 14px', background: '#0a0a10', border: '1px solid #1a1a2e', color: '#6666aa', cursor: 'pointer' }}>↻ REFRESH</button>
              </div>
            </div>

            {/* ROOM GRID */}
            <div style={{ padding: '0 24px', maxWidth: '1400px', margin: '0 auto' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', color: '#3a3a5c', letterSpacing: '2px' }}>// LOADING LIVE DATA...</div>
              ) : rooms.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', color: '#3a3a5c', letterSpacing: '2px' }}>// NO ROOMS FOUND</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
                  {rooms.map(room => {
                    const up = room.priceChange24h >= 0
                    return (
                      <div key={room.id}
                        onClick={() => window.location.href = `/room/${room.id}`}
                        style={{ background: '#0a0a10', border: '1px solid #1a1a2e', padding: '16px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative', overflow: 'hidden' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#1f1f3a'; e.currentTarget.style.background = '#0d0d18' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a2e'; e.currentTarget.style.background = '#0a0a10' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {room.token.logoUri ? (
                              <img src={room.token.logoUri} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                            ) : (
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #00FF88, #0088ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '14px', color: '#050508', flexShrink: 0 }}>{room.token.symbol[0]}</div>
                            )}
                            <div>
                              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '13px', color: '#e0e0f0' }}>{room.token.symbol}</div>
                              <div style={{ fontSize: '10px', color: '#6666aa', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.token.name}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', color: getRisk(room.healthScore), lineHeight: 1 }}>{room.healthScore}</div>
                            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#3a3a5c' }}>HEALTH</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px' }}>
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '14px', color: '#e0e0f0', fontWeight: 'bold' }}>{formatPrice(room.price)}</span>
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: up ? '#00FF88' : '#FF3366', fontWeight: 'bold' }}>{up ? '▲' : '▼'} {Math.abs(room.priceChange24h).toFixed(1)}%</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                          {[['MCAP', formatShort(room.marketCap)], ['VOL', formatShort(room.volume24h)], ['LIQ', formatShort(room.liquidity)]].map(([l,v]) => (
                            <div key={l}>
                              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#3a3a5c', letterSpacing: '1px' }}>{l}</div>
                              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: '#e0e0f0' }}>{v}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #1a1a2e' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00FF88', animation: 'pulse 2s infinite' }} />
                            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#00FF88' }}>{room.memberCount} online</span>
                          </div>
                          {room.flagCount > 0 && <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#FF3366' }}>⚠ {room.flagCount} flags</span>}
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#3a3a5c' }}>ENTER →</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'waitlist' && (
          <div style={{ textAlign: 'center', padding: '80px 24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(48px,8vw,80px)', letterSpacing: '8px', color: '#e0e0f0', lineHeight: 1, marginBottom: '16px' }}>GET IN<br/><span style={{ color: '#00FF88' }}>BEFORE THE CROWD</span></div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', color: '#6666aa', maxWidth: '440px', margin: '0 auto 40px', lineHeight: 1.8 }}>First 1,000 wallets get lifetime access to premium features and priority $TRENCH allocation.</div>
              {walletAddress ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.3)', padding: '16px 32px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00FF88', animation: 'pulse 2s infinite' }} />
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', color: '#00FF88', letterSpacing: '2px' }}>✓ WALLET CONNECTED — YOU'RE IN THE LIST</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', maxWidth: '420px', margin: '0 auto 16px' }}>
                    <input type="text" placeholder="Wallet address or email..." value={email} onChange={e => setEmail(e.target.value)}
                      style={{ flex: 1, background: '#0a0a10', border: '1px solid #1a1a2e', borderRight: 'none', color: '#e0e0f0', fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', padding: '14px 18px', outline: 'none' }} />
                    <button onClick={() => { if (email.trim()) setJoined(true) }}
                      style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: '#050508', background: joined ? '#00ffaa' : '#00FF88', border: 'none', padding: '14px 24px', cursor: 'pointer' }}>
                      {joined ? "✓ YOU'RE IN" : 'JOIN WAITLIST'}
                    </button>
                  </div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#6666aa', marginBottom: '16px', letterSpacing: '1px' }}>— or —</div>
                  <button onClick={connectWallet} disabled={walletConnecting}
                    style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', letterSpacing: '2px', color: '#050508', background: '#00FF88', border: 'none', padding: '14px 32px', cursor: 'pointer', clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)' }}>
                    {walletConnecting ? 'CONNECTING...' : '⚡ CONNECT PHANTOM WALLET'}
                  </button>
                </>
              )}
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#3a3a5c', letterSpacing: '2px', marginTop: '16px' }}>// 847 SPOTS REMAINING · NO SPAM · EVER</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
