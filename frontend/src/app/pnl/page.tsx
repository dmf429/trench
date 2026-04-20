// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
function getDaysInMonth(y,m){return new Date(y,m+1,0).getDate()}
function getFirstDay(y,m){return new Date(y,m,1).getDay()}
function generateMockPnl(y,m){const days=getDaysInMonth(y,m);const d={};for(let i=1;i<=days;i++){if(Math.random()>0.28){const pnl=(Math.random()-0.4)*900;d[i]={pnl,trades:Math.floor(Math.random()*14)+1,winRate:Math.floor(Math.random()*45)+40}}}return d}
const fmtP=(n)=>{const abs=Math.abs(n),s=n>=0?'+':'-';return abs>=1000?`${s}$${(abs/1000).toFixed(1)}K`:`${s}$${abs.toFixed(0)}`}

export default function PnlPage() {
  const now=new Date()
  const [year,setYear]=useState(now.getFullYear())
  const [month,setMonth]=useState(now.getMonth())
  const [pnlData,setPnlData]=useState({})
  const [walletInput,setWalletInput]=useState('')
  const [hovered,setHovered]=useState(null)
  useEffect(()=>{setPnlData(generateMockPnl(year,month))},[year,month])
  const days=getDaysInMonth(year,month),firstDay=getFirstDay(year,month)
  const vals=Object.values(pnlData)
  const totalPnl=vals.reduce((s,d)=>s+d.pnl,0)
  const winDays=vals.filter(d=>d.pnl>0).length,tradingDays=vals.length
  const bestDay=Math.max(...vals.map(d=>d.pnl),0),worstDay=Math.min(...vals.map(d=>d.pnl),0)
  const maxAbs=Math.max(...vals.map(d=>Math.abs(d.pnl)),1)
  const getBg=(pnl)=>{if(pnl===undefined)return'transparent';const i=Math.min(Math.abs(pnl)/maxAbs,1);return pnl>0?`rgba(0,255,136,${0.08+i*0.22})`:`rgba(255,71,87,${0.08+i*0.22})`}
  const prev=()=>{if(month===0){setMonth(11);setYear(y=>y-1)}else setMonth(m=>m-1)}
  const next=()=>{if(month===11){setMonth(0);setYear(y=>y+1)}else setMonth(m=>m+1)}
  const stats=[['Total PNL',fmtP(totalPnl),totalPnl>=0?'#00ff88':'#ff4757'],['Win Rate',tradingDays>0?`${Math.round((winDays/tradingDays)*100)}%`:'—','#fff'],['Trading Days',tradingDays,'#fff'],['Avg / Day',tradingDays>0?fmtP(totalPnl/tradingDays):'—',(totalPnl/tradingDays)>=0?'#00ff88':'#ff4757'],['Best Day',fmtP(bestDay),'#00ff88'],['Worst Day',fmtP(worstDay),'#ff4757']]
  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#09090e 0%,#0b0c12 50%,#090a0f 100%)',color:'#fff',fontFamily:"system-ui,-apple-system,'Segoe UI',sans-serif",paddingLeft:'60px'}}>
      <Sidebar active="/pnl"/>
      <div style={{position:'fixed',top:'-200px',left:'30%',width:'600px',height:'400px',background:'radial-gradient(ellipse,rgba(0,255,136,0.04) 0%,transparent 70%)',pointerEvents:'none',zIndex:0}}/>
      <div style={{maxWidth:'1080px',margin:'0 auto',padding:'40px 32px',position:'relative',zIndex:1}}>
        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:'36px',flexWrap:'wrap',gap:'16px'}}>
          <div>
            <div style={{fontSize:'11px',color:'rgba(0,255,136,0.6)',letterSpacing:'2.5px',fontWeight:'600',marginBottom:'6px',fontFamily:'monospace'}}>PERFORMANCE</div>
            <h1 style={{fontSize:'32px',fontWeight:'700',margin:0,letterSpacing:'-0.8px',color:'#fff',lineHeight:1}}>PNL Calendar</h1>
          </div>
          <div style={{display:'flex',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'10px',overflow:'hidden'}}>
            <input value={walletInput} onChange={e=>setWalletInput(e.target.value)} placeholder="Paste wallet address..." style={{background:'transparent',border:'none',color:'#fff',fontSize:'12px',padding:'10px 14px',outline:'none',width:'260px',fontFamily:'monospace'}}/>
            <button style={{background:'linear-gradient(135deg,#00ff88,#00cc6a)',border:'none',color:'#000',fontSize:'11px',fontWeight:'700',padding:'10px 16px',cursor:'pointer'}}>LOAD</button>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:'10px',marginBottom:'32px'}}>
          {stats.map(([l,v,c])=>(
            <div key={l} style={{background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'12px',padding:'16px 14px',backdropFilter:'blur(12px)'}}>
              <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',marginBottom:'8px',letterSpacing:'0.8px',textTransform:'uppercase',fontWeight:'500'}}>{l}</div>
              <div style={{fontSize:'20px',fontWeight:'700',color:c,letterSpacing:'-0.5px',lineHeight:1}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'16px',overflow:'hidden',backdropFilter:'blur(12px)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 24px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
            <button onClick={prev} style={{width:'32px',height:'32px',borderRadius:'8px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center'}} onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.5)'}>‹</button>
            <div style={{fontSize:'18px',fontWeight:'600',letterSpacing:'-0.3px'}}>{MONTHS[month]} <span style={{color:'rgba(255,255,255,0.35)'}}>{year}</span></div>
            <button onClick={next} style={{width:'32px',height:'32px',borderRadius:'8px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center'}} onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.5)'}>›</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} style={{padding:'10px',textAlign:'center',fontSize:'11px',color:'rgba(255,255,255,0.2)',fontWeight:'500',letterSpacing:'0.5px'}}>{d}</div>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
            {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`} style={{minHeight:'88px',borderRight:'1px solid rgba(255,255,255,0.03)',borderBottom:'1px solid rgba(255,255,255,0.03)',background:'rgba(0,0,0,0.1)'}}/>)}
            {Array.from({length:days}).map((_,i)=>{
              const day=i+1,data=pnlData[day],isToday=year===now.getFullYear()&&month===now.getMonth()&&day===now.getDate(),isHov=hovered===day
              return (
                <div key={day} onMouseEnter={()=>setHovered(day)} onMouseLeave={()=>setHovered(null)} style={{minHeight:'88px',borderRight:'1px solid rgba(255,255,255,0.03)',borderBottom:'1px solid rgba(255,255,255,0.03)',padding:'10px',background:isHov&&data?(data.pnl>=0?'rgba(0,255,136,0.06)':'rgba(255,71,87,0.06)'):getBg(data?.pnl),cursor:data?'pointer':'default',transition:'background 0.1s'}}>
                  <div style={{fontSize:'12px',fontWeight:isToday?'700':'400',color:isToday?'#00ff88':'rgba(255,255,255,0.3)',marginBottom:'8px',display:'flex',alignItems:'center',gap:'4px'}}>
                    {day}{isToday&&<span style={{fontSize:'8px',background:'#00ff88',color:'#000',padding:'1px 4px',borderRadius:'3px',fontWeight:'700',letterSpacing:'0.5px'}}>NOW</span>}
                  </div>
                  {data&&<><div style={{fontSize:'15px',fontWeight:'700',color:data.pnl>=0?'#00ff88':'#ff4757',lineHeight:1,marginBottom:'4px',letterSpacing:'-0.3px'}}>{fmtP(data.pnl)}</div><div style={{fontSize:'10px',color:'rgba(255,255,255,0.2)',fontFamily:'monospace'}}>{data.trades}tx · {data.winRate}%</div></>}
                </div>
              )
            })}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'20px',marginTop:'20px',justifyContent:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}><div style={{display:'flex',gap:'3px'}}>{[0.15,0.22,0.3,0.38,0.45].map((a,i)=><div key={i} style={{width:'20px',height:'12px',borderRadius:'3px',background:`rgba(0,255,136,${a})`}}/>)}</div><span style={{fontSize:'11px',color:'rgba(255,255,255,0.3)',letterSpacing:'0.5px'}}>Profit</span></div>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}><div style={{display:'flex',gap:'3px'}}>{[0.45,0.38,0.3,0.22,0.15].map((a,i)=><div key={i} style={{width:'20px',height:'12px',borderRadius:'3px',background:`rgba(255,71,87,${a})`}}/>)}</div><span style={{fontSize:'11px',color:'rgba(255,255,255,0.3)',letterSpacing:'0.5px'}}>Loss</span></div>
        </div>
      </div>
      <style>{`*{box-sizing:border-box}input::placeholder{color:rgba(255,255,255,0.2)}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}`}</style>
    </div>
  )
}
