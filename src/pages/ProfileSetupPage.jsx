import { useState } from 'react'
import { upsertProfile } from '../lib/supabase'

const COLORS = ['#5F6E52','#8B9A7D','#9C8267','#7A8B6E','#A97C3F','#6E8B87','#8B3A3A','#6E8B87']

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
    <div style={{ minHeight:'100vh', background:'#FBF9F5', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'Karla, sans-serif' }}>
      <div style={{ maxWidth:'400px', width:'100%', background:'#fff', border:'1px solid #D9CFC0', borderRadius:'14px', padding:'40px', boxShadow:'0 4px 32px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontFamily:'Fraunces, serif', fontSize:'24px', fontWeight:'400', color:'#3A2F26', marginBottom:'8px' }}>Velkommen</h2>
        <p style={{ color:'#9C8267', fontSize:'14px', lineHeight:'1.6', marginBottom:'28px' }}>Sett opp profilen din så familiemedlemmer vet hvem du er.</p>

        <div style={{ display:'flex', justifyContent:'center', marginBottom:'24px' }}>
          <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'28px', color:'#fff', fontWeight:'500', transition:'background 0.2s' }}>
            {name ? name[0].toUpperCase() : '?'}
          </div>
        </div>

        <div style={{ marginBottom:'20px' }}>
          <label style={{ display:'block', fontSize:'13px', color:'#9C8267', marginBottom:'6px' }}>Visningsnavn</label>
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} placeholder="f.eks. Kari"
            style={{ width:'100%', padding:'12px 14px', border:'1px solid #D9CFC0', borderRadius:'8px', fontSize:'15px', background:'#FBF9F5', color:'#3A2F26', outline:'none', fontFamily:'Karla, sans-serif', boxSizing:'border-box' }} />
        </div>

        <div style={{ marginBottom:'28px' }}>
          <label style={{ display:'block', fontSize:'13px', color:'#9C8267', marginBottom:'10px' }}>Velg din farge</label>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {COLORS.map(c => (
              <button key={c} onClick={()=>setColor(c)} style={{ width:'36px', height:'36px', borderRadius:'50%', background:c, border:color===c?'3px solid #3A2F26':'3px solid transparent', cursor:'pointer', transition:'border 0.15s' }} />
            ))}
          </div>
        </div>

        <button onClick={save} disabled={!name.trim()||loading} style={{
          width:'100%', padding:'13px', background:name.trim()?'#3A2F26':'#D9CFC0',
          color:'#FBF9F5', border:'none', borderRadius:'8px',
          cursor:name.trim()?'pointer':'not-allowed', fontSize:'15px', fontFamily:'Karla, sans-serif',
        }}>{loading?'Lagrer…':'Kom i gang →'}</button>
      </div>
    </div>
  )
}
