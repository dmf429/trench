// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'

const C = {bg:'#06070b',bg2:'#0c0c10',bg3:'#1a1b23',bg4:'#22242d',text1:'#fcfcfc',text2:'#6b6b7a',text3:'#d4d4d8',accent:'#526fff',green:'#16a34a',green2:'#14f195',red:'#ef4444',yellow:'#eab308',border:'#1a1b23'}
const MARKETS=[{sym:'SOL-PERP',base:'SOL',id:'solana',vol:'$1.2B',oi:'$340M',funding:'+0.012%'},{sym:'BTC-PERP',base:'BTC',id:'bitcoin',vol:'$8.4B',oi:'$2.1B',funding:'+0.008%'},{sym:'ETH-PERP',base:'ETH',id:'ethereum',vol:'$3.2B',oi:'$890M',funding:'+0.010%'},{sym:'JUP-PERP',base:'JUP',id:'jupiter-exchange-solana',vol:'$120M',oi:'$45M',funding:'-0.005%'},{sym:'WIF-PERP',base:'WIF',id:'dogwifcoin',vol:'$340M',oi:'$98M',funding:'+0.018%'},{sym:'BONK-PERP',base:'BONK',id:'bonk',vol:'$89M',oi:'$23M',funding:'+0.022%'}]
const fmtN=(n,d=2)=>n>=1000?n.toLocaleString('en',{maximumFractionDigits:d}):n.toFixed(d)

export default function PerpsPage() {
  const [mkt,setMkt]=useState(MARKETS[0])
  const [prices,setPrices]=useState({})
  const [side,setSide]=useState('long')
  const [size,setSize]=useState('100')
  const [lev,setLev]=useState(5)
  const [orderType,setOrderType]=useState('market')
  const [limitPx,setLimitPx]=useState('')
  const [positions,setPositions]=useState([])
  const [tab,setTab]=useState('positions')
  const [ob,setOb]=useState({bids:[],asks:[]})

  useEffect(()=>{
    const ids=MARKETS.map(m=>m.id).join(',')
    const load=()=>fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`).then(r=>r.json()).then(d=>{const p={};MARKETS.forEach(m=>{p[m.sym]={price:d[m.id]?.usd||0,change:d[m.id]?.usd_24h_change||0}});setPrices(p)}).catch(()=>{})
    load();const iv=setInterval(load,15000);return()=>clearInterval(iv)
  },[])

  useEffect(()=>{
    const mp=prices[mkt.sym]?.price||100;if(!mp)return
    const sp=mp*0.0002
    setOb({asks:Array.from({length:10}).map((_,i)=>({price:(mp+sp+(i*mp*0.0001)).toFixed(4),size:(Math.random()*400+50).toFixed(1)})),bids:Array.from({length:10}).map((_,i)=>({price:(mp-sp-(i*mp*0.0001)).toFixed(4),size:(Math.random()*400+50).toFixed(1)}))})
  },[mkt.sym,prices])

  const curP=prices[mkt.sym]?.price||0
  const curC=prices[mkt.sym]?.change||0
  const notional=parseFloat(size||0)*lev
  const liqP=curP?(side==='long'?curP*(1-1/lev*0.9):curP*(1+1/lev*0.9)):0

  const openPos=()=>{
    if(!curP||!parseFloat(size))return
    setPositions(p=>[{id:Date.now(),sym:mkt.sym,side,size:parseFloat(size),lev,entryPrice:curP,notional,liqPrice:liqP,pnl:0,pnlPct:0},...p])
  }

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:C.bg,color:C.text1,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",overflow:'hidden',paddingLeft:'60px',backgroundImage:'radial-gradient(ellipse 60% 40% at 80% 0%,rgba(77,159,255,0.05) 0%,transparent 50%)'}}>
      <Sidebar active="/perps"/>
      <div style={{display:'flex',alignItems:'center',gap:'0',borderBottom:`1px solid ${C.border}`,background:C.bg,flexShrink:0,overflowX:'auto'}}>
        {MARKETS.map(m=>{const p=prices[m.sym];const act=mkt.sym===m.sym;return(
          <button key={m.sym} onClick={()=>setMkt(m)} style={{padding:'10px 16px',background:act?`${C.accent}18`:'transparent',border:'none',borderBottom:`2px solid ${act?C.accent:'transparent'}`,cursor:'pointer',flexShrink:0}}>
            <div style={{fontSize:'12px',fontWeight:'700',color:act?C.text1:C.text2}}>{m.sym}</div>
            <div style={{fontSize:'11px',color:p?.price?(p.change>=0?C.green:C.red):C.text2,fontWeight:'600'}}>{p?.price?'$'+fmtN(p.price,p.price<1?6:2):'—'}</div>
          </button>
        )})}
      </div>
      <div style={{flex:1,display:'grid',gridTemplateColumns:'180px 1fr 270px',overflow:'hidden'}}>
        {/* Order book */}
        <div style={{borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'8px 12px',borderBottom:`1px solid ${C.border}`,fontSize:'10px',fontWeight:'700',color:C.text2,fontFamily:'monospace',letterSpacing:'0.5px'}}>ORDER BOOK</div>
          <div style={{flex:1,overflowY:'auto',fontSize:'10px',fontFamily:'monospace'}}>
            {[...ob.asks].reverse().map((a,i)=><div key={'a'+i} style={{display:'grid',gridTemplateColumns:'1fr 1fr',padding:'2px 10px',position:'relative'}}><div style={{position:'absolute',right:0,top:0,bottom:0,background:'rgba(239,68,68,0.07)',width:(parseFloat(a.size)/450*100)+'%'}}/><span style={{color:C.red,zIndex:1}}>{parseFloat(a.price).toFixed(2)}</span><span style={{color:C.text2,textAlign:'right',zIndex:1}}>{a.size}</span></div>)}
            <div style={{padding:'5px 10px',background:`${C.accent}11`,textAlign:'center',fontWeight:'700',color:C.text1,borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}>${curP?fmtN(curP,curP<1?6:2):'—'} <span style={{color:curC>=0?C.green:C.red,fontSize:'9px'}}>{curC>=0?'+':''}{curC.toFixed(2)}%</span></div>
            {ob.bids.map((b,i)=><div key={'b'+i} style={{display:'grid',gridTemplateColumns:'1fr 1fr',padding:'2px 10px',position:'relative'}}><div style={{position:'absolute',right:0,top:0,bottom:0,background:'rgba(22,163,74,0.07)',width:(parseFloat(b.size)/450*100)+'%'}}/><span style={{color:C.green,zIndex:1}}>{parseFloat(b.price).toFixed(2)}</span><span style={{color:C.text2,textAlign:'right',zIndex:1}}>{b.size}</span></div>)}
          </div>
        </div>
        {/* Chart + positions */}
        <div style={{display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{display:'flex',gap:'20px',padding:'8px 16px',borderBottom:`1px solid ${C.border}`,flexShrink:0,overflowX:'auto'}}>
            {[['Mark','$'+(curP?fmtN(curP,curP<1?6:2):'—'),curC>=0?C.green:C.red],['24h',(curC>=0?'+':'')+curC.toFixed(2)+'%',curC>=0?C.green:C.red],['Volume',mkt.vol,C.text1],['OI',mkt.oi,C.text1],['Funding',mkt.funding,mkt.funding.startsWith('+')?C.green:C.red]].map(([l,v,color])=>(
              <div key={l} style={{flexShrink:0}}><div style={{fontSize:'9px',color:C.text2,fontFamily:'monospace',marginBottom:'2px'}}>{l}</div><div style={{fontSize:'13px',fontWeight:'700',color}}>{v}</div></div>
            ))}
          </div>
          <div style={{flex:1,background:'#080810',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'10px'}}>
            <div style={{fontSize:'32px',color:C.text2}}>📊</div>
            <div style={{fontSize:'13px',color:C.text2}}>{mkt.sym} · Paper Trading</div>
            <a href={`https://www.tradingview.com/chart/?symbol=BINANCE:${mkt.base}USDT`} target="_blank" rel="noreferrer" style={{fontSize:'11px',color:C.accent,border:`1px solid ${C.accent}44`,padding:'6px 14px',textDecoration:'none',borderRadius:'6px'}}>Open TradingView ↗</a>
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,height:'180px',display:'flex',flexDirection:'column',flexShrink:0}}>
            <div style={{display:'flex',borderBottom:`1px solid ${C.border}`}}>
              {[['positions','POSITIONS ('+positions.length+')'],['orders','ORDERS (0)']].map(([v,l])=><button key={v} onClick={()=>setTab(v)} style={{padding:'8px 14px',background:'transparent',border:'none',borderBottom:`2px solid ${tab===v?C.accent:'transparent'}`,color:tab===v?C.text1:C.text2,fontSize:'10px',fontWeight:'700',cursor:'pointer'}}>{l}</button>)}
            </div>
            <div style={{flex:1,overflowY:'auto'}}>
              {tab==='positions'&&(positions.length===0?<div style={{padding:'20px',textAlign:'center',color:C.text2,fontSize:'12px'}}>No open positions</div>:
              positions.map(p=><div key={p.id} style={{display:'grid',gridTemplateColumns:'80px 55px 70px 50px 80px 80px 70px 1fr',padding:'7px 16px',borderBottom:`1px solid ${C.border}`,alignItems:'center',fontSize:'10px',fontFamily:'monospace'}}>
                <span style={{fontWeight:'700',color:C.text1}}>{p.sym}</span>
                <span style={{color:p.side==='long'?C.green:C.red,fontWeight:'700'}}>{p.side.toUpperCase()}</span>
                <span>${p.size}</span><span>{p.lev}x</span>
                <span style={{color:C.text2}}>${fmtN(p.entryPrice,2)}</span>
                <span style={{color:C.red}}>${fmtN(p.liqPrice,2)}</span>
                <span style={{color:p.pnl>=0?C.green:C.red,fontWeight:'700'}}>{p.pnl>=0?'+':''}${p.pnl.toFixed(2)}</span>
                <button onClick={()=>setPositions(ps=>ps.filter(x=>x.id!==p.id))} style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:C.red,fontSize:'9px',fontWeight:'700',padding:'3px 7px',cursor:'pointer',borderRadius:'4px'}}>CLOSE</button>
              </div>))}
              {tab==='orders'&&<div style={{padding:'20px',textAlign:'center',color:C.text2,fontSize:'12px'}}>No open orders</div>}
            </div>
          </div>
        </div>
        {/* Order panel */}
        <div style={{borderLeft:`1px solid ${C.border}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',flexShrink:0}}>
            <button onClick={()=>setSide('long')} style={{padding:'12px',background:side==='long'?'rgba(22,163,74,0.12)':'transparent',border:'none',borderBottom:`2px solid ${side==='long'?C.green:'transparent'}`,color:side==='long'?C.green:C.text2,fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>LONG</button>
            <button onClick={()=>setSide('short')} style={{padding:'12px',background:side==='short'?'rgba(239,68,68,0.12)':'transparent',border:'none',borderBottom:`2px solid ${side==='short'?C.red:'transparent'}`,color:side==='short'?C.red:C.text2,fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>SHORT</button>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'14px'}}>
            <div style={{display:'flex',marginBottom:'12px',background:C.bg2,border:`1px solid ${C.border}`,borderRadius:'8px',overflow:'hidden'}}>
              {['market','limit'].map(t=><button key={t} onClick={()=>setOrderType(t)} style={{flex:1,padding:'7px',background:orderType===t?`${C.accent}22`:'transparent',border:'none',borderBottom:`2px solid ${orderType===t?C.accent:'transparent'}`,color:orderType===t?C.text1:C.text2,fontSize:'11px',fontWeight:'700',cursor:'pointer',textTransform:'uppercase'}}>{t}</button>)}
            </div>
            <div style={{marginBottom:'10px'}}>
              <div style={{fontSize:'10px',color:C.text2,fontFamily:'monospace',marginBottom:'4px'}}>SIZE (USD)</div>
              <div style={{display:'flex',background:C.bg2,border:`1px solid ${C.border}`,borderRadius:'8px',overflow:'hidden'}}>
                <input value={size} onChange={e=>setSize(e.target.value)} style={{flex:1,background:'transparent',border:'none',color:C.text1,fontSize:'14px',padding:'9px 11px',outline:'none'}}/>
                <div style={{padding:'9px 11px',fontSize:'11px',color:C.text2,borderLeft:`1px solid ${C.border}`}}>USD</div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'4px',marginTop:'5px'}}>
                {['25','50','100','500'].map(v=><button key={v} onClick={()=>setSize(v)} style={{background:size===v?`${C.accent}22`:C.bg2,border:`1px solid ${size===v?C.accent:C.border}`,color:size===v?C.accent:C.text2,fontSize:'10px',fontWeight:'600',padding:'4px',cursor:'pointer',borderRadius:'4px'}}>${v}</button>)}
              </div>
            </div>
            <div style={{marginBottom:'12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:C.text2,fontFamily:'monospace',marginBottom:'6px'}}><span>LEVERAGE</span><span style={{color:C.text1,fontWeight:'700'}}>{lev}x</span></div>
              <input type="range" min="1" max="20" value={lev} onChange={e=>setLev(parseInt(e.target.value))} style={{width:'100%',accentColor:C.accent}}/>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'9px',color:C.text2,fontFamily:'monospace',marginTop:'2px'}}><span>1x</span><span>5x</span><span>10x</span><span>20x</span></div>
            </div>
            {orderType==='limit'&&<div style={{marginBottom:'10px'}}><div style={{fontSize:'10px',color:C.text2,fontFamily:'monospace',marginBottom:'4px'}}>LIMIT PRICE</div><input value={limitPx} onChange={e=>setLimitPx(e.target.value)} placeholder={curP?'$'+fmtN(curP,2):''} style={{width:'100%',background:C.bg2,border:`1px solid ${C.border}`,color:C.text1,fontSize:'13px',padding:'9px 11px',outline:'none',borderRadius:'8px',boxSizing:'border-box'}}/></div>}
            <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:'8px',padding:'10px',marginBottom:'12px'}}>
              {[['Notional','$'+fmtN(notional,2)],['Margin','$'+fmtN(notional/lev,2)],['Liq Price',curP?'$'+fmtN(liqP,curP<10?4:2):'—'],['Est Fee','~$'+(notional*0.0006).toFixed(2)]].map(([l,v])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:'11px',marginBottom:'4px'}}><span style={{color:C.text2,fontFamily:'monospace'}}>{l}</span><span style={{color:C.text1,fontWeight:'600'}}>{v}</span></div>
              ))}
            </div>
            <button onClick={openPos} style={{width:'100%',padding:'12px',background:side==='long'?C.green:C.red,border:'none',color:'#fff',fontSize:'13px',fontWeight:'700',cursor:'pointer',borderRadius:'8px'}}>
              {side==='long'?'▲ LONG':'▼ SHORT'} {mkt.base} {lev}x
            </button>
            <div style={{marginTop:'8px',fontSize:'10px',color:C.text2,textAlign:'center',fontFamily:'monospace'}}>Paper trading · Jupiter Perps integration soon</div>
          </div>
        </div>
      </div>
      <style>{`*{box-sizing:border-box}input[type=range]{-webkit-appearance:none;height:3px;background:${C.border};border-radius:2px}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;background:${C.accent};border-radius:50%;cursor:pointer}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:${C.border}}`}</style>
    </div>
  )
}
