// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'
const HELIUS='870dfde6-09ec-48bd-95b8-202303d15c5b'
const fmt=(n)=>!n?'$0':n>=1e9?`$${(n/1e9).toFixed(2)}B`:n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(2)}K`:`$${n.toFixed(2)}`
const fmtSol=(n)=>!n?'0 SOL':n<0.001?`${n.toFixed(6)} SOL`:`${n.toFixed(4)} SOL`
const tr=(a,n=4)=>a?`${a.slice(0,n)}...${a.slice(-n)}`:''
const card={background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'12px',backdropFilter:'blur(12px)'}

export default function PortfolioPage() {
  const [walletInput,setWalletInput]=useState('')
  const [wallets,setWallets]=useState([])
  const [loading,setLoading]=useState(false)
  const [portfolios,setPortfolios]=useState({})
  const [solPrice,setSolPrice]=useState(150)
  const [activeWallet,setActiveWallet]=useState(null)
  const [tab,setTab]=useState('overview')
  useEffect(()=>{fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd').then(r=>r.json()).then(d=>setSolPrice(d?.solana?.usd||150)).catch(()=>{})},[])
  const loadWallet=async(addr)=>{
    if(!addr||portfolios[addr]){setActiveWallet(addr);return}
    setLoading(true)
    try {
      const[balR,tokR,txR]=await Promise.allSettled([
        fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getBalance',params:[addr]})}).then(r=>r.json()),
        fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'getTokenAccountsByOwner',params:[addr,{programId:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'},{encoding:'jsonParsed'}]})}).then(r=>r.json()),
        fetch(`https://api.helius.xyz/v0/addresses/${addr}/transactions?api-key=${HELIUS}&limit=20`).then(r=>r.json())
      ])
      const solBal=(balR.status==='fulfilled'?balR.value?.result?.value||0:0)/1e9
      const tokens=(tokR.status==='fulfilled'?tokR.value?.result?.value||[]:[] ).map(t=>({mint:t.account.data.parsed.info.mint,amount:parseFloat(t.account.data.parsed.info.tokenAmount.uiAmountString||0)})).filter(t=>t.amount>0)
      const txs=(txR.status==='fulfilled'&&Array.isArray(txR.value)?txR.value:[]).slice(0,20).map(t=>({sig:t.signature,ts:t.timestamp,type:t.type||'UNKNOWN',desc:t.description||'',fee:(t.fee||0)/1e9,nativeChange:(t.nativeTransfers||[]).reduce((s,x)=>x.toUserAccount===addr?s+(x.amount/1e9):x.fromUserAccount===addr?s-(x.amount/1e9):s,0)}))
      setPortfolios(p=>({...p,[addr]:{addr,solBal,solUsd:solBal*solPrice,tokens:tokens.slice(0,30),txs}}))
      setActiveWallet(addr)
    }catch{}
    setLoading(false)
  }
  const addWallet=()=>{const addr=walletInput.trim();if(!addr||addr.length<32)return;if(!wallets.includes(addr))setWallets(w=>[...w,addr]);setWalletInput('');loadWallet(addr)}
  const pw=activeWallet?portfolios[activeWallet]:null
  const totalSol=wallets.reduce((s,w)=>s+(portfolios[w]?.solBal||0),0)
  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#09090e 0%,#0b0c12 50%,#090a0f 100%)',color:'#fff',fontFamily:"system-ui,-apple-system,'Segoe UI',sans-serif",paddingLeft:'60px'}}>
      <Sidebar active="/portfolio"/>
      <div style={{position:'fixed',top:'-150px',right:'10%',width:'500px',height:'350px',background:'radial-gradient(ellipse,rgba(77,159,255,0.04) 0%,transparent 70%)',pointerEvents:'none',zIndex:0}}/>
      <div style={{maxWidth:'1100px',margin:'0 auto',padding:'40px 32px',position:'relative',zIndex:1}}>
        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:'36px',flexWrap:'wrap',gap:'16px'}}>
          <div>
            <div style={{fontSize:'11px',color:'rgba(77,159,255,0.7)',letterSpacing:'2.5px',fontWeight:'600',marginBottom:'6px',fontFamily:'monospace'}}>HOLDINGS</div>
            <h1 style={{fontSize:'32px',fontWeight:'700',margin:0,letterSpacing:'-0.8px'}}>Portfolio</h1>
          </div>
          <div style={{display:'flex',...card,overflow:'hidden',borderRadius:'10px'}}>
            <input value={walletInput} onChange={e=>setWalletInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addWallet()} placeholder="Paste Solana wallet address..." style={{background:'transparent',border:'none',color:'#fff',fontSize:'12px',padding:'11px 14px',outline:'none',width:'300px',fontFamily:'monospace'}}/>
            <button onClick={addWallet} style={{background:'linear-gradient(135deg,#4d9fff,#0066cc)',border:'none',color:'#fff',fontSize:'11px',fontWeight:'700',padding:'11px 16px',cursor:'pointer',letterSpacing:'0.5px'}}>TRACK</button>
          </div>
        </div>
        {wallets.length===0?(
          <div style={{textAlign:'center',padding:'100px 20px'}}>
            <div style={{width:'64px',height:'64px',borderRadius:'16px',background:'rgba(77,159,255,0.1)',border:'1px solid rgba(77,159,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:'28px'}}>◎</div>
            <div style={{fontSize:'20px',fontWeight:'600',marginBottom:'10px'}}>Track any Solana wallet</div>
            <div style={{fontSize:'14px',color:'rgba(255,255,255,0.35)',maxWidth:'360px',margin:'0 auto'}}>Paste a wallet address above to see SOL balance, token holdings, and full transaction history.</div>
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'240px 1fr',gap:'20px'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
              <div style={{...card,overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.05)',fontSize:'10px',fontWeight:'700',color:'rgba(255,255,255,0.25)',letterSpacing:'1.5px',fontFamily:'monospace'}}>WALLETS</div>
                {wallets.map(w=>(
                  <div key={w} onClick={()=>loadWallet(w)} style={{padding:'12px 16px',cursor:'pointer',background:activeWallet===w?'rgba(77,159,255,0.08)':'transparent',borderLeft:`2px solid ${activeWallet===w?'#4d9fff':'transparent'}`,borderBottom:'1px solid rgba(255,255,255,0.04)',transition:'all 0.1s'}} onMouseEnter={e=>{if(activeWallet!==w)e.currentTarget.style.background='rgba(255,255,255,0.03)'}} onMouseLeave={e=>{if(activeWallet!==w)e.currentTarget.style.background='transparent'}}>
                    <div style={{fontFamily:'monospace',fontSize:'11px',color:'rgba(255,255,255,0.6)',marginBottom:'3px'}}>{tr(w,5)}</div>
                    <div style={{fontSize:'13px',color:portfolios[w]?'#4d9fff':'rgba(255,255,255,0.2)',fontWeight:'600'}}>{portfolios[w]?fmtSol(portfolios[w].solBal):'...'}</div>
                  </div>
                ))}
              </div>
              <div style={{...card,padding:'16px'}}>
                <div style={{fontSize:'10px',color:'rgba(255,255,255,0.25)',letterSpacing:'1.5px',fontWeight:'700',marginBottom:'10px',fontFamily:'monospace'}}>TOTAL VALUE</div>
                <div style={{fontSize:'28px',fontWeight:'700',color:'#4d9fff',letterSpacing:'-1px',marginBottom:'4px'}}>{fmt(totalSol*solPrice)}</div>
                <div style={{fontSize:'12px',color:'rgba(255,255,255,0.3)'}}>{fmtSol(totalSol)} · {wallets.length} wallet{wallets.length>1?'s':''}</div>
              </div>
            </div>
            <div>
              {loading&&<div style={{textAlign:'center',padding:'60px',color:'rgba(255,255,255,0.3)',fontSize:'13px'}}>Loading wallet data...</div>}
              {!loading&&pw&&(
                <>
                  <div style={{display:'flex',marginBottom:'16px',gap:'4px'}}>
                    {[['overview','Overview'],['tokens',`Tokens (${pw.tokens.length})`],['history','History']].map(([v,l])=>(
                      <button key={v} onClick={()=>setTab(v)} style={{padding:'8px 16px',background:tab===v?'rgba(77,159,255,0.12)':'rgba(255,255,255,0.03)',border:`1px solid ${tab===v?'rgba(77,159,255,0.25)':'rgba(255,255,255,0.06)'}`,borderRadius:'8px',color:tab===v?'#4d9fff':'rgba(255,255,255,0.4)',fontSize:'13px',fontWeight:tab===v?'600':'400',cursor:'pointer',transition:'all 0.1s'}}>{l}</button>
                    ))}
                  </div>
                  {tab==='overview'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>{[['SOL Balance',fmtSol(pw.solBal),'#00ff88'],['USD Value',fmt(pw.solUsd),'#fff'],['SPL Tokens',`${pw.tokens.length} tokens`,'#4d9fff'],['Transactions',`${pw.txs.length} recent`,'#fff'],['Network','Solana Mainnet','#fff'],['Wallet',tr(pw.addr,7),'rgba(255,255,255,0.4)']].map(([l,v,c])=><div key={l} style={{...card,padding:'18px'}}><div style={{fontSize:'10px',color:'rgba(255,255,255,0.25)',letterSpacing:'1px',textTransform:'uppercase',fontWeight:'600',marginBottom:'8px'}}>{l}</div><div style={{fontSize:'16px',fontWeight:'700',color:c}}>{v}</div></div>)}</div>}
                  {tab==='tokens'&&<div style={{...card,overflow:'hidden'}}><div style={{display:'grid',gridTemplateColumns:'1fr 110px 70px',padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.05)',fontSize:'10px',color:'rgba(255,255,255,0.25)',fontFamily:'monospace'}}><span>MINT</span><span style={{textAlign:'right'}}>AMOUNT</span><span style={{textAlign:'right'}}>ACTION</span></div>{pw.tokens.length===0?<div style={{padding:'40px',textAlign:'center',color:'rgba(255,255,255,0.2)',fontSize:'13px'}}>No tokens found</div>:pw.tokens.map((t,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'1fr 110px 70px',padding:'11px 16px',borderBottom:'1px solid rgba(255,255,255,0.03)',alignItems:'center',transition:'background 0.1s'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><span style={{fontFamily:'monospace',fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>{tr(t.mint,6)}</span><span style={{fontFamily:'monospace',fontSize:'12px',color:'#fff',textAlign:'right'}}>{t.amount.toLocaleString()}</span><span style={{fontSize:'10px',color:'#4d9fff',textAlign:'right',cursor:'pointer'}} onClick={()=>navigator.clipboard.writeText(t.mint)}>copy ⎘</span></div>)}</div>}
                  {tab==='history'&&<div style={{...card,overflow:'hidden'}}><div style={{display:'grid',gridTemplateColumns:'90px 90px 1fr 65px',padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.05)',fontSize:'10px',color:'rgba(255,255,255,0.25)',fontFamily:'monospace'}}><span>TYPE</span><span>SOL</span><span>DESCRIPTION</span><span style={{textAlign:'right'}}>FEE</span></div>{pw.txs.length===0?<div style={{padding:'40px',textAlign:'center',color:'rgba(255,255,255,0.2)',fontSize:'13px'}}>No transactions found</div>:pw.txs.map((t,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'90px 90px 1fr 65px',padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.03)',alignItems:'center',transition:'background 0.1s'}} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.02)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><span style={{fontFamily:'monospace',fontSize:'10px',color:'#4d9fff',fontWeight:'600'}}>{t.type.slice(0,12)}</span><span style={{fontFamily:'monospace',fontSize:'11px',color:t.nativeChange>=0?'#00ff88':'#ff4757',fontWeight:'700'}}>{t.nativeChange>=0?'+':''}{t.nativeChange.toFixed(4)}◎</span><span style={{fontSize:'11px',color:'rgba(255,255,255,0.35)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.desc||tr(t.sig,6)}</span><span style={{fontFamily:'monospace',fontSize:'10px',color:'rgba(255,255,255,0.2)',textAlign:'right'}}>{t.fee.toFixed(5)}◎</span></div>)}</div>}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`*{box-sizing:border-box}input::placeholder{color:rgba(255,255,255,0.2)}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}`}</style>
    </div>
  )
}
