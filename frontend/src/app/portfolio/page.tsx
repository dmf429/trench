// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar'

const C = {bg:'#06070b',bg2:'#0c0c10',bg3:'#1a1b23',bg4:'#22242d',text1:'#fcfcfc',text2:'#6b6b7a',text3:'#d4d4d8',accent:'#526fff',green:'#16a34a',green2:'#14f195',red:'#ef4444',yellow:'#eab308',border:'#1a1b23'}
const HELIUS='870dfde6-09ec-48bd-95b8-202303d15c5b'
const fmt=(n)=>!n?'$0':n>=1e9?`$${(n/1e9).toFixed(2)}B`:n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(2)}K`:`$${n.toFixed(2)}`
const fmtSol=(n)=>!n?'0◎':n<0.001?n.toFixed(6)+'◎':n.toFixed(4)+'◎'
const tr=(a,n=4)=>a?`${a.slice(0,n)}...${a.slice(-n)}`:''

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
    } catch(e){}
    setLoading(false)
  }

  const addWallet=()=>{const addr=walletInput.trim();if(!addr||addr.length<32)return;if(!wallets.includes(addr))setWallets(w=>[...w,addr]);setWalletInput('');loadWallet(addr)}
  const pw=activeWallet?portfolios[activeWallet]:null
  const totalSol=wallets.reduce((s,w)=>s+(portfolios[w]?.solBal||0),0)

  return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text1,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",paddingLeft:'60px'}}>
      <Sidebar active="/portfolio"/>
      <div style={{maxWidth:'1200px',margin:'0 auto',padding:'24px 20px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
          <div>
            <h1 style={{fontSize:'24px',fontWeight:'700',margin:0,letterSpacing:'-0.5px'}}>Portfolio Tracker</h1>
            <p style={{fontSize:'12px',color:C.text2,margin:'4px 0 0',fontFamily:'monospace'}}>Track any Solana wallet in real-time</p>
          </div>
          <div style={{display:'flex',background:C.bg2,border:`1px solid ${C.border}`,borderRadius:'8px',overflow:'hidden'}}>
            <input value={walletInput} onChange={e=>setWalletInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addWallet()} placeholder="Paste Solana wallet address..." style={{background:'transparent',border:'none',color:C.text1,fontSize:'12px',padding:'10px 14px',outline:'none',width:'320px',fontFamily:'monospace'}}/>
            <button onClick={addWallet} style={{background:C.accent,border:'none',color:'#fff',fontSize:'11px',fontWeight:'700',padding:'10px 16px',cursor:'pointer'}}>TRACK</button>
          </div>
        </div>
        {wallets.length===0?(
          <div style={{textAlign:'center',padding:'80px 20px',color:C.text2}}>
            <div style={{fontSize:'48px',marginBottom:'16px'}}>◎</div>
            <div style={{fontSize:'16px',fontWeight:'600',marginBottom:'8px',color:C.text3}}>Track any Solana wallet</div>
            <div style={{fontSize:'13px'}}>Paste a wallet address above to see SOL balance, token holdings, and trade history</div>
          </div>
        ):(
          <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:'16px'}}>
            <div>
              <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:'10px',overflow:'hidden',marginBottom:'12px'}}>
                <div style={{padding:'10px 14px',borderBottom:`1px solid ${C.border}`,fontSize:'11px',fontWeight:'700',color:C.text2,fontFamily:'monospace'}}>WALLETS ({wallets.length})</div>
                {wallets.map(w=>(
                  <div key={w} onClick={()=>loadWallet(w)} style={{padding:'12px 14px',cursor:'pointer',background:activeWallet===w?`${C.accent}18`:'transparent',borderBottom:`1px solid ${C.border}`,borderLeft:`3px solid ${activeWallet===w?C.accent:'transparent'}`}} onMouseEnter={e=>e.currentTarget.style.background=activeWallet===w?`${C.accent}18`:C.bg4} onMouseLeave={e=>e.currentTarget.style.background=activeWallet===w?`${C.accent}18`:'transparent'}>
                    <div style={{fontFamily:'monospace',fontSize:'11px',color:C.text1,marginBottom:'3px'}}>{tr(w,5)}</div>
                    <div style={{fontSize:'12px',color:portfolios[w]?C.green:C.text2,fontWeight:'600'}}>{portfolios[w]?fmtSol(portfolios[w].solBal):'...'}</div>
                  </div>
                ))}
              </div>
              <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'14px'}}>
                <div style={{fontSize:'11px',color:C.text2,fontFamily:'monospace',marginBottom:'8px'}}>TOTAL VALUE</div>
                <div style={{fontSize:'26px',fontWeight:'700',color:C.green,letterSpacing:'-1px'}}>{fmt(totalSol*solPrice)}</div>
                <div style={{fontSize:'13px',color:C.text2}}>{fmtSol(totalSol)} across {wallets.length} wallet{wallets.length>1?'s':''}</div>
              </div>
            </div>
            <div>
              {loading&&<div style={{textAlign:'center',padding:'60px',color:C.text2,fontFamily:'monospace'}}>⟳ Loading...</div>}
              {!loading&&pw&&(
                <>
                  <div style={{display:'flex',marginBottom:'16px',background:C.bg2,border:`1px solid ${C.border}`,borderRadius:'10px',overflow:'hidden'}}>
                    {[['overview','OVERVIEW'],['tokens','TOKENS ('+pw.tokens.length+')'],['history','HISTORY ('+pw.txs.length+')']].map(([v,l])=>(
                      <button key={v} onClick={()=>setTab(v)} style={{flex:1,padding:'10px',background:tab===v?`${C.accent}22`:'transparent',border:'none',borderBottom:`2px solid ${tab===v?C.accent:'transparent'}`,color:tab===v?C.text1:C.text2,fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>{l}</button>
                    ))}
                  </div>
                  {tab==='overview'&&(
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
                      {[['SOL Balance',fmtSol(pw.solBal),C.green2],['USD Value',fmt(pw.solUsd),C.text1],['SPL Tokens',pw.tokens.length+' tokens',C.accent],['Recent Txs',pw.txs.length+' transactions',C.text1],['Wallet',tr(pw.addr,7),C.text2],['Network','Solana Mainnet',C.text1]].map(([l,v,c])=>(
                        <div key={l} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'16px'}}>
                          <div style={{fontSize:'10px',color:C.text2,fontFamily:'monospace',marginBottom:'6px'}}>{l.toUpperCase()}</div>
                          <div style={{fontSize:'15px',fontWeight:'700',color:c}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {tab==='tokens'&&(
                    <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:'10px',overflow:'hidden'}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 120px 80px',padding:'8px 16px',borderBottom:`1px solid ${C.border}`,fontSize:'10px',color:C.text2,fontFamily:'monospace'}}><span>MINT</span><span style={{textAlign:'right'}}>AMOUNT</span><span style={{textAlign:'right'}}>ACTION</span></div>
                      {pw.tokens.length===0?<div style={{padding:'32px',textAlign:'center',color:C.text2}}>No tokens</div>:pw.tokens.map((t,i)=>(
                        <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 120px 80px',padding:'10px 16px',borderBottom:`1px solid ${C.border}`,alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.background=C.bg4} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <span style={{fontFamily:'monospace',fontSize:'11px',color:C.text2}}>{tr(t.mint,6)}</span>
                          <span style={{fontFamily:'monospace',fontSize:'12px',color:C.text1,textAlign:'right'}}>{t.amount.toLocaleString()}</span>
                          <span style={{fontFamily:'monospace',fontSize:'10px',color:C.accent,textAlign:'right',cursor:'pointer'}} onClick={()=>navigator.clipboard.writeText(t.mint)}>copy ⎘</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {tab==='history'&&(
                    <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:'10px',overflow:'hidden'}}>
                      <div style={{display:'grid',gridTemplateColumns:'100px 90px 1fr 70px',padding:'8px 16px',borderBottom:`1px solid ${C.border}`,fontSize:'10px',color:C.text2,fontFamily:'monospace'}}><span>TYPE</span><span>SOL</span><span>DESCRIPTION</span><span style={{textAlign:'right'}}>FEE</span></div>
                      {pw.txs.length===0?<div style={{padding:'32px',textAlign:'center',color:C.text2}}>No transactions</div>:pw.txs.map((t,i)=>(
                        <div key={i} style={{display:'grid',gridTemplateColumns:'100px 90px 1fr 70px',padding:'9px 16px',borderBottom:`1px solid ${C.border}`,alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.background=C.bg4} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <span style={{fontFamily:'monospace',fontSize:'10px',color:C.accent,fontWeight:'700'}}>{t.type.slice(0,12)}</span>
                          <span style={{fontFamily:'monospace',fontSize:'11px',color:t.nativeChange>=0?C.green:C.red,fontWeight:'700'}}>{t.nativeChange>=0?'+':''}{t.nativeChange.toFixed(4)}◎</span>
                          <span style={{fontSize:'11px',color:C.text2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.desc||tr(t.sig,6)}</span>
                          <span style={{fontFamily:'monospace',fontSize:'10px',color:C.text2,textAlign:'right'}}>{t.fee.toFixed(5)}◎</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.border}}`}</style>
    </div>
  )
}
