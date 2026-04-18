// @ts-nocheck
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Nav from '../../components/Nav'
import * as web3 from '@solana/web3.js'

const HELIUS_KEY = '870dfde6-09ec-48bd-95b8-202303d15c5b'
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
const DEVNET_RPC = 'https://api.devnet.solana.com'
let cachedSolPrice = 150

const fmt = (n) => { if(!n||n===0) return '$0'; if(n>=1e6) return `$${(n/1e6).toFixed(1)}M`; if(n>=1000) return `$${(n/1000).toFixed(1)}K`; return `$${n.toFixed(0)}` }
const elapsed = (ts) => { const s=Math.floor((Date.now()-ts)/1000); if(s<60) return `${s}s`; if(s<3600) return `${Math.floor(s/60)}m`; return `${Math.floor(s/3600)}h` }
const tr = (a,n=4) => a?`${a.slice(0,n)}...${a.slice(-n)}`:''
const COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FF9F43','#A29BFE','#FD79A8','#6C5CE7','#00B894','#E17055','#74B9FF','#55EFC4']

async function fetchSolPrice() {
  try { const r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'); const d=await r.json(); cachedSolPrice=d?.solana?.usd??150 } catch {}
  return cachedSolPrice
}

function pairToToken(p, stage) {
  const mcap = p.marketCap??p.fdv??0
  const bc = p.dexId==='pumpfun' ? Math.min(99,Math.round((mcap/69000)*100)) : 100
  return {
    id: p.pairAddress, symbol: p.baseToken?.symbol??'???', name: p.baseToken?.name??'Unknown',
    address: p.baseToken?.address??'', pairAddress: p.pairAddress,
    color: COLORS[Math.abs((p.pairAddress?.charCodeAt(0)??0)+(p.pairAddress?.charCodeAt(1)??0))%COLORS.length],
    price: parseFloat(p.priceUsd??'0'), marketCap: mcap, liquidity: p.liquidity?.usd??0,
    volume5m: p.volume?.m5??0, volume1h: p.volume?.h1??0,
    priceChange5m: p.priceChange?.m5??0, priceChange1h: p.priceChange?.h1??0,
    buys5m: p.txns?.m5?.buys??0, sells5m: p.txns?.m5?.sells??0,
    buys1h: p.txns?.h1?.buys??0, sells1h: p.txns?.h1?.sells??0,
    age: Date.now()-(p.pairCreatedAt??Date.now()), bondingCurve: bc,
    holders: 0, stage, logoUri: p.info?.imageUrl??null, dexId: p.dexId, supply: '1B',
    website: p.info?.websites?.[0]?.url??null,
    twitter: p.info?.socials?.find(s=>s.type==='twitter')?.url??null,
    telegram: p.info?.socials?.find(s=>s.type==='telegram')?.url??null,
    globalFeesPaid: ((mcap/1e6)*0.001).toFixed(4), pairCreatedAt: p.pairCreatedAt,
  }
}

async function dexSearch(q) {
  try { const r=await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`); const d=await r.json(); return d.pairs??[] } catch { return [] }
}

async function loadPairs() {
  const [r1,r2,r3,r4,r5] = await Promise.all([dexSearch('pumpfun'),dexSearch('pump sol'),dexSearch('solana pump new'),dexSearch('pumpswap'),dexSearch('solana meme')])
  const all = [...r1,...r2,...r3,...r4,...r5].filter(p=>p.chainId==='solana')
  all.sort((a,b)=>(b.pairCreatedAt??0)-(a.pairCreatedAt??0))
  const seenP=new Set(), seenA=new Set(), newP=[], stretchP=[], migratedP=[]
  for (const p of all) {
    if(seenP.has(p.pairAddress)) continue; seenP.add(p.pairAddress)
    const mcap=p.marketCap??p.fdv??0, dex=p.dexId
    if(dex==='pumpfun') {
      // pumpfun bonding curve - filter by having any activity
      if(mcap<500 && (p.liquidity?.usd??0)<50) continue
      const addr=p.baseToken?.address; if(addr&&seenA.has(addr)) continue; if(addr) seenA.add(addr)
      if(mcap>=55000) stretchP.push(pairToToken(p,'stretch')); else newP.push(pairToToken(p,'new'))
    } else if(['pumpswap','raydium','meteora','orca'].includes(dex)) {
      if((p.liquidity?.usd??0)<500) continue; migratedP.push(pairToToken(p,'migrated'))
    }
  }
  return { newP:newP.slice(0,20), stretchP:stretchP.slice(0,20), migratedP:migratedP.slice(0,20) }
}

async function fetchRealHolders(tokenAddress) {
  try {
    const res=await fetch(HELIUS_RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getTokenAccounts',params:{mint:tokenAddress,limit:1000}})})
    const data=await res.json()
    const accounts=(data?.result?.token_accounts??[]).filter(a=>parseFloat(a.amount)>0)
    const total=accounts.reduce((s,a)=>s+parseFloat(a.amount),0)
    return {
      count: accounts.length,
      holders: accounts.slice(0,15).map((acc,i)=>({
        rank:i+1, wallet:acc.address,
        pct:((parseFloat(acc.amount)/total)*100).toFixed(2),
        tokens:parseFloat(acc.amount),
        type:i===0?'LP':''
      }))
    }
  } catch { return {count:0,holders:[]} }
}

async function fetchRealTrades(tokenAddress, tokenMcap) {
  try {
    const res=await fetch(`https://api.helius.xyz/v0/addresses/${tokenAddress}/transactions?api-key=${HELIUS_KEY}&limit=25&type=SWAP`)
    const txns=await res.json()
    if(!Array.isArray(txns)) return []
    const now=Date.now()/1000
    return txns.filter(t=>(t.timestamp??0)>now-86400).slice(0,20).map((t,i)=>{
      const transfers=t.tokenTransfers??[], nativeXfers=t.nativeTransfers??[]
      const tokenXfer=transfers.find(x=>x.mint===tokenAddress)
      const isBuy=tokenXfer?tokenXfer.toUserAccount===t.feePayer:true
      const largestNative=nativeXfers.reduce((max,x)=>x.amount>max.amount?x:max,{amount:0})
      const solAmt=largestNative.amount/1e9
      const age=Math.floor(now-(t.timestamp??now))
      return {
        id:i, sig:t.signature,
        age:age<60?`${age}s`:age<3600?`${Math.floor(age/60)}m`:`${Math.floor(age/3600)}h`,
        type:isBuy?'Buy':'Sell', isBuy, mc:tokenMcap,
        solAmount:solAmt.toFixed(4), usdValue:(solAmt*cachedSolPrice).toFixed(2),
        wallet:t.feePayer??'', source:t.source??'', timestamp:t.timestamp,
      }
    })
  } catch { return [] }
}

async function fetchTopTraders(tokenAddress) {
  try {
    const res=await fetch(`https://api.helius.xyz/v0/addresses/${tokenAddress}/transactions?api-key=${HELIUS_KEY}&limit=100&type=SWAP`)
    const txns=await res.json()
    if(!Array.isArray(txns)) return []
    const traders={}
    for(const t of txns) {
      const transfers=t.tokenTransfers??[], nativeXfers=t.nativeTransfers??[]
      const tokenXfer=transfers.find(x=>x.mint===tokenAddress)
      const isBuy=tokenXfer?tokenXfer.toUserAccount===t.feePayer:true
      const solAmt=(nativeXfers.reduce((max,x)=>x.amount>max.amount?x:max,{amount:0}).amount)/1e9
      const wallet=t.feePayer??'unknown'
      if(!traders[wallet]) traders[wallet]={wallet,bought:0,sold:0,txns:0}
      if(isBuy) traders[wallet].bought+=solAmt; else traders[wallet].sold+=solAmt
      traders[wallet].txns++
    }
    return Object.values(traders).sort((a,b)=>(b.bought+b.sold)-(a.bought+a.sold)).slice(0,10).map((t,i)=>({
      rank:i+1, wallet:t.wallet, bought:t.bought.toFixed(3), sold:t.sold.toFixed(3),
      pnl:(t.sold-t.bought).toFixed(3), txns:t.txns, isProfitable:t.sold>t.bought
    }))
  } catch { return [] }
}

export default function RadarPage() {
  const [newPairs,setNewPairs]=useState([])
  const [stretch,setStretch]=useState([])
  const [migrated,setMigrated]=useState([])
  const [selected,setSelected]=useState(null)
  const [wallet,setWallet]=useState(null)
  const [solPrice,setSolPrice]=useState(150)
  const [buyAmount,setBuyAmount]=useState('0.1')
  const [positions,setPositions]=useState([])
  const [txStatus,setTxStatus]=useState(null)
  const [txMsg,setTxMsg]=useState('')
  const [bottomTab,setBottomTab]=useState('trades')
  const [sideTab,setSideTab]=useState('buy')
  const [searchQuery,setSearchQuery]=useState('')
  const [searchResults,setSearchResults]=useState([])
  const [searching,setSearching]=useState(false)
  const [showSearch,setShowSearch]=useState(false)
  const [bubbleView,setBubbleView]=useState(0)
  const [loading,setLoading]=useState(true)
  const [holders,setHolders]=useState([])
  const [trades,setTrades]=useState([])
  const [topTraders,setTopTraders]=useState([])
  const [pnlInSol,setPnlInSol]=useState(true)
  const searchTimeout=useRef(null)
  const conn=useRef(new web3.Connection(DEVNET_RPC,'confirmed'))
  const pumpWs=useRef(null)
  const [wsConnected,setWsConnected]=useState(false)

  useEffect(()=>{ fetchSolPrice().then(p=>setSolPrice(p)); const iv=setInterval(()=>fetchSolPrice().then(p=>setSolPrice(p)),30000); return()=>clearInterval(iv) },[])

  // Pump.fun real-time WebSocket for new pairs
  useEffect(()=>{
    let ws, reconnectTimer
    const connect = () => {
      try {
        ws = new WebSocket('wss://pumpportal.fun/api/data')
        pumpWs.current = ws
        ws.onopen = () => {
          setWsConnected(true)
          // Subscribe to new token creation events
          ws.send(JSON.stringify({method:'subscribeNewToken'}))
          // Subscribe to migration events
          ws.send(JSON.stringify({method:'subscribeMigration'}))
        }
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)
            if (data.txType === 'create') {
              // New token created on pump.fun
              const newToken = {
                id: data.signature || data.mint,
                symbol: data.symbol || '???',
                name: data.name || 'New Token',
                address: data.mint || '',
                pairAddress: data.mint || '',
                color: COLORS[Math.abs((data.mint?.charCodeAt(0)||0)+(data.mint?.charCodeAt(1)||0))%COLORS.length],
                price: 0, marketCap: 0, liquidity: 0,
                volume5m: 0, volume1h: 0, priceChange5m: 0, priceChange1h: 0,
                buys5m: 0, sells5m: 0, buys1h: 0, sells1h: 0,
                age: 0, bondingCurve: 0, holders: 0,
                stage: 'new', logoUri: data.image || null, dexId: 'pumpfun',
                supply: '1B', website: data.website || null,
                twitter: data.twitter || null, telegram: data.telegram || null,
                globalFeesPaid: '0', pairCreatedAt: Date.now(),
              }
              setNewPairs(prev => [newToken, ...prev].slice(0,20))
            } else if (data.txType === 'migrate') {
              // Token graduated and migrated
              setNewPairs(prev => prev.filter(t => t.address !== data.mint))
              setStretch(prev => prev.filter(t => t.address !== data.mint))
            }
          } catch {}
        }
        ws.onclose = () => {
          setWsConnected(false)
          // Reconnect after 3s
          reconnectTimer = setTimeout(connect, 3000)
        }
        ws.onerror = () => ws.close()
      } catch {}
    }
    connect()
    return () => {
      clearTimeout(reconnectTimer)
      if (ws) ws.close()
    }
  },[])

  const refreshPairs=useCallback(async()=>{ const {newP,stretchP,migratedP}=await loadPairs(); setNewPairs(newP); setStretch(stretchP); setMigrated(migratedP); setLoading(false) },[])
  useEffect(()=>{ refreshPairs(); const iv=setInterval(refreshPairs,15000); return()=>clearInterval(iv) },[refreshPairs])

  useEffect(()=>{
    if(!selected) return
    const iv=setInterval(async()=>{
      try {
        const r=await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${selected.pairAddress}`)
        const d=await r.json(); const p=d.pair; if(!p) return
        setSelected(s=>s?{...s,price:parseFloat(p.priceUsd??'0'),marketCap:p.marketCap??p.fdv??s.marketCap,liquidity:p.liquidity?.usd??s.liquidity,volume5m:p.volume?.m5??s.volume5m,volume1h:p.volume?.h1??s.volume1h,priceChange5m:p.priceChange?.m5??s.priceChange5m,buys5m:p.txns?.m5?.buys??s.buys5m,sells5m:p.txns?.m5?.sells??s.sells5m,buys1h:p.txns?.h1?.buys??s.buys1h,sells1h:p.txns?.h1?.sells??s.sells1h,globalFeesPaid:((p.marketCap/1e6)*0.001).toFixed(4)}:null)
      } catch {}
    },5000)
    return()=>clearInterval(iv)
  },[selected?.pairAddress])

  useEffect(()=>{
    if(!selected?.address) return
    let cancelled=false
    const load=async()=>{
      const [tData,hData,trData]=await Promise.allSettled([fetchRealTrades(selected.address,selected.marketCap),fetchRealHolders(selected.address),fetchTopTraders(selected.address)])
      if(cancelled) return
      if(tData.status==='fulfilled'&&tData.value.length>0) setTrades(tData.value)
      if(hData.status==='fulfilled'&&hData.value.count>0) { setHolders(hData.value.holders); setSelected(s=>s?{...s,holders:hData.value.count}:null) }
      if(trData.status==='fulfilled') setTopTraders(trData.value)
    }
    load()
    const iv=setInterval(()=>{ fetchRealTrades(selected.address,selected.marketCap).then(t=>{if(!cancelled&&t.length>0)setTrades(t)}) },8000)
    return()=>{cancelled=true;clearInterval(iv)}
  },[selected?.id])

  useEffect(()=>{
    const saved=localStorage.getItem('trench_radar_wallet')
    if(!saved) return
    const data=JSON.parse(saved); setWallet(data)
    conn.current.getBalance(new web3.PublicKey(data.publicKey)).then(b=>setWallet(w=>w?{...w,balance:b/web3.LAMPORTS_PER_SOL}:null)).catch(()=>{})
  },[])

  const generateWallet=async()=>{
    const kp=web3.Keypair.generate()
    const ALPHA='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    function b58(bytes){let d=[0];for(let i=0;i<bytes.length;i++){let c=bytes[i];for(let j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=(c/58)|0}while(c>0){d.push(c%58);c=(c/58)|0}}let r='';for(let i=0;i<bytes.length&&bytes[i]===0;i++)r+='1';for(let i=d.length-1;i>=0;i--)r+=ALPHA[d[i]];return r}
    const data={publicKey:kp.publicKey.toString(),secretKey:Array.from(kp.secretKey),privateKeyBase58:b58(kp.secretKey),balance:0,network:'devnet'}
    localStorage.setItem('trench_radar_wallet',JSON.stringify(data)); setWallet(data)
  }

  const airdrop=async()=>{
    if(!wallet) return; setTxStatus('pending'); setTxMsg('REQUESTING...')
    for(const rpc of ['https://api.devnet.solana.com','https://rpc.ankr.com/solana_devnet']) {
      try {
        const c=new web3.Connection(rpc,{commitment:'confirmed',confirmTransactionInitialTimeout:20000})
        const pk=new web3.PublicKey(wallet.publicKey)
        await c.requestAirdrop(pk,2*web3.LAMPORTS_PER_SOL); setTxMsg('CONFIRMING...')
        for(let i=0;i<20;i++) {
          await new Promise(r=>setTimeout(r,1500))
          const bal=await c.getBalance(pk).catch(()=>0)
          if(bal>0){setWallet(w=>({...w,balance:bal/web3.LAMPORTS_PER_SOL}));setTxStatus('success');setTxMsg('2 SOL AIRDROPPED!');setTimeout(()=>{setTxStatus(null);setTxMsg('')},3000);return}
        }
        break
      } catch {}
    }
    setTxStatus('error');setTxMsg('USE faucet.solana.com');setTimeout(()=>{setTxStatus(null);setTxMsg('')},5000)
  }

  const buy=async()=>{
    if(!wallet||!selected) return
    const amt=parseFloat(buyAmount)
    if(isNaN(amt)||amt<=0||amt>(wallet.balance||0)){setTxStatus('error');setTxMsg('INSUFFICIENT SOL');setTimeout(()=>{setTxStatus(null);setTxMsg('')},2000);return}
    setTxStatus('pending');setTxMsg('SIMULATING BUY...')
    await new Promise(r=>setTimeout(r,800))
    const tokensReceived=(amt/Math.max(selected.price,1e-12))*0.97
    setPositions(prev=>[{id:Math.random().toString(36).slice(2),token:{...selected},entryPrice:selected.price,tokensHeld:tokensReceived,solSpent:amt,usdSpent:amt*solPrice,currentPrice:selected.price,pnlSol:0,pnlUsd:0,pnlPct:0,entryTime:Date.now()},...prev])
    setWallet(w=>({...w,balance:(w.balance||0)-amt}))
    setTxStatus('success');setTxMsg(`BOUGHT ${tokensReceived.toExponential(2)} ${selected.symbol}`)
    setSideTab('sell');setTimeout(()=>{setTxStatus(null);setTxMsg('')},3000)
  }

  useEffect(()=>{
    if(!selected) return
    setPositions(prev=>prev.map(pos=>{
      if(pos.token.id!==selected.id) return pos
      const curVal=pos.tokensHeld*selected.price
      const pnlUsd=curVal-pos.usdSpent
      const pnlSol=pnlUsd/solPrice
      const pnlPct=(pnlUsd/pos.usdSpent)*100
      return {...pos,currentPrice:selected.price,pnlSol,pnlUsd,pnlPct}
    }))
  },[selected?.price,solPrice])

  const sellPosition=(posId,pct=100)=>{
    const pos=positions.find(p=>p.id===posId); if(!pos) return
    const frac=pct/100
    const solReturned=(pos.tokensHeld*frac*pos.currentPrice)/solPrice*0.97
    setWallet(w=>({...w,balance:(w.balance||0)+solReturned}))
    if(pct===100) setPositions(prev=>prev.filter(p=>p.id!==posId))
    else setPositions(prev=>prev.map(p=>p.id===posId?{...p,tokensHeld:p.tokensHeld*(1-frac),solSpent:p.solSpent*(1-frac),usdSpent:p.usdSpent*(1-frac)}:p))
  }

  useEffect(()=>{
    clearTimeout(searchTimeout.current)
    if(searchQuery.length>=2) searchTimeout.current=setTimeout(async()=>{ setSearching(true); try{const r=await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(searchQuery)}`);const d=await r.json();setSearchResults((d.pairs??[]).filter(p=>p.chainId==='solana').slice(0,8))}catch{setSearchResults([])}; setSearching(false) },200)
    else setSearchResults([])
  },[searchQuery])

  const selectToken=(token)=>{setSelected(token);setSideTab('buy');setBottomTab('trades');setShowSearch(false);setSearchQuery('')}

  const pos=positions.find(p=>p.token.id===selected?.id)
  const posValueUsd=pos?pos.tokensHeld*(selected?.price??0):0
  const posPnlUsd=pos?posValueUsd-pos.usdSpent:0
  const posPnlSol=pos?posPnlUsd/solPrice:0
  const posPnlPct=pos&&pos.usdSpent>0?(posPnlUsd/pos.usdSpent)*100:0

  const BubbleMap=({view,token})=>{
    const labels=['Top Holders','Dev & Insiders','Bundlers','Snipers']
    const cols=[['#00FF88','#FFD700','#FF6B6B'],['#FF3366','#FF8800'],['#0088ff','#6C5CE7'],['#FFD700','#FF3366']]
    const n=[12,6,8,7][view], seed=token?.id||'x'
    const bubbles=Array.from({length:n},(_,i)=>{const h=seed.charCodeAt(i%seed.length)||65;return{x:10+((h*137+i*89)%80),y:10+((h*71+i*53)%75),r:4+((h+i)%8),color:cols[view][(h+i)%cols[view].length],pct:((h+i*3)%15+0.5).toFixed(1)+'%'}})
    return (
      <div style={{flex:1,position:'relative',background:'#050508',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'6px',left:'8px',fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',zIndex:2}}>{labels[view]}</div>
        <svg width="100%" height="100%" viewBox="0 0 100 100" style={{position:'absolute',inset:0}}>
          {bubbles.slice(0,4).map((b,i)=>bubbles.slice(i+1,i+2).map((b2,j)=>(<line key={`l${i}${j}`} x1={b.x} y1={b.y} x2={b2.x} y2={b2.y} stroke="#1a1a2e" strokeWidth="0.2" opacity="0.5"/>)))}
          {bubbles.map((b,i)=>(<g key={i}><circle cx={b.x} cy={b.y} r={b.r} fill={b.color} opacity="0.8"/>{b.r>5&&<text x={b.x} y={b.y+0.8} textAnchor="middle" fontSize="2" fill="#050508" fontFamily="monospace">{b.pct}</text>}</g>))}
        </svg>
      </div>
    )
  }

  const TokenCard=({token})=>{
    const up=token.priceChange5m>=0, isSel=selected?.id===token.id
    return (
      <div onClick={()=>selectToken(token)} style={{background:isSel?'rgba(0,255,136,0.05)':'#0a0a10',border:`1px solid ${isSel?'rgba(0,255,136,0.35)':'#1a1a2e'}`,padding:'10px 9px',cursor:'pointer',marginBottom:'4px',borderLeft:isSel?'2px solid #00FF88':'2px solid transparent'}} onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background='#0d0d18'}} onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background='#0a0a10'}}>
        <div style={{display:'flex',alignItems:'center',gap:'7px',marginBottom:'6px'}}>
          {token.logoUri?(<img src={token.logoUri} alt="" style={{width:'32px',height:'32px',borderRadius:'50%',objectFit:'cover',flexShrink:0}} onError={e=>e.target.style.display='none'}/>):(<div style={{width:'32px',height:'32px',borderRadius:'50%',background:token.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'14px',color:'#050508',flexShrink:0}}>{token.symbol[0]}</div>)}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',color:'#e0e0f0',fontWeight:'bold'}}>{token.symbol}</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{token.name}</div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:up?'#00FF88':'#FF3366',fontWeight:'bold'}}>{up?'+':''}{token.priceChange5m.toFixed(1)}%</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{elapsed(token.age)}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'3px',marginBottom:'6px'}}>
          {[['V',fmt(token.volume5m),'#e0e0f0'],['MC',fmt(token.marketCap),'#FFD700'],['B',token.buys5m,'#00FF88'],['S',token.sells5m,'#FF3366']].map(([l,v,c])=>(<div key={l} style={{textAlign:'center',background:'#070710',padding:'3px 2px'}}><div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c'}}>{l}</div><div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:c}}>{v}</div></div>))}
        </div>
        <div style={{marginBottom:'6px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'2px'}}>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c'}}>BONDING</span>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:token.bondingCurve>80?'#FF3366':token.bondingCurve>50?'#FFD700':'#00FF88'}}>{token.bondingCurve}%</span>
          </div>
          <div style={{height:'2px',background:'#1a1a2e',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${token.bondingCurve}%`,background:token.bondingCurve>80?'#FF3366':token.bondingCurve>50?'#FFD700':'#00FF88'}}/>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{fmt(token.liquidity)} liq</span>
          <button onClick={e=>{e.stopPropagation();selectToken(token);setSideTab('buy')}} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'3px 8px',background:'rgba(0,255,136,0.1)',border:'1px solid rgba(0,255,136,0.3)',color:'#00FF88',cursor:'pointer'}}>BUY</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#050508',color:'#e0e0f0',overflow:'hidden'}}>
      <Nav active="/radar"/>
      {txStatus&&<div style={{position:'fixed',top:'60px',right:'20px',zIndex:9999,padding:'8px 16px',background:txStatus==='success'?'rgba(0,255,136,0.1)':txStatus==='error'?'rgba(255,51,102,0.1)':'rgba(10,10,16,0.95)',border:`1px solid ${txStatus==='success'?'rgba(0,255,136,0.4)':txStatus==='error'?'rgba(255,51,102,0.4)':'#1a1a2e'}`,fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:txStatus==='success'?'#00FF88':txStatus==='error'?'#FF3366':'#6666aa',letterSpacing:'1px'}}>
        {txStatus==='pending'?`${txMsg}`:txStatus==='success'?`${txMsg}`:`${txMsg}`}
      </div>}
      {showSearch&&(
        <div style={{position:'fixed',inset:0,zIndex:500,background:'rgba(5,5,8,0.88)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'70px'}} onClick={()=>{setShowSearch(false);setSearchQuery('')}}>
          <div style={{width:'600px',background:'#0a0a10',border:'1px solid #1a1a2e'}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:'10px 14px',borderBottom:'1px solid #1a1a2e',display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{color:'#3a3a5c',fontSize:'14px'}}>⌕</span>
              <input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Escape'&&(setShowSearch(false),setSearchQuery(''))} placeholder="Search by name, ticker, or paste CA..." style={{flex:1,background:'transparent',border:'none',color:'#e0e0f0',fontFamily:"'Share Tech Mono',monospace",fontSize:'13px',outline:'none'}}/>
              {searching&&<span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>...</span>}
            </div>
            <div style={{maxHeight:'400px',overflowY:'auto'}}>
              {searchResults.length===0&&searchQuery.length>=2&&!searching&&<div style={{padding:'20px',textAlign:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#3a3a5c'}}>No results</div>}
              {searchResults.map(p=>{
                const t=pairToToken(p,['raydium','meteora','orca','pumpswap'].includes(p.dexId)?'migrated':(p.marketCap??0)>55000?'stretch':'new')
                return (
                  <div key={p.pairAddress} onClick={()=>selectToken(t)} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid #0d0d18'}} onMouseEnter={e=>e.currentTarget.style.background='#0d0d18'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {p.info?.imageUrl?(<img src={p.info.imageUrl} alt="" style={{width:'36px',height:'36px',borderRadius:'50%',objectFit:'cover',flexShrink:0}} onError={e=>e.target.style.display='none'}/>):(<div style={{width:'36px',height:'36px',borderRadius:'50%',background:t.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'14px',color:'#050508',flexShrink:0}}>{t.symbol[0]}</div>)}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'2px'}}>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',color:'#e0e0f0',fontWeight:'bold'}}>{p.baseToken?.symbol}</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',padding:'1px 5px',background:'rgba(0,136,255,0.1)',color:'#0088ff',border:'1px solid rgba(0,136,255,0.2)',flexShrink:0,marginLeft:'auto'}}>{p.dexId}</span>
                      </div>
                      <div style={{display:'flex',gap:'12px'}}>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa'}}>MC {fmt(p.marketCap??p.fdv)}</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#6666aa'}}>L {fmt(p.liquidity?.usd)}</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:(p.priceChange?.h24??0)>=0?'#00FF88':'#FF3366'}}>{(p.priceChange?.h24??0)>=0?'+':''}{(p.priceChange?.h24??0).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
      <div style={{display:'flex',flex:1,overflow:'hidden',marginTop:'52px'}}>
        {!selected?(
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'8px 14px',borderBottom:'1px solid #1a1a2e',background:'#070710',display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'6px',flexShrink:0}}>
                <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#FF3366',animation:'rp 1s infinite',boxShadow:'0 0 6px #FF336688'}}/>
                <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'16px',letterSpacing:'3px'}}>RADAR</span>
              </div>
              <div onClick={()=>setShowSearch(true)} style={{flex:1,display:'flex',alignItems:'center',gap:'8px',background:'#0a0a10',border:'1px solid #1a1a2e',padding:'6px 12px',cursor:'text'}} onMouseEnter={e=>e.currentTarget.style.borderColor='#3a3a5c'} onMouseLeave={e=>e.currentTarget.style.borderColor='#1a1a2e'}>
                <span style={{color:'#3a3a5c',fontSize:'12px'}}>⌕</span>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:'#3a3a5c'}}>Search by name, ticker, or paste CA...</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'3px'}}>
                <div style={{width:'5px',height:'5px',borderRadius:'50%',background:wsConnected?'#00FF88':'#FF3366',boxShadow:wsConnected?'0 0 4px #00FF8888':undefined}}/>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:wsConnected?'#00FF88':'#FF3366'}}>{wsConnected?'LIVE':'CONNECTING'}</span>
              </div>
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#3a3a5c'}}>◎ {solPrice.toFixed(0)} · {newPairs.length+stretch.length+migrated.length} PAIRS</span>
            </div>
            </div>
            <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',overflow:'hidden'}}>
              {[{label:'NEW PAIRS',color:'#00FF88',tokens:newPairs,desc:'Pump.fun bonding curve'},{label:'FINAL STRETCH',color:'#FFD700',tokens:stretch,desc:'Near $69K graduation'},{label:'MIGRATED',color:'#0088ff',tokens:migrated,desc:'PumpSwap/Raydium'}].map((col,ci)=>(
                <div key={col.label} style={{display:'flex',flexDirection:'column',overflow:'hidden',borderRight:ci<2?'1px solid #1a1a2e':'none'}}>
                  <div style={{padding:'8px 10px',borderBottom:'1px solid #1a1a2e',background:'#050508',flexShrink:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
                      <div style={{width:'5px',height:'5px',borderRadius:'50%',background:col.color,animation:ci===0?'rp 1.5s infinite':'none'}}/>
                      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'13px',letterSpacing:'3px',color:col.color}}>{col.label}</span>
                      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',marginLeft:'auto'}}>{col.tokens.length}</span>
                    </div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{col.desc}</div>
                  </div>
                  <div style={{flex:1,overflowY:'auto',padding:'6px'}}>
                    {loading?<div style={{textAlign:'center',padding:'40px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c'}}>SCANNING...</div>:col.tokens.length===0?<div style={{textAlign:'center',padding:'40px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#1a1a2e'}}>NO PAIRS</div>:col.tokens.map(t=><TokenCard key={t.id} token={t}/>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ):(
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'6px 12px',borderBottom:'1px solid #1a1a2e',background:'#070710',display:'flex',alignItems:'center',gap:'8px',flexShrink:0,overflowX:'auto'}}>
              <button onClick={()=>setSelected(null)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',background:'none',border:'1px solid #1a1a2e',padding:'4px 8px',cursor:'pointer',flexShrink:0}}>BACK</button>
              {selected.logoUri?(<img src={selected.logoUri} alt="" style={{width:'22px',height:'22px',borderRadius:'50%',objectFit:'cover',flexShrink:0}} onError={e=>e.target.style.display='none'}/>):(<div style={{width:'22px',height:'22px',borderRadius:'50%',background:selected.color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',sans-serif",fontSize:'10px',color:'#050508',flexShrink:0}}>{selected.symbol[0]}</div>)}
              <button onClick={()=>{navigator.clipboard.writeText(selected.address);setTxMsg('CA COPIED');setTxStatus('success');setTimeout(()=>{setTxStatus(null);setTxMsg('')},1500)}} style={{background:'none',border:'none',cursor:'pointer',flexShrink:0,textAlign:'left',padding:0}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'14px',letterSpacing:'2px',color:'#e0e0f0',lineHeight:1}}>${selected.symbol}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#6666aa'}}>click to copy CA</div>
              </button>
              <div style={{display:'flex',gap:'4px',flexShrink:0}}>
                {selected.website&&<a href={selected.website} target="_blank" rel="noreferrer" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',border:'1px solid #1a1a2e',padding:'2px 6px',textDecoration:'none'}}>WEB</a>}
                {selected.twitter&&<a href={selected.twitter} target="_blank" rel="noreferrer" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',border:'1px solid #1a1a2e',padding:'2px 6px',textDecoration:'none'}}>X</a>}
                {selected.telegram&&<a href={selected.telegram} target="_blank" rel="noreferrer" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',border:'1px solid #1a1a2e',padding:'2px 6px',textDecoration:'none'}}>TG</a>}
                <a href={`https://pump.fun/${selected.address}`} target="_blank" rel="noreferrer" style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#FF8800',border:'1px solid rgba(255,136,0,0.3)',padding:'2px 6px',textDecoration:'none'}}>pump</a>
              </div>
              <div style={{display:'flex',gap:'12px',marginLeft:'4px'}}>
                {[['PRICE',`$${selected.price.toExponential(2)}`,'#e0e0f0'],['LIQ',fmt(selected.liquidity),'#e0e0f0'],['MCAP',fmt(selected.marketCap),'#FFD700'],['B.CURVE',`${selected.bondingCurve}%`,selected.bondingCurve>80?'#FF3366':'#FFD700'],['1H VOL',fmt(selected.volume1h),'#e0e0f0'],['BUYS',selected.buys1h,'#00FF88'],['SELLS',selected.sells1h,'#FF3366'],['FEES',`◎${selected.globalFeesPaid??'0'}`,'#A29BFE']].map(([l,v,c])=>(
                  <div key={l} style={{flexShrink:0}}>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',letterSpacing:'1px'}}>{l}</div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:c,fontWeight:'bold'}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{marginLeft:'auto',flexShrink:0}}>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#9945FF',border:'1px solid rgba(153,69,255,0.3)',padding:'2px 6px',borderRadius:'4px'}}>◎ ${solPrice.toFixed(0)}</span>
              </div>
            </div>
            <div style={{flex:1,display:'flex',overflow:'hidden'}}>
              <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <div style={{flex:1,position:'relative',background:'#000',overflow:'hidden'}}>
                  <iframe key={selected.pairAddress} src={`https://dexscreener.com/solana/${selected.pairAddress}?embed=1&theme=dark&trades=0&info=0`} style={{width:'100%',height:'calc(100% + 52px)',border:'none'}} title="chart"/>
                  <div style={{position:'absolute',bottom:0,left:0,right:0,height:'52px',background:'#050508',zIndex:5,borderTop:'1px solid #1a1a2e'}}/>
                </div>
                <div style={{height:'210px',borderTop:'1px solid #1a1a2e',flexShrink:0,display:'flex',flexDirection:'column'}}>
                  <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',background:'#070710',flexShrink:0}}>
                    {[['trades','TRADES'],['positions','POSITIONS'],['holders',`HOLDERS${selected.holders>0?' ('+selected.holders+')':''}`],['top_traders','TOP TRADERS'],['dev_tokens','DEV TOKENS']].map(([v,l])=>(
                      <button key={v} onClick={()=>setBottomTab(v)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',letterSpacing:'1px',padding:'7px 10px',background:'none',border:'none',borderBottom:`2px solid ${bottomTab===v?'#00FF88':'transparent'}`,color:bottomTab===v?'#00FF88':'#6666aa',cursor:'pointer',whiteSpace:'nowrap'}}>{l}</button>
                    ))}
                  </div>
                  <div style={{flex:1,overflow:'hidden',display:'flex'}}>
                    {bottomTab==='trades'&&(
                      <div style={{flex:1,overflowY:'auto'}}>
                        <div style={{display:'grid',gridTemplateColumns:'42px 46px 72px 90px 80px 1fr',padding:'3px 12px',background:'#070710',fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',letterSpacing:'1px',position:'sticky',top:0,borderBottom:'1px solid #0d0d18'}}>
                          <span>AGE</span><span>TYPE</span><span>MC</span><span>SOL</span><span>USD</span><span>WALLET</span>
                        </div>
                        {trades.length===0?<div style={{padding:'20px',textAlign:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c'}}>LOADING...</div>:trades.map(t=>(
                          <div key={t.id} style={{display:'grid',gridTemplateColumns:'42px 46px 72px 90px 80px 1fr',padding:'4px 12px',borderBottom:'1px solid #0a0a0f',alignItems:'center',background:t.isBuy?'rgba(0,255,136,0.015)':'rgba(255,51,102,0.015)'}}>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{t.age}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:t.isBuy?'#00FF88':'#FF3366',fontWeight:'bold'}}>{t.type}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa'}}>{fmt(t.mc)}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#e0e0f0'}}>◎{t.solAmount}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:t.isBuy?'#00FF88':'#FF3366',fontWeight:'bold'}}>${t.usdValue}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#6666aa',overflow:'hidden',textOverflow:'ellipsis'}}>{tr(t.wallet,5)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {bottomTab==='holders'&&(
                      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
                        <div style={{flex:1,overflowY:'auto'}}>
                          <div style={{display:'grid',gridTemplateColumns:'24px 140px 80px 70px 60px',padding:'3px 12px',background:'#070710',fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',position:'sticky',top:0,borderBottom:'1px solid #0d0d18'}}>
                            <span>#</span><span>WALLET</span><span>TOKENS</span><span>% HELD</span><span>TYPE</span>
                          </div>
                          {holders.length===0?<div style={{padding:'20px',textAlign:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c'}}>LOADING...</div>:holders.map((h,i)=>(
                            <div key={i} style={{display:'grid',gridTemplateColumns:'24px 140px 80px 70px 60px',padding:'4px 12px',borderBottom:'1px solid #0a0a0f',alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.background='#0a0a10'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{h.rank}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tr(h.wallet,6)}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#e0e0f0'}}>{h.tokens>1e9?(h.tokens/1e9).toFixed(1)+'B':h.tokens>1e6?(h.tokens/1e6).toFixed(1)+'M':(h.tokens/1e3).toFixed(0)+'K'}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#FFD700'}}>{h.pct}%</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:h.type==='LP'?'#0088ff':'#FF3366'}}>{h.type}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{width:'180px',flexShrink:0,borderLeft:'1px solid #1a1a2e',display:'flex',flexDirection:'column'}}>
                          <div style={{padding:'5px',borderBottom:'1px solid #1a1a2e',display:'flex',gap:'3px',flexWrap:'wrap',background:'#070710'}}>
                            {['Top','Dev','Bundlers','Snipers'].map((v,i)=>(<button key={v} onClick={()=>setBubbleView(i)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',padding:'2px 5px',background:bubbleView===i?'rgba(0,255,136,0.1)':'transparent',border:`1px solid ${bubbleView===i?'rgba(0,255,136,0.3)':'#1a1a2e'}`,color:bubbleView===i?'#00FF88':'#6666aa',cursor:'pointer'}}>{v}</button>))}
                          </div>
                          <div style={{flex:1,position:'relative'}}><BubbleMap view={bubbleView} token={selected}/></div>
                        </div>
                      </div>
                    )}
                    {bottomTab==='top_traders'&&(
                      <div style={{flex:1,overflowY:'auto'}}>
                        <div style={{display:'grid',gridTemplateColumns:'24px 150px 80px 80px 90px 50px',padding:'3px 12px',background:'#070710',fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',position:'sticky',top:0,borderBottom:'1px solid #0d0d18'}}>
                          <span>#</span><span>WALLET</span><span>◎ BOUGHT</span><span>◎ SOLD</span><span>◎ PNL</span><span>TXS</span>
                        </div>
                        {topTraders.length===0?<div style={{padding:'20px',textAlign:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c'}}>LOADING...</div>:topTraders.map(t=>(
                          <div key={t.rank} style={{display:'grid',gridTemplateColumns:'24px 150px 80px 80px 90px 50px',padding:'5px 12px',borderBottom:'1px solid #0a0a0f',alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.background='#0a0a10'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{t.rank}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa'}}>{tr(t.wallet,6)}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#00FF88'}}>◎{t.bought}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#FF3366'}}>◎{t.sold}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:t.isProfitable?'#00FF88':'#FF3366',fontWeight:'bold'}}>{t.isProfitable?'+':''}◎{t.pnl}</span>
                            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa'}}>{t.txns}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {bottomTab==='dev_tokens'&&<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#1a1a2e'}}>DEV TOKEN HISTORY LOADING...</div>}
                    {bottomTab==='positions'&&(
                      <div style={{flex:1,overflowY:'auto',padding:'10px'}}>
                        {positions.length===0?<div style={{textAlign:'center',padding:'20px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c'}}>NO OPEN POSITIONS</div>:positions.map(p=>{
                          const pnlU=p.tokensHeld*p.currentPrice-p.usdSpent, pnlS=pnlU/solPrice, pnlP=p.usdSpent>0?(pnlU/p.usdSpent)*100:0
                          return (<div key={p.id} style={{background:'#0a0a10',border:`1px solid ${pnlU>=0?'rgba(0,255,136,0.2)':'rgba(255,51,102,0.2)'}`,padding:'10px',marginBottom:'6px'}}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px'}}>${p.token.symbol}</span><span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',color:pnlU>=0?'#00FF88':'#FF3366',fontWeight:'bold'}}>{pnlU>=0?'+':''}{pnlP.toFixed(1)}%</span></div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',marginBottom:'6px'}}>◎{p.solSpent.toFixed(4)} spent | {pnlU>=0?'+':''}◎{pnlS.toFixed(4)} PNL</div>
                            <button onClick={()=>sellPosition(p.id,100)} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#FF3366',background:'rgba(255,51,102,0.05)',border:'1px solid rgba(255,51,102,0.3)',padding:'5px',cursor:'pointer'}}>SELL ALL</button>
                          </div>)
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div style={{width:'260px',flexShrink:0,display:'flex',flexDirection:'column',borderLeft:'1px solid #1a1a2e',overflow:'hidden'}}>
                <div style={{display:'flex',borderBottom:'1px solid #1a1a2e',flexShrink:0}}>
                  {[['buy','BUY','#00FF88'],['sell','SELL','#FF3366']].map(([v,l,c])=>(<button key={v} onClick={()=>setSideTab(v)} style={{flex:1,fontFamily:"'Share Tech Mono',monospace",fontSize:'10px',letterSpacing:'2px',padding:'10px',background:sideTab===v?`rgba(${v==='buy'?'0,255,136':'255,51,102'},0.06)`:'transparent',border:'none',borderBottom:`2px solid ${sideTab===v?c:'transparent'}`,color:sideTab===v?c:'#6666aa',cursor:'pointer'}}>{l}</button>))}
                </div>
                <div style={{flex:1,overflowY:'auto',padding:'10px'}}>
                  {sideTab==='buy'&&(
                    <div>
                      {!wallet?(<button onClick={generateWallet} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',letterSpacing:'2px',color:'#050508',background:'#00FF88',border:'none',padding:'9px',cursor:'pointer',marginBottom:'8px'}}>GENERATE WALLET</button>):(
                        <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'8px',marginBottom:'8px'}}>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',marginBottom:'2px'}}>DEVNET WALLET</div>
                          <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'2px'}}>
                            <span style={{color:'#9945FF',fontSize:'12px'}}>◎</span>
                            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'22px',color:'#00FF88',letterSpacing:'2px',lineHeight:1}}>{(wallet.balance||0).toFixed(4)}</span>
                          </div>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#6666aa',marginBottom:'2px'}}>{tr(wallet.publicKey,8)}</div>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',marginBottom:'5px'}}>PK: {wallet.privateKeyBase58?.slice(0,16)}...</div>
                          <button onClick={airdrop} disabled={txStatus==='pending'} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#FFD700',background:'rgba(255,215,0,0.05)',border:'1px solid rgba(255,215,0,0.25)',padding:'4px',cursor:'pointer'}}>AIRDROP 2 SOL FREE</button>
                        </div>
                      )}
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px',marginBottom:'5px'}}>
                        {['0.05','0.1','0.5','1'].map(amt=>(<button key={amt} onClick={()=>setBuyAmount(amt)} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',padding:'6px',background:buyAmount===amt?'rgba(0,255,136,0.1)':'#0a0a10',border:`1px solid ${buyAmount===amt?'rgba(0,255,136,0.35)':'#1a1a2e'}`,color:buyAmount===amt?'#00FF88':'#6666aa',cursor:'pointer'}}>◎{amt}</button>))}
                      </div>
                      <div style={{display:'flex',marginBottom:'4px'}}>
                        <input value={buyAmount} onChange={e=>setBuyAmount(e.target.value)} style={{flex:1,background:'#0a0a10',border:'1px solid #1a1a2e',borderRight:'none',color:'#e0e0f0',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',padding:'8px 10px',outline:'none'}}/>
                        <div style={{background:'#070710',border:'1px solid #1a1a2e',padding:'8px',fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#9945FF'}}>◎ SOL</div>
                      </div>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c',marginBottom:'8px'}}>≈ ${(parseFloat(buyAmount||0)*solPrice).toFixed(2)} USD</div>
                      <button onClick={buy} disabled={!wallet||txStatus==='pending'} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',letterSpacing:'2px',color:'#050508',background:!wallet?'#1a1a2e':'#00FF88',border:'none',padding:'11px',cursor:wallet?'pointer':'not-allowed',marginBottom:'10px'}}>{txStatus==='pending'?txMsg:'BUY'}</button>
                      {pos&&(
                        <div style={{borderTop:'1px solid #1a1a2e',paddingTop:'8px'}}>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px',marginBottom:'6px'}}>
                            {[['Bought',`◎${pos.solSpent.toFixed(4)}`,'#6666aa'],['Sold','◎0','#6666aa'],['Holding',`$${(pos.tokensHeld*(selected?.price??0)).toFixed(2)}`,'#e0e0f0'],['PnL',pnlInSol?`◎${posPnlSol.toFixed(4)}`:`$${posPnlUsd.toFixed(2)}`,posPnlUsd>=0?'#00FF88':'#FF3366']].map(([l,v,c])=>(<div key={l} style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'5px',textAlign:'center'}}><div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#3a3a5c',marginBottom:'2px'}}>{l}</div><div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:c,fontWeight:'bold'}}>{v}</div></div>))}
                          </div>
                          <div style={{textAlign:'center',fontFamily:"'Share Tech Mono',monospace",fontSize:'13px',color:posPnlUsd>=0?'#00FF88':'#FF3366',fontWeight:'bold',marginBottom:'4px'}}>{posPnlUsd>=0?'+':''}{posPnlPct.toFixed(2)}%</div>
                          <button onClick={()=>setPnlInSol(s=>!s)} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#6666aa',background:'#0a0a10',border:'1px solid #1a1a2e',padding:'3px',cursor:'pointer',marginBottom:'8px'}}>SHOW IN {pnlInSol?'USD':'SOL ◎'}</button>
                        </div>
                      )}
                      <div style={{borderTop:'1px solid #1a1a2e',paddingTop:'8px'}}>
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa',marginBottom:'6px'}}>Token Info</div>
                        {[['Market Cap',fmt(selected.marketCap)],['Liquidity',fmt(selected.liquidity)],['Bonding',`${selected.bondingCurve}%`],['Holders',selected.holders||'...'],['Age',elapsed(selected.age)]].map(([k,v])=>(<div key={k} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #0d0d18'}}><span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#3a3a5c'}}>{k}</span><span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'7px',color:'#e0e0f0'}}>{v}</span></div>))}
                        <button onClick={()=>{navigator.clipboard.writeText(selected.address);setTxMsg('CA COPIED');setTxStatus('success');setTimeout(()=>{setTxStatus(null);setTxMsg('')},1500)}} style={{width:'100%',marginTop:'8px',fontFamily:"'Share Tech Mono',monospace",fontSize:'6px',color:'#6666aa',background:'#0a0a10',border:'1px solid #1a1a2e',padding:'5px',cursor:'pointer',textAlign:'left',wordBreak:'break-all'}}>CA: {selected.address.slice(0,22)}...</button>
                      </div>
                    </div>
                  )}
                  {sideTab==='sell'&&(
                    <div>
                      {!pos?(<div style={{textAlign:'center',padding:'32px',fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',color:'#3a3a5c'}}>NO POSITION — BUY FIRST</div>):(
                        <div>
                          <div style={{background:'#0a0a10',border:'1px solid #1a1a2e',padding:'12px',marginBottom:'10px'}}>
                            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'26px',color:posPnlUsd>=0?'#00FF88':'#FF3366',letterSpacing:'2px'}}>{posPnlUsd>=0?'+':''}{posPnlPct.toFixed(2)}%</div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa'}}>◎{pos.solSpent.toFixed(4)} in · {posPnlUsd>=0?'+':''}◎{posPnlSol.toFixed(4)} PNL</div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'8px',color:'#6666aa'}}>${pos.usdSpent.toFixed(2)} in · ${posPnlUsd.toFixed(2)} PNL</div>
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px',marginBottom:'8px'}}>
                            {['25','50','75','100'].map(pct=>(<button key={pct} onClick={()=>sellPosition(pos.id,parseInt(pct))} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:'9px',padding:'8px',background:'rgba(255,51,102,0.08)',border:'1px solid rgba(255,51,102,0.3)',color:'#FF3366',cursor:'pointer'}}>SELL {pct}%</button>))}
                          </div>
                          <button onClick={()=>sellPosition(pos.id,100)} style={{width:'100%',fontFamily:"'Share Tech Mono',monospace",fontSize:'12px',letterSpacing:'2px',color:'#050508',background:'#FF3366',border:'none',padding:'11px',cursor:'pointer'}}>SELL ALL</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes rp{0%,100%{opacity:1}50%{opacity:0.3}} ::-webkit-scrollbar{width:3px;height:3px} ::-webkit-scrollbar-track{background:#050508} ::-webkit-scrollbar-thumb{background:#1a1a2e}`}</style>
    </div>
  )
}
