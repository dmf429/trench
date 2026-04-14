// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

interface Room {
  id: string
  token: { address: string; name: string; symbol: string; logoUri?: string }
  price: number
  priceChange24h: number
  priceChange1h: number
  volume24h: number
  liquidity: number
  marketCap: number
  healthScore: number
  buys24h: number
  sells24h: number
  memberCount: number
  flagCount: number
  dexUrl?: string
}

interface Message {
  id: string
  sender: string
  content: string
  timestamp: Date
  isSystem?: boolean
}

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.id as string

  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [panel, setPanel] = useState<'chart' | 'kol' | 'health'>('chart')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load room data
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/rooms/${roomId}`)
        const data = await res.json()
        setRoom(data)
        // Add welcome system message
        setMessages([{
          id: 'sys-1',
          sender: 'TRENCH',
          content: `Welcome to $${data.token?.symbol} room. Price: $${formatPrice(data.price)} · Vol: ${formatShort(data.volume24h)}`,
          timestamp: new Date(),
          isSystem: true,
        }])
      } catch (e) {
        // fallback
      } finally {
        setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [roomId])

  // Auto scroll chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    if (!input.trim()) return
    const msg: Message = {
      id: Date.now().toString(),
      sender: 'You',
      content: input.trim(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, msg])
    setInput('')
  }

  const formatPrice = (p: number) => {
    if (!p) return '$0'
    if (p < 0.000001) return `$${p.toExponential(2)}`
    if (p < 0.01) return `$${p.toFixed(6)}`
    if (p < 1) return `$${p.toFixed(4)}`
    return `$${p.toFixed(2)}`
  }

  const formatShort = (n: number) => {
    if (!n) return '$0'
    if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n/1_000).toFixed(1)}K`
    return `$${n.toFixed(0)}`
  }

  const getRiskColor = (s: number) =>
    s >= 75 ? '#00FF88' : s >= 50 ? '#FFD700' : s >= 25 ? '#FF8800' : '#FF3366'

  const getRiskLabel = (s: number) =>
    s >= 75 ? 'SAFE' : s >= 50 ? 'CAUTION' : s >= 25 ? 'DANGER' : 'RUG RISK'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#050508', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Share Tech Mono', monospace", color: '#3a3a5c', letterSpacing: '2px', fontSize: '12px' }}>
      // LOADING ROOM...
    </div>
  )

  if (!room) return (
    <div style={{ minHeight: '100vh', background: '#050508', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", color: '#FF3366', fontSize: '12px', letterSpacing: '2px' }}>// ROOM NOT FOUND</div>
      <button onClick={() => router.push('/')} style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', letterSpacing: '2px', background: 'none', border: '1px solid #1a1a2e', color: '#6666aa', padding: '10px 20px', cursor: 'pointer' }}>← BACK TO ROOMS</button>
    </div>
  )

  const priceUp = room.priceChange24h >= 0
  const buyRatio = room.buys24h + room.sells24h > 0
    ? Math.round((room.buys24h / (room.buys24h + room.sells24h)) * 100)
    : 50

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#050508', color: '#e0e0f0', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden' }}>

      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '0 20px', height: '52px', background: '#0a0a10', borderBottom: '1px solid #1a1a2e', flexShrink: 0 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#6666aa', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', letterSpacing: '1px' }}>← ROOMS</button>

        <div style={{ width: '1px', height: '20px', background: '#1a1a2e' }} />

        {room.token.logoUri ? (
          <img src={room.token.logoUri} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #00FF88, #0088ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue', sans-serif", fontSize: '12px', color: '#050508', flexShrink: 0 }}>
            {room.token.symbol[0]}
          </div>
        )}

        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '14px', color: '#e0e0f0', lineHeight: 1 }}>${room.token.symbol}</div>
          <div style={{ fontSize: '10px', color: '#6666aa', lineHeight: 1.2 }}>{room.token.name}</div>
        </div>

        <div style={{ marginLeft: '8px' }}>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '16px', fontWeight: 'bold', color: '#e0e0f0' }}>{formatPrice(room.price)}</span>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', color: priceUp ? '#00FF88' : '#FF3366', marginLeft: '8px', fontWeight: 'bold' }}>
            {priceUp ? '▲' : '▼'} {Math.abs(room.priceChange24h).toFixed(1)}%
          </span>
        </div>

        <div style={{ display: 'flex', gap: '20px', marginLeft: '16px' }}>
          {[
            ['MCAP', formatShort(room.marketCap)],
            ['VOL 24H', formatShort(room.volume24h)],
            ['LIQ', formatShort(room.liquidity)],
          ].map(([l, v]) => (
            <div key={l}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#3a3a5c', letterSpacing: '1px' }}>{l}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '12px', color: '#e0e0f0' }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', color: getRiskColor(room.healthScore), lineHeight: 1 }}>{room.healthScore}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '7px', color: getRiskColor(room.healthScore), letterSpacing: '1px' }}>{getRiskLabel(room.healthScore)}</div>
          </div>

          {room.dexUrl && (
            <a href={room.dexUrl} target="_blank" rel="noreferrer" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '1px', color: '#6666aa', border: '1px solid #1a1a2e', padding: '6px 10px', textDecoration: 'none', transition: 'color 0.15s' }}>
              DEXSCREENER ↗
            </a>
          )}

          <button style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '1px', color: '#FF3366', border: '1px solid rgba(255,51,102,0.3)', background: 'rgba(255,51,102,0.05)', padding: '6px 10px', cursor: 'pointer' }}>
            ⚑ FLAG
          </button>
        </div>
      </div>

      {/* BUY/SELL BAR */}
      <div style={{ height: '28px', display: 'flex', alignItems: 'center', background: '#070710', borderBottom: '1px solid #1a1a2e', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${buyRatio}%`, background: 'rgba(0,255,136,0.08)', transition: 'width 0.5s ease' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 16px' }}>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#00FF88', letterSpacing: '1px' }}>
            ▲ {room.buys24h.toLocaleString()} BUYS ({buyRatio}%)
          </span>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#3a3a5c', letterSpacing: '1px' }}>BUY/SELL RATIO 24H</span>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#FF3366', letterSpacing: '1px' }}>
            {room.sells24h.toLocaleString()} SELLS ({100 - buyRatio}%) ▼
          </span>
        </div>
      </div>

      {/* MAIN BODY */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT — Chart + Chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid #1a1a2e' }}>

          {/* Chart Panel Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1a1a2e', background: '#0a0a10', flexShrink: 0 }}>
            {[['chart','📈 CHART'],['kol','👛 KOL TRACKER'],['health','💊 HEALTH']].map(([v,l]) => (
              <button key={v} onClick={() => setPanel(v as any)} style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '1px', padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${panel === v ? '#00FF88' : 'transparent'}`, color: panel === v ? '#00FF88' : '#6666aa', cursor: 'pointer' }}>
                {l}
              </button>
            ))}
          </div>

          {/* Chart */}
          {panel === 'chart' && (
            <div style={{ height: '340px', flexShrink: 0, background: '#070710' }}>
              <iframe
                src={`https://dexscreener.com/solana/${room.token.address}?embed=1&theme=dark&trades=0&info=0`}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Chart"
              />
            </div>
          )}

          {/* KOL Panel */}
          {panel === 'kol' && (
            <div style={{ height: '340px', flexShrink: 0, padding: '16px', overflowY: 'auto' }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#3a3a5c', letterSpacing: '2px', marginBottom: '16px' }}>// KOL SENTIMENT FOR ${room.token.symbol}</div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                {[['0', 'KOLs Holding'],['0','KOLs Tracked'],['—','Avg Entry']].map(([v,l]) => (
                  <div key={l} style={{ flex: 1, background: '#0a0a10', border: '1px solid #1a1a2e', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '28px', color: '#00FF88', letterSpacing: '2px' }}>{v}</div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', color: '#3a3a5c', letterSpacing: '1px', marginTop: '4px' }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', color: '#3a3a5c', textAlign: 'center', padding: '20px' }}>
                KOL tracking coming in next update.<br/>Track 340+ verified wallets.
              </div>
            </div>
          )}

          {/* Health Panel */}
          {panel === 'health' && (
            <div style={{ height: '340px', flexShrink: 0, padding: '16px', overflowY: 'auto' }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#3a3a5c', letterSpacing: '2px', marginBottom: '16px' }}>// COIN HEALTH SCORE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '80px', color: getRiskColor(room.healthScore), lineHeight: 1, textShadow: `0 0 20px ${getRiskColor(room.healthScore)}44` }}>{room.healthScore}</div>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '20px', color: getRiskColor(room.healthScore), letterSpacing: '2px' }}>{getRiskLabel(room.healthScore)}</div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#6666aa', marginTop: '4px' }}>out of 100</div>
                </div>
              </div>
              <div style={{ height: '4px', background: '#1a1a2e', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${room.healthScore}%`, background: getRiskColor(room.healthScore), transition: 'width 0.5s ease' }} />
              </div>
              {[
                ['Liquidity Depth', room.liquidity > 100000 ? 'GOOD' : room.liquidity > 10000 ? 'LOW' : 'CRITICAL', room.liquidity > 100000],
                ['24h Volume', room.volume24h > 100000 ? 'ACTIVE' : 'LOW', room.volume24h > 100000],
                ['Buy Pressure', buyRatio > 50 ? 'BULLISH' : 'BEARISH', buyRatio > 50],
                ['Price Action', Math.abs(room.priceChange24h) < 50 ? 'STABLE' : 'VOLATILE', Math.abs(room.priceChange24h) < 50],
              ].map(([label, val, good]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a2e' }}>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#6666aa', letterSpacing: '1px' }}>{label as string}</span>
                  <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: good ? '#00FF88' : '#FF3366', letterSpacing: '1px' }}>{val as string}</span>
                </div>
              ))}
            </div>
          )}

          {/* CHAT */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: '1px solid #1a1a2e' }}>
            <div style={{ padding: '6px 14px', background: '#0a0a10', borderBottom: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#3a3a5c', letterSpacing: '2px' }}>// LIVE CHAT</span>
              <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#00FF88' }}>
                <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: '#00FF88', marginRight: '4px', verticalAlign: 'middle' }} />
                {room.memberCount} online
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ padding: '4px 14px', borderLeft: msg.isSystem ? '2px solid #00FF88' : 'none', marginBottom: '2px' }}>
                  {msg.isSystem ? (
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: '#00FF88', letterSpacing: '1px' }}>{msg.content}</div>
                  ) : (
                    <div>
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: msg.sender === 'You' ? '#00FF88' : '#6666aa', marginRight: '8px' }}>{msg.sender}</span>
                      <span style={{ fontSize: '13px', color: '#e0e0f0' }}>{msg.content}</span>
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div style={{ display: 'flex', borderTop: '1px solid #1a1a2e', flexShrink: 0 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Say something... (connect wallet to chat)"
                style={{ flex: 1, background: '#070710', border: 'none', borderRight: '1px solid #1a1a2e', color: '#e0e0f0', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px', padding: '12px 14px', outline: 'none' }}
              />
              <button onClick={sendMessage} style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', letterSpacing: '1px', background: 'none', border: 'none', color: '#00FF88', padding: '12px 16px', cursor: 'pointer' }}>SEND</button>
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Token Info */}
          <div style={{ padding: '16px', borderBottom: '1px solid #1a1a2e' }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#3a3a5c', letterSpacing: '2px', marginBottom: '12px' }}>// TOKEN INFO</div>
            {[
              ['Price 1H', `${room.priceChange1h >= 0 ? '+' : ''}${room.priceChange1h?.toFixed(1) ?? '0'}%`, room.priceChange1h >= 0],
              ['Price 24H', `${priceUp ? '+' : ''}${room.priceChange24h.toFixed(1)}%`, priceUp],
              ['Volume 24H', formatShort(room.volume24h), true],
              ['Liquidity', formatShort(room.liquidity), true],
              ['Market Cap', formatShort(room.marketCap), true],
              ['Buys 24H', room.buys24h.toLocaleString(), true],
              ['Sells 24H', room.sells24h.toLocaleString(), false],
            ].map(([l, v, good]) => (
              <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #0d0d18' }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#3a3a5c', letterSpacing: '1px' }}>{l as string}</span>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: typeof good === 'boolean' && l !== 'Buys 24H' && l !== 'Sells 24H' && l !== 'Volume 24H' && l !== 'Liquidity' && l !== 'Market Cap' ? (good ? '#00FF88' : '#FF3366') : '#e0e0f0' }}>{v as string}</span>
              </div>
            ))}
          </div>

          {/* Contract */}
          <div style={{ padding: '16px', borderBottom: '1px solid #1a1a2e' }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#3a3a5c', letterSpacing: '2px', marginBottom: '8px' }}>// CONTRACT</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#6666aa', wordBreak: 'break-all', lineHeight: 1.6 }}>
              {room.token.address}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(room.token.address)}
              style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '8px', letterSpacing: '1px', color: '#3a3a5c', background: 'none', border: '1px solid #1a1a2e', padding: '4px 10px', cursor: 'pointer', marginTop: '8px' }}
            >
              ⎘ COPY
            </button>
          </div>

          {/* Quick Actions */}
          <div style={{ padding: '16px' }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', color: '#3a3a5c', letterSpacing: '2px', marginBottom: '12px' }}>// QUICK ACTIONS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {room.dexUrl && (
                <a href={room.dexUrl} target="_blank" rel="noreferrer" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '1px', color: '#e0e0f0', background: '#0a0a10', border: '1px solid #1a1a2e', padding: '10px 14px', textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                  TRADE ON DEXSCREENER ↗
                </a>
              )}
              <a href={`https://birdeye.so/token/${room.token.address}?chain=solana`} target="_blank" rel="noreferrer" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '1px', color: '#e0e0f0', background: '#0a0a10', border: '1px solid #1a1a2e', padding: '10px 14px', textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                VIEW ON BIRDEYE ↗
              </a>
              <a href={`https://solscan.io/token/${room.token.address}`} target="_blank" rel="noreferrer" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '9px', letterSpacing: '1px', color: '#e0e0f0', background: '#0a0a10', border: '1px solid #1a1a2e', padding: '10px 14px', textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                VIEW ON SOLSCAN ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
