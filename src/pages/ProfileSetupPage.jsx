import { useState } from 'react'
import { upsertProfile } from '../lib/supabase'

const COLORS = ['#c4855a','#6b8fa8','#7aaa7a','#b87ab8','#c4b06a','#6ab8b8','#c46a6a','#8a8ac4']

export default function ProfileSetupPage({ session, onSaved, onToast }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [loading, setLoading] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setLoading(true)
    const { data, error } = await upsertProfile({ user_id: session.user.id, display_name: name.trim(), avatar_color: color, email: session.user.email, plan: 'free' })
    setLoading(false)
    if (error) { onToast('Something went wrong', 'error'); return }
    onSaved(data)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f8f5f0', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'DM Sans, sans-serif' }}>
      <div style={{ maxWidth:'400px', width:'100%', background:'#fff', border:'1px solid #e8e0d6', borderRadius:'14px', padding:'40px', boxShadow:'0 4px 32px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:'24px', fontWeight:'400', color:'#1a1410', marginBottom:'8px' }}>Welcome! 👋</h2>
        <p style={{ color:'#8c7b6b', fontSize:'14px', lineHeight:'1.6', marginBottom:'28px' }}>Set up your profile so family members know who you are.</p>

        <div style={{ display:'flex', justifyContent:'center', marginBottom:'24px' }}>
          <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px', color:'#fff', fontWeight:'500', transition:'background 0.2s' }}>
            {name ? name[0].toUpperCase() : '?'}
          </div>
        </div>

        <div style={{ marginBottom:'20px' }}>
          <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'6px' }}>Display name</label>
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} placeholder="e.g. Sarah"
            style={{ width:'100%', padding:'12px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'15px', background:'#faf7f3', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
        </div>

        <div style={{ marginBottom:'28px' }}>
          <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'10px' }}>Choose your color</label>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {COLORS.map(c => (
              <button key={c} onClick={()=>setColor(c)} style={{ width:'36px', height:'36px', borderRadius:'50%', background:c, border: color===c?'3px solid #1a1410':'3px solid transparent', cursor:'pointer', transition:'border 0.15s' }} />
            ))}
          </div>
        </div>

        <button onClick={save} disabled={!name.trim()||loading} style={{
          width:'100%', padding:'13px', background:name.trim()?'#1a1410':'#c0b8b0',
          color:'#f5f0eb', border:'none', borderRadius:'8px',
          cursor:name.trim()?'pointer':'not-allowed', fontSize:'15px', fontFamily:'DM Sans, sans-serif',
        }}>{loading?'Saving…':'Get started →'}</button>
      </div>
    </div>
  )
}
