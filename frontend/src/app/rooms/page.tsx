// @ts-nocheck
'use client'
import Sidebar from '../../components/Sidebar'

export default function Page() {
  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#09090e 0%,#0b0c12 50%,#090a0f 100%)',color:'#fff',fontFamily:"system-ui,-apple-system,'Segoe UI',sans-serif",paddingLeft:'60px',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <Sidebar active="/rooms"/>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:'56px',marginBottom:'20px'}}>💬</div>
        <h1 style={{fontSize:'28px',fontWeight:'700',marginBottom:'12px',letterSpacing:'-0.5px'}}>Rooms</h1>
        <p style={{fontSize:'15px',color:'rgba(255,255,255,0.35)',maxWidth:'340px',lineHeight:1.6,margin:'0 auto 28px'}}>Community rooms coming soon.</p>
        <a href="/radar" style={{display:'inline-flex',alignItems:'center',gap:'8px',padding:'11px 24px',background:'rgba(0,255,136,0.1)',border:'1px solid rgba(0,255,136,0.2)',color:'#00ff88',textDecoration:'none',borderRadius:'10px',fontSize:'13px',fontWeight:'600'}}>← Back to Radar</a>
      </div>
    </div>
  )
}
