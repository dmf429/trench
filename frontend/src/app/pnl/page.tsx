// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'

const C = {bg:'#06070b',bg2:'#0c0c10',bg3:'#1a1b23',bg4:'#22242d',text1:'#fcfcfc',text2:'#6b6b7a',text3:'#d4d4d8',accent:'#526fff',green:'#16a34a',green2:'#14f195',red:'#ef4444',yellow:'#eab308',border:'#1a1b23'}
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
function getDaysInMonth(y,m){return new Date(y,m+1,0).getDate()}
function getFirstDay(y,m){return new Date(y,m,1).getDay()}
function generateMockPnl(y,m){const days=getDaysInMonth(y,m);const d={};for(let i=1;i<=days;i++){if(Math.random()>0.3){const pnl=(Math.random()-0.42)*800;d[i]={pnl,trades:Math.floor(Math.random()*12)+1,winRate:Math.floor(Math.random()*40)+40}}}return d}
const fmtPnl=(n)=>{const abs=Math.abs(n);const s=n>=0?'+':'-';if(abs>=1000)return s+'$'+(abs/1000).toFixed(1)+'K';return s+'$'+abs.toFixed(0)}

export default function PnlPage() {
  const now=new Date()
  const [year,setYear]=useState(now.getFullYear())
  const [month,setMonth]=useState(now.getMonth())
  const [pnlData,setPnlData]=useState({})
  const [walletInput,setWalletInput]=useState('')
  useEffect(()=>{setPnlData(generateMockPnl(year,month))},[year,month])
  const days=getDaysInMonth(year,month)
  const firstDay=getFirstDay(year,month)
  const vals=Object.values(pnlData)
  const totalPnl=vals.reduce((s,d)=>s+(d.pnl||0),0)
  const tradingDays=vals.length
  const winDays=vals.filter(d=>d.pnl>0).length
  const bestDay=Math.max(...vals.map(d=>d.pnl||0),0)
  const worstDay=Math.min(...vals.map(d=>d.pnl||0),0)
  const avgPnl=tradingDays>0?totalPnl/tradingDays:0
  const maxAbs=Math.max(...vals.map(d=>Math.abs(d.pnl||0)),1)
  const getColor=(pnl)=>{if(pnl===undefined)return 'transparent';const intensity=Math.min(Math.abs(pnl)/maxAbs,1);return pnl>0?`rgba(22,163,74,${0.15+intensity*0.7})`:`rgba(239,68,68,${0.15+intensity*0.7})`}

  return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text1,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",paddingLeft:'60px'}}>
      <Sidebar active="/pnl"/>
      <div style={{maxWidth:'1100px',margin:'0 auto',padding:'24px 20px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
          <div>
            <h1 style={{fontSize:'24px',fontWeight:'700',margin:0,letterSpacing:'-0.5px'}}>PNL Calendar</h1>
            <p style={{fontSize:'12px',color:C.text2,margin:'4px 0 0',fontFamily:'monospace'}}>Track your trading performance day by day</p>
          </div>
          <div style={{display:'flex',background:C.bg2,border:`1px solid ${C.border}`,borderRadius:'8px',overflow:'hidden'}}>
            <input value={walletInput} onChange={e=>setWalletInput(e.target.value)} placeholder="Paste wallet to load real PNL..." style={{background:'transparent',border:'none',color:C.text1,fontSize:'12px',padding:'8px 12px',outline:'none',width:'280px',fontFamily:'monospace'}}/>
            <button style={{background:C.accent,border:'none',color:'#fff',fontSize:'11px',fontWeight:'700',padding:'8px 14px',cursor:'pointer'}}>LOAD</button>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:'10px',marginBottom:'24px'}}>
          {[['Total PNL',fmtPnl(totalPnl),totalPnl>=0?C.green:C.red],['Win Rate',tradingDays>0?Math.round((winDays/tradingDays)*100)+'%':'—',C.text1],['Trading Days',tradingDays,C.text1],['Avg Day',fmtPnl(avgPnl),avgPnl>=0?C.green:C.red],['Best Day',fmtPnl(bestDay),C.green],['Worst Day',fmtPnl(worstDay),C.red]].map(([label,val,color])=>(
            <div key={label} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'14px'}}>
              <div style={{fontSize:'10px',color:C.text2,marginBottom:'6px',fontFamily:'monospace',letterSpacing:'0.5px'}}>{label.toUpperCase()}</div>
              <div style={{fontSize:'20px',fontWeight:'700',color,letterSpacing:'-0.5px'}}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
          <button onClick={()=>{if(month===0){setMonth(11);setYear(y=>y-1)}else setMonth(m=>m-1)}} style={{background:C.bg2,border:`1px solid ${C.border}`,color:C.text1,fontSize:'20px',width:'36px',height:'36px',cursor:'pointer',borderRadius:'8px'}}>‹</button>
          <div style={{fontSize:'18px',fontWeight:'700'}}>{MONTHS[month]} {year}</div>
          <button onClick={()=>{if(month===11){setMonth(0);setYear(y=>y+1)}else setMonth(m=>m+1)}} style={{background:C.bg2,border:`1px solid ${C.border}`,color:C.text1,fontSize:'20px',width:'36px',height:'36px',cursor:'pointer',borderRadius:'8px'}}>›</button>
        </div>
        <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:'12px',overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',borderBottom:`1px solid ${C.border}`}}>
            {DAYS.map(d=><div key={d} style={{padding:'10px',textAlign:'center',fontSize:'11px',fontWeight:'600',color:C.text2,fontFamily:'monospace'}}>{d.toUpperCase()}</div>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
            {Array.from({length:firstDay}).map((_,i)=><div key={'e'+i} style={{minHeight:'90px',borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,background:'rgba(0,0,0,0.2)'}}/>)}
            {Array.from({length:days}).map((_,i)=>{
              const day=i+1,data=pnlData[day],isToday=year===now.getFullYear()&&month===now.getMonth()&&day===now.getDate()
              return <div key={day} style={{minHeight:'90px',borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,padding:'8px',background:getColor(data?.pnl),cursor:data?'pointer':'default'}}>
                <div style={{fontSize:'12px',fontWeight:isToday?'700':'500',color:isToday?C.accent:C.text2,marginBottom:'6px',fontFamily:'monospace'}}>{day}{isToday&&<span style={{marginLeft:'4px',fontSize:'8px',background:C.accent,color:'#fff',padding:'1px 4px',borderRadius:'3px'}}>TODAY</span>}</div>
                {data&&<><div style={{fontSize:'16px',fontWeight:'700',color:data.pnl>=0?C.green:C.red,lineHeight:1,marginBottom:'4px'}}>{fmtPnl(data.pnl)}</div><div style={{fontSize:'10px',color:C.text2,fontFamily:'monospace'}}>{data.trades}tx · {data.winRate}%wr</div></>}
              </div>
            })}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'16px',marginTop:'16px',justifyContent:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
            {[0.2,0.45,0.7,0.85,1].map(a=><div key={a} style={{width:'22px',height:'13px',borderRadius:'3px',background:`rgba(22,163,74,${0.15+a*0.7})`}}/>)}
            <span style={{fontSize:'10px',color:C.text2,fontFamily:'monospace',marginLeft:'4px'}}>PROFIT</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
            {[1,0.85,0.7,0.45,0.2].map(a=><div key={a} style={{width:'22px',height:'13px',borderRadius:'3px',background:`rgba(239,68,68,${0.15+a*0.7})`}}/>)}
            <span style={{fontSize:'10px',color:C.text2,fontFamily:'monospace',marginLeft:'4px'}}>LOSS</span>
          </div>
        </div>
      </div>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.border}}`}</style>
    </div>
  )
}
