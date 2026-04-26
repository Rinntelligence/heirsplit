import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getEstate, getEstateMembers, updateEstate, uploadLogo, supabase } from '../lib/supabase'
import { usePlan } from '../hooks/usePlan'
import { Avatar, Card } from '../components/UI'

export default function AdminPage({ session, profile, onToast }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [estate, setEstate] = useState(null)
  const [members, setMembers] = useState([])
  const [brandColor, setBrandColor] = useState('#1a1410')
  const [saving, setSaving] = useState(false)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [copied, setCopied] = useState(false)
  const logoRef = useRef()
  const { can } = usePlan()

  const load = async () => {
    const [{ data: est }, { data: mems }] = await Promise.all([
      getEstate(id),
      getEstateMembers(id),
    ])
    setEstate(est)
    setMembers(mems || [])
    setBrandColor(est?.branding_color || '#1a1410')
    setLogoPreview(est?.branding_logo || null)
  }

  useEffect(() => { load() }, [id])

  const inviteUrl = estate ? `${window.location.origin}/join/${estate.invite_code}` : ''

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const regenerateCode = async () => {
    const code = Math.random().toString(36).substring(2,8).toUpperCase()
    await updateEstate(id, { invite_code: code })
    onToast('Invite link regenerated ✓')
    load()
  }

  const saveBranding = async () => {
    if (!can('whitelabel')) { onToast('White-label requires Business plan', 'error'); return }
    setSaving(true)
    let logoUrl = estate.branding_logo
    if (logoFile) logoUrl = await uploadLogo(logoFile, id)
    await updateEstate(id, { branding_color: brandColor, branding_logo: logoUrl })
    onToast('Branding saved ✓')
    setSaving(false); load()
  }

  const removeMember = async (userId) => {
    await supabase.from('estate_members').delete().eq('estate_id', id).eq('user_id', userId)
    onToast('Member removed')
    load()
  }

  const handleLogo = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  if (!estate) return <div style={{ padding:'80px', textAlign:'center', color:'#a89080', fontFamily:'DM Sans, sans-serif' }}>Loading…</div>

  return (
    <div style={{ maxWidth:'680px', margin:'0 auto', padding:'28px 16px', fontFamily:'DM Sans, sans-serif' }}>
      <button onClick={()=>navigate(`/estate/${id}`)} style={{ background:'none', border:'none', color:'#8c7b6b', cursor:'pointer', fontSize:'13px', padding:'0 0 20px', fontFamily:'DM Sans, sans-serif' }}>← Back to estate</button>
      <h1 style={{ fontFamily:'Playfair Display, serif', fontSize:'24px', fontWeight:'400', color:'#1a1410', marginBottom:'28px' }}>Manage — {estate.name}</h1>

      {/* Invite link */}
      <Card style={{ padding:'28px', marginBottom:'20px' }}>
        <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:'18px', fontWeight:'400', color:'#1a1410', marginBottom:'6px' }}>Invite link</h2>
        <p style={{ fontSize:'13px', color:'#8c7b6b', marginBottom:'16px' }}>Send this link to family members — they click it and are automatically added to this estate.</p>
        <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
          <input value={inviteUrl} readOnly
            style={{ flex:1, padding:'11px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'13px', background:'#faf7f3', color:'#6b5c4c', outline:'none', fontFamily:'monospace' }} />
          <button onClick={copyInvite} style={{ padding:'11px 18px', background: copied?'#7aaa7a':'#1a1410', color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontFamily:'DM Sans, sans-serif', whiteSpace:'nowrap' }}>
            {copied ? '✓ Copied!' : 'Copy link'}
          </button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{ fontSize:'13px', color:'#8c7b6b' }}>Invite code: <strong style={{ letterSpacing:'2px', color:'#1a1410' }}>{estate.invite_code}</strong></span>
          <button onClick={regenerateCode} style={{ fontSize:'12px', color:'#a89080', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'DM Sans, sans-serif' }}>Regenerate</button>
        </div>
      </Card>

      {/* Members */}
      <Card style={{ padding:'28px', marginBottom:'20px' }}>
        <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:'18px', fontWeight:'400', color:'#1a1410', marginBottom:'16px' }}>Members ({members.length})</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {members.map(m => (
            <div key={m.user_id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', background:'#faf7f3', border:'1px solid #e8e0d6', borderRadius:'8px' }}>
              <Avatar name={m.profiles?.display_name||'?'} size={38} color={m.profiles?.avatar_color} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'14px', color:'#1a1410', fontWeight:'500' }}>{m.profiles?.display_name}</div>
                <div style={{ fontSize:'12px', color:'#a89080' }}>{m.profiles?.email}</div>
              </div>
              <span style={{ fontSize:'11px', background:m.role==='admin'?'#f0ebe4':'#e8f0fe', color:m.role==='admin'?'#6b5c4c':'#1a56db', padding:'3px 8px', borderRadius:'20px', textTransform:'uppercase', letterSpacing:'0.5px' }}>{m.role}</span>
              {m.user_id !== session.user.id && (
                <button onClick={()=>removeMember(m.user_id)} style={{ background:'none', border:'none', color:'#c0a090', cursor:'pointer', fontSize:'18px', padding:'0 4px' }}>×</button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* White-label branding */}
      <Card style={{ padding:'28px', marginBottom:'20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
          <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:'18px', fontWeight:'400', color:'#1a1410' }}>Branding</h2>
          {!can('whitelabel') && <span style={{ fontSize:'11px', background:'#fef3e8', color:'#c4855a', padding:'3px 8px', borderRadius:'20px' }}>Business plan</span>}
        </div>
        <p style={{ fontSize:'13px', color:'#8c7b6b', marginBottom:'20px' }}>Customize the look for your clients — your logo and colors in the top bar.</p>

        <div style={{ display:'flex', gap:'20px', flexWrap:'wrap', marginBottom:'20px' }}>
          <div style={{ flex:1, minWidth:'160px' }}>
            <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'8px' }}>Brand color</label>
            <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
              <input type="color" value={brandColor} onChange={e=>setBrandColor(e.target.value)}
                style={{ width:'48px', height:'48px', border:'1px solid #e0d8d0', borderRadius:'8px', cursor:'pointer', padding:'2px' }} />
              <span style={{ fontSize:'13px', color:'#6b5c4c', fontFamily:'monospace' }}>{brandColor}</span>
            </div>
          </div>
          <div style={{ flex:1, minWidth:'160px' }}>
            <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'8px' }}>Logo</label>
            <div onClick={()=>can('whitelabel')&&logoRef.current.click()} style={{ width:'80px', height:'48px', background:'#f0ebe4', border:'1px dashed #d4c8b8', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', cursor: can('whitelabel')?'pointer':'not-allowed', overflow:'hidden' }}>
              {logoPreview ? <img src={logoPreview} alt="logo" style={{ width:'100%', height:'100%', objectFit:'contain' }} /> : <span style={{ fontSize:'20px' }}>🖼️</span>}
            </div>
            <input ref={logoRef} type="file" accept="image/*" onChange={handleLogo} style={{ display:'none' }} />
          </div>
        </div>

        <div style={{ background:'#1a1410', borderRadius:'10px', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
          {logoPreview ? <img src={logoPreview} alt="" style={{ height:'24px', borderRadius:'4px' }} /> : <span>⚖️</span>}
          <span style={{ fontFamily:'Playfair Display, serif', fontSize:'15px', color:'#f5f0eb' }}>
            {estate.name} · HeirSplit
          </span>
        </div>

        <button onClick={saveBranding} disabled={saving || !can('whitelabel')} style={{
          padding:'11px 22px', background: can('whitelabel')?'#1a1410':'#c0b8b0',
          color:'#f5f0eb', border:'none', borderRadius:'8px',
          cursor:can('whitelabel')?'pointer':'not-allowed', fontSize:'14px', fontFamily:'DM Sans, sans-serif',
        }}>{saving?'Saving…':'Save branding'}</button>
      </Card>

      {/* Categories */}
      <Card style={{ padding:'28px' }}>
        <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:'18px', fontWeight:'400', color:'#1a1410', marginBottom:'6px' }}>Categories</h2>
        <p style={{ fontSize:'13px', color:'#8c7b6b', marginBottom:'16px' }}>Manage the item categories available across all estates.</p>
        <button onClick={()=>navigate(`/estate/${id}/categories`)} style={{ padding:'9px 18px', background:'none', border:'1px solid #e0d8d0', borderRadius:'8px', cursor:'pointer', color:'#6b5c4c', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>
          Manage categories →
        </button>
      </Card>
    </div>
  )
}
