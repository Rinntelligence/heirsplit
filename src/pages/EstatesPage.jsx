import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyEstates, createEstate, supabase } from '../lib/supabase'
import { usePlan } from '../hooks/usePlan'
import { Card, Button, Avatar } from '../components/UI'

function genCode() { return Math.random().toString(36).substring(2,8).toUpperCase() }

export default function EstatesPage({ session, profile, onToast }) {
  const [estates, setEstates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const navigate = useNavigate()
  const { plan, limit } = usePlan()

  const load = async () => {
    const { data } = await getMyEstates(session.user.id)
    setEstates(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    if (!newName.trim()) return
    const myEstates = estates.filter(e => e.role === 'admin').length
    if (myEstates >= limit('estates')) { onToast(`Upgrade to create more than ${limit('estates')} estate(s)`, 'error'); return }
    setCreating(true)
    const { data, error } = await createEstate({
      name: newName.trim(), description: newDesc.trim(),
      owner_id: session.user.id, invite_code: genCode(),
      branding_color: '#1a1410', status: 'active',
    })
    if (error) { onToast('Error: ' + error.message, 'error'); setCreating(false); return }
    await supabase.from('estate_members').insert({ estate_id: data.id, user_id: session.user.id, role: 'admin' })
    onToast('Estate created! ✓')
    setShowNew(false); setNewName(''); setNewDesc('')
    load()
    setCreating(false)
  }

  const joinByCode = async () => {
    if (!joinCode.trim()) return
    const code = joinCode.trim().toUpperCase()
    const { data: estate } = await supabase.from('estates').select('id, name').eq('invite_code', code).single()
    if (!estate) { onToast('Invalid invite code', 'error'); return }
    await supabase.from('estate_members').upsert({ estate_id: estate.id, user_id: session.user.id, role: 'member' }, { onConflict: 'estate_id,user_id' })
    onToast(`Joined "${estate.name}" ✓`)
    load(); setJoinCode('')
  }

  return (
    <div style={{ maxWidth:'860px', margin:'0 auto', padding:'32px 16px', fontFamily:'DM Sans, sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'32px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontFamily:'Playfair Display, serif', fontSize:'28px', fontWeight:'400', color:'#1a1410', marginBottom:'6px' }}>
            Welcome back, {profile?.display_name?.split(' ')[0]} 👋
          </h1>
          <p style={{ color:'#8c7b6b', fontSize:'15px' }}>Manage your estates or join one with an invite code</p>
        </div>
        <button onClick={()=>setShowNew(!showNew)} style={{
          padding:'11px 22px', background:'#1a1410', color:'#f5f0eb',
          border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontFamily:'DM Sans, sans-serif',
        }}>+ New estate</button>
      </div>

      {showNew && (
        <Card style={{ padding:'28px', marginBottom:'24px' }}>
          <h3 style={{ fontFamily:'Playfair Display, serif', fontSize:'18px', fontWeight:'400', color:'#1a1410', marginBottom:'20px' }}>Create new estate</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px', marginBottom:'20px' }}>
            <div>
              <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'6px' }}>Estate name *</label>
              <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Johnson Family Estate"
                style={{ width:'100%', padding:'11px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'15px', background:'#faf7f3', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'6px' }}>Description (optional)</label>
              <input value={newDesc} onChange={e=>setNewDesc(e.target.value)} placeholder="e.g. Items from grandfather's house"
                style={{ width:'100%', padding:'11px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'15px', background:'#faf7f3', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
            </div>
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <button onClick={()=>setShowNew(false)} style={{ flex:1, padding:'11px', background:'none', border:'1px solid #e0d8d0', borderRadius:'8px', cursor:'pointer', color:'#6b5c4c', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>Cancel</button>
            <button onClick={create} disabled={!newName.trim()||creating} style={{ flex:2, padding:'11px', background:newName.trim()?'#1a1410':'#c0b8b0', color:'#f5f0eb', border:'none', borderRadius:'8px', cursor:newName.trim()?'pointer':'not-allowed', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>
              {creating?'Creating…':'Create estate'}
            </button>
          </div>
        </Card>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#a89080' }}>Loading…</div>
      ) : estates.length === 0 ? (
        <div style={{ textAlign:'center', padding:'80px 20px' }}>
          <div style={{ fontSize:'52px', marginBottom:'16px' }}>⚖️</div>
          <p style={{ color:'#8c7b6b', fontSize:'16px', marginBottom:'24px' }}>No estates yet. Create one or join with an invite code.</p>
          <button onClick={()=>setShowNew(true)} style={{ padding:'12px 28px', background:'#1a1410', color:'#f5f0eb', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'15px', fontFamily:'DM Sans, sans-serif' }}>
            Create first estate
          </button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:'16px', marginBottom:'32px' }}>
          {estates.map(e => {
            const est = e.estates
            return (
              <div key={e.estate_id} onClick={()=>navigate(`/estate/${e.estate_id}`)} style={{
                background:'#fff', border:'1px solid #e8e0d6', borderRadius:'12px',
                padding:'22px', cursor:'pointer', transition:'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={ev=>{ ev.currentTarget.style.transform='translateY(-2px)'; ev.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,0.09)' }}
              onMouseLeave={ev=>{ ev.currentTarget.style.transform='none'; ev.currentTarget.style.boxShadow='none' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                  <div style={{ width:'42px', height:'42px', borderRadius:'10px', background: est?.branding_color || '#1a1410', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px' }}>⚖️</div>
                  <span style={{ fontSize:'11px', background: e.role==='admin'?'#f0ebe4':'#e8f0fe', color: e.role==='admin'?'#6b5c4c':'#1a56db', padding:'3px 8px', borderRadius:'20px', textTransform:'uppercase', letterSpacing:'0.5px' }}>{e.role}</span>
                </div>
                <h3 style={{ fontFamily:'Playfair Display, serif', fontSize:'17px', fontWeight:'400', color:'#1a1410', marginBottom:'6px' }}>{est?.name}</h3>
                {est?.description && <p style={{ fontSize:'13px', color:'#8c7b6b', marginBottom:'12px', lineHeight:'1.5' }}>{est.description}</p>}
                <div style={{ fontSize:'12px', color:'#a89080' }}>
                  Created {new Date(est?.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Card style={{ padding:'24px' }}>
        <h3 style={{ fontSize:'15px', color:'#1a1410', marginBottom:'6px', fontWeight:'500' }}>Join an estate</h3>
        <p style={{ fontSize:'13px', color:'#8c7b6b', marginBottom:'16px' }}>Got an invite code? Enter it below to join the family.</p>
        <div style={{ display:'flex', gap:'10px' }}>
          <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&joinByCode()} placeholder="Enter invite code (e.g. AB3X9K)"
            style={{ flex:1, padding:'11px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'15px', background:'#faf7f3', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif', letterSpacing:'2px' }} />
          <button onClick={joinByCode} style={{ padding:'11px 20px', background:'#1a1410', color:'#f5f0eb', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>Join</button>
        </div>
      </Card>
    </div>
  )
}
