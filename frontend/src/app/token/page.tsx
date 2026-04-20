// @ts-nocheck
'use client'
import Sidebar from '../../components/Sidebar'

const UTILITY = [
  {icon:'🔓',title:'Premium Access',desc:"Hold $TRENCH to unlock copy trade, advanced alerts, and full KOL analytics."},
  {icon:'🔥',title:'Burn to Boost',desc:"Burn $TRENCH to pin your coin's room at the top for 24 hours."},
  {icon:'💸',title:'Tip KOLs',desc:"Send $TRENCH directly to KOLs who made you money. On-chain, instant."},
  {icon:'🗳️',title:'Governance',desc:"Vote on KOL nominations, features, and fee structures. You run this."},
  {icon:'📉',title:'Deflationary',desc:"Platform revenue buys and burns $TRENCH. Every trade makes your bag scarcer."},
  {icon:'⚡',title:'Alert Priority',desc:"Higher $TRENCH balance = faster alert delivery. Never be last to know."},
]

const TOKENOMICS = [
  {label:'Community & Airdrop',pct:40,color:'#00FF88'},
  {label:'Platform Rewards',pct:25,color:'#0088ff'},
  {label:'Team (2yr vest)',pct:15,color:'#FFD700'},
  {label:'Liquidity Pool',pct:12,color:'#FF8800'},
  {label:'Marketing',pct:8,color:'#FF3366'},
]

const ROADMAP = [
  {phase:'01',label:'MVP',status:'active',items:['Live token rooms','Real-time price data','KOL tracker','Phantom wallet connect','Degen leaderboard']},
  {phase:'02',label:'INTELLIGENCE',status:'building',items:['25% sell alerts','Alpha Feed','Whale Watch','Copy trade beta','100+ KOL wallets']},
  {phase:'03',label:'TOKEN',status:'soon',items:['$TRENCH launch on pump.fun','Token-gated features','Burn mechanics','Governance voting','Mobile app']},
  {phase:'04',label:'DOMINATION',status:'future',items:['API for developers','Multi-chain','TRENCH Pro tier','Desktop app','Institutional tools']},
]

export default function TokenPage() {
  return (
    <div style={{minHeight:'100vh',background:'#050508',color:'#e0e0f0',fontFamily:"'DM Sans',sans-serif"}}>
      <Sidebar active="/token"/>

      {/* HERO */}
      <div style={{paddingLeft:'60px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(0,255,136,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,0.03) 1px,transparent 1px)',backgroundSize:'60px 60px'}}/>
        <div style={{maxWidth:'900px',margin:'0 auto',padding:'80px 24px 60px',textAlign:'center',position:'relative'}}>
          <div style={{display:'inline-block',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'4px',color:'#00FF88',border:'1px solid rgba(0,255,136,0.3)',padding:'6px 16px',marginBottom:'24px'}}>COMING SOON — PUMP.FUN</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(64px,12vw,120px)',letterSpacing:'8px',color:'#00FF88',textShadow:'0 0 60px rgba(0,255,136,0.4)',lineHeight:0.9,marginBottom:'16px'}}>$TRENCH</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(20px,4vw,36px)',letterSpacing:'6px',marginBottom:'24px'}}>THE PLATFORM TOKEN</div>
          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#6666aa',maxWidth:'540px',margin:'0 auto 40px',lineHeight:1.8}}>
            $TRENCH powers the trenches. Hold it to unlock premium. Burn it to boost your coins. Vote with it. Watch it deflate as the platform grows.
          </div>
          <div style={{display:'flex',justifyContent:'center',gap:'32px',flexWrap:'wrap',marginBottom:'48px'}}>
            {[['1B','Total Supply'],['0%','Team Unlock at Launch'],['100%','Fair Launch'],['pump.fun','Launch Platform']].map(([v,l]) => (
              <div key={l} style={{textAlign:'center'}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'40px',color:'#00FF88',letterSpacing:'3px'}}>{v}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c',letterSpacing:'2px',marginTop:'4px'}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap'}}>
            <a href="/" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',letterSpacing:'2px',color:'#050508',background:'#00FF88',padding:'14px 28px',textDecoration:'none',clipPath:'polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%)',display:'inline-block'}}>ENTER THE TRENCHES →</a>
            <a href="/waitlist" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',letterSpacing:'2px',color:'#00FF88',background:'transparent',border:'1px solid rgba(0,255,136,0.3)',padding:'14px 28px',textDecoration:'none',display:'inline-block'}}>JOIN WAITLIST</a>
          </div>
        </div>
      </div>

      <div style={{maxWidth:'1000px',margin:'0 auto',padding:'0 24px 80px'}}>

        {/* UTILITY */}
        <div style={{marginBottom:'80px'}}>
          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'4px',color:'#00FF88',marginBottom:'12px'}}>// TOKEN UTILITY</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(36px,5vw,56px)',letterSpacing:'4px',marginBottom:'40px'}}>WHY HOLD <span style={{color:'#00FF88'}}>$TRENCH</span></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'8px'}}>
            {UTILITY.map(u => (
              <div key={u.title} style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'24px'}}>
                <div style={{fontSize:'28px',marginBottom:'12px'}}>{u.icon}</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'20px',letterSpacing:'2px',marginBottom:'8px'}}>{u.title}</div>
                <div style={{fontSize:'13px',color:'#6666aa',lineHeight:1.7}}>{u.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* TOKENOMICS */}
        <div style={{marginBottom:'80px'}}>
          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'4px',color:'#00FF88',marginBottom:'12px'}}>// TOKENOMICS</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(36px,5vw,56px)',letterSpacing:'4px',marginBottom:'40px'}}>DISTRIBUTION</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'32px',alignItems:'center'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              {TOKENOMICS.map(t => (
                <div key={t.label}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                    <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#6666aa'}}>{t.label}</span>
                    <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'18px',color:t.color}}>{t.pct}%</span>
                  </div>
                  <div style={{height:'6px',background:'#1a1a2e',position:'relative',overflow:'hidden'}}>
                    <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${t.pct}%`,background:t.color,opacity:0.8}}/>
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {[['Total Supply','1,000,000,000 $TRENCH'],['Launch','pump.fun (fair launch)'],['Team Vesting','2 year linear vest'],['Buy Tax','0%'],['Sell Tax','0%'],['Mechanism','Revenue buyback & burn']].map(([k,v]) => (
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'12px 16px',background:'#0a0a10',border:'1px solid #1a1a2e'}}>
                  <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#3a3a5c'}}>{k}</span>
                  <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#e0e0f0'}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ROADMAP */}
        <div style={{marginBottom:'80px'}}>
          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'4px',color:'#00FF88',marginBottom:'12px'}}>// ROADMAP</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(36px,5vw,56px)',letterSpacing:'4px',marginBottom:'40px'}}>THE BUILD</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'1px',background:'#1a1a2e',border:'1px solid #1a1a2e'}}>
            {ROADMAP.map(p => (
              <div key={p.phase} style={{background:p.status==='active'?'rgba(0,255,136,0.03)':'#0a0a10',padding:'28px 24px',borderLeft:p.status==='active'?'2px solid #00FF88':'2px solid transparent'}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'48px',color:p.status==='active'?'#00FF88':'#1a1a2e',lineHeight:1,marginBottom:'8px'}}>{p.phase}</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'18px',letterSpacing:'3px',marginBottom:'12px'}}>{p.label}</div>
                {p.status==='active'&&<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',letterSpacing:'2px',color:'#00FF88',background:'rgba(0,255,136,0.1)',border:'1px solid rgba(0,255,136,0.2)',padding:'3px 8px',display:'inline-block',marginBottom:'12px'}}>IN PROGRESS</div>}
                {p.status==='building'&&<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',letterSpacing:'2px',color:'#FFD700',background:'rgba(255,215,0,0.1)',border:'1px solid rgba(255,215,0,0.2)',padding:'3px 8px',display:'inline-block',marginBottom:'12px'}}>BUILDING</div>}
                <ul style={{listStyle:'none',display:'flex',flexDirection:'column',gap:'8px'}}>
                  {p.items.map(item => (
                    <li key={item} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#6666aa',display:'flex',gap:'8px'}}>
                      <span style={{color:p.status==='active'?'#00FF88':'#3a3a5c',flexShrink:0}}>→</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{textAlign:'center',padding:'60px',background:'rgba(0,255,136,0.03)',border:'1px solid rgba(0,255,136,0.15)',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:'1px',background:'linear-gradient(90deg,transparent,#00FF88,transparent)'}}/>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(32px,5vw,56px)',letterSpacing:'4px',marginBottom:'16px'}}>READY FOR THE <span style={{color:'#00FF88'}}>TRENCHES?</span></div>
          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#6666aa',marginBottom:'32px'}}>The platform is live. The token is coming. Get in early.</div>
          <a href="/" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',letterSpacing:'2px',color:'#050508',background:'#00FF88',padding:'14px 32px',textDecoration:'none',clipPath:'polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%)',display:'inline-block'}}>ENTER THE TRENCHES →</a>
        </div>
      </div>
    </div>
  )
}
