import { useState } from 'react'
import { signIn, signUp, upsertProfile } from '../lib/supabase'

const AVATAR_COLORS = ['#c4855a','#6b8fa8','#7aaa7a','#b87ab8','#c4b06a','#6ab8b8']
const randColor = () => AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)]

export default function LoginPage({ onToast }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const errMsg = (msg) => {
    if (msg.includes('Invalid login')) return 'Wrong email or password'
    if (msg.includes('already registered')) return 'Email already registered — log in instead'
    if (msg.includes('Password should')) return 'Password must be at least 6 characters'
    return msg
  }

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return
    if (mode === 'signup' && !name.trim()) return
    setLoading(true)

    if (mode === 'signup') {
      const { data, error } = await signUp(email.trim(), password)
      if (error) { onToast(errMsg(error.message), 'error'); setLoading(false); return }
      if (data?.user) {
        await upsertProfile({ user_id: data.user.id, display_name: name.trim(), avatar_color: randColor(), email: email.trim(), plan: 'free' })
      }
      await signIn(email.trim(), password)
    } else {
      const { error } = await signIn(email.trim(), password)
      if (error) { onToast(errMsg(error.message), 'error') }
    }
    setLoading(false)
  }

  const canSubmit = email.trim() && password.trim() && (mode === 'login' || name.trim())

  return (
    <div style={{ minHeight:'100vh', background:'#f8f5f0', display:'flex', fontFamily:'DM Sans, sans-serif' }}>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 20px' }}>
        <div style={{ maxWidth:'400px', width:'100%' }}>
          <div style={{ textAlign:'center', marginBottom:'40px' }}>
            <div style={{ fontSize:'44px', marginBottom:'16px' }}>⚖️</div>
            <h1 style={{ fontFamily:'Playfair Display, serif', fontSize:'30px', fontWeight:'400', color:'#1a1410', marginBottom:'10px' }}>HeirSplit</h1>
            <p style={{ color:'#8c7b6b', fontSize:'15px', lineHeight:'1.6' }}>The professional platform for distributing estate items fairly</p>
          </div>

          <div style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'14px', padding:'36px', boxShadow:'0 4px 32px rgba(0,0,0,0.06)' }}>
            <div style={{ display:'flex', background:'#f5f0eb', borderRadius:'8px', padding:'4px', marginBottom:'28px' }}>
              {[['login','Log in'],['signup','Create account']].map(([m,l]) => (
                <button key={m} onClick={()=>setMode(m)} style={{
                  flex:1, padding:'9px', border:'none', borderRadius:'6px', cursor:'pointer',
                  background:mode===m?'#fff':'transparent',
                  color:mode===m?'#1a1410':'#8c7b6b', fontSize:'14px', fontFamily:'DM Sans, sans-serif',
                  boxShadow:mode===m?'0 1px 4px rgba(0,0,0,0.08)':'none', transition:'all 0.15s',
                }}>{l}</button>
              ))}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'14px', marginBottom:'20px' }}>
              {mode==='signup' && (
                <div>
                  <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'6px' }}>Your name *</label>
                  <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Sarah Johnson"
                    style={{ width:'100%', padding:'12px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'15px', background:'#faf7f3', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
                </div>
              )}
              <div>
                <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'6px' }}>Email *</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="you@example.com"
                  style={{ width:'100%', padding:'12px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'15px', background:'#faf7f3', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'6px' }}>Password *</label>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder={mode==='signup'?'Min. 6 characters':'••••••••'}
                  style={{ width:'100%', padding:'12px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'15px', background:'#faf7f3', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
              </div>
            </div>

            <button onClick={handleSubmit} disabled={loading||!canSubmit} style={{
              width:'100%', padding:'13px', background:canSubmit?'#1a1410':'#c0b8b0',
              color:'#f5f0eb', border:'none', borderRadius:'8px',
              cursor:canSubmit?'pointer':'not-allowed', fontSize:'15px', fontFamily:'DM Sans, sans-serif',
            }}>{loading?'Please wait…':mode==='login'?'Log in':'Create account'}</button>

            <p style={{ textAlign:'center', marginTop:'16px', fontSize:'13px', color:'#a89080' }}>
              {mode==='login'?<>New here?{' '}<button onClick={()=>setMode('signup')} style={{ background:'none', border:'none', color:'#c4855a', cursor:'pointer', fontSize:'13px', fontFamily:'DM Sans, sans-serif', textDecoration:'underline' }}>Create account</button></>
              :<>Have an account?{' '}<button onClick={()=>setMode('login')} style={{ background:'none', border:'none', color:'#c4855a', cursor:'pointer', fontSize:'13px', fontFamily:'DM Sans, sans-serif', textDecoration:'underline' }}>Log in</button></>}
            </p>
          </div>

          <p style={{ textAlign:'center', marginTop:'20px', fontSize:'12px', color:'#b0a090' }}>
            Used by funeral homes, estate attorneys & families worldwide
          </p>
        </div>
      </div>
    </div>
  )
}
