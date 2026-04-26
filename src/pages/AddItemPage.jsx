import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCategories, createItem, uploadImage } from '../lib/supabase'

export default function AddItemPage({ session, profile, onToast }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ title:'', category_id:'', description:'', estimated_value:'' })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    getCategories().then(({ data }) => {
      setCategories(data || [])
      if (data?.length) setForm(f=>({ ...f, category_id: data[0].id }))
    })
  }, [])

  const handleImage = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const save = async () => {
    if (!form.title.trim()) return
    setLoading(true)
    try {
      const { data: newItem, error } = await createItem({
        title: form.title.trim(), category_id: form.category_id,
        description: form.description.trim(), estate_id: id,
        added_by: session.user.id, added_by_name: profile?.display_name || session.user.email,
        estimated_value: form.estimated_value.trim() || null, image_url: null, status: 'active',
      })
      if (error) throw error
      if (imageFile) {
        const url = await uploadImage(imageFile, newItem.id)
        const { supabase } = await import('../lib/supabase')
        await supabase.from('items').update({ image_url: url }).eq('id', newItem.id)
      }
      onToast('Item added! ✓')
      navigate(`/estate/${id}`)
    } catch (e) { onToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth:'560px', margin:'0 auto', padding:'28px 16px', fontFamily:'DM Sans, sans-serif' }}>
      <button onClick={()=>navigate(`/estate/${id}`)} style={{ background:'none', border:'none', color:'#8c7b6b', cursor:'pointer', fontSize:'13px', padding:'0 0 20px', fontFamily:'DM Sans, sans-serif' }}>← Back to estate</button>
      <h1 style={{ fontFamily:'Playfair Display, serif', fontSize:'24px', fontWeight:'400', color:'#1a1410', marginBottom:'28px' }}>Add item</h1>

      <div style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'14px', padding:'32px', display:'flex', flexDirection:'column', gap:'20px' }}>
        <div>
          <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'8px' }}>Photo</label>
          <div onClick={()=>fileRef.current.click()} style={{ height:'200px', background:'#f0ebe4', border:'2px dashed #d4c8b8', borderRadius:'10px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', overflow:'hidden' }}>
            {imagePreview ? <img src={imagePreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <><span style={{ fontSize:'32px', marginBottom:'10px' }}>📷</span><span style={{ fontSize:'14px', color:'#a89080' }}>Click to upload photo</span><span style={{ fontSize:'12px', color:'#b8ada0', marginTop:'4px' }}>JPG, PNG, WEBP</span></>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display:'none' }} />
          {imagePreview && <button onClick={()=>{setImageFile(null);setImagePreview(null)}} style={{ marginTop:'8px', background:'none', border:'none', color:'#a89080', cursor:'pointer', fontSize:'13px', fontFamily:'DM Sans, sans-serif' }}>× Remove photo</button>}
        </div>

        {[
          { key:'title', label:'Item name *', placeholder:'e.g. Grandmother\'s rocking chair' },
          { key:'estimated_value', label:'Estimated value (optional)', placeholder:'e.g. $200 or "sentimental"' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'6px' }}>{label}</label>
            <input value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={placeholder}
              style={{ width:'100%', padding:'11px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'15px', background:'#faf7f3', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
          </div>
        ))}

        <div>
          <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'6px' }}>Category</label>
          <select value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}
            style={{ width:'100%', padding:'11px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'15px', background:'#faf7f3', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif' }}>
            {categories.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'6px' }}>Description</label>
          <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
            placeholder="Material, age, condition, history, memories…" rows={4}
            style={{ width:'100%', padding:'11px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'14px', fontFamily:'DM Sans, sans-serif', background:'#faf7f3', color:'#1a1410', resize:'vertical', outline:'none', boxSizing:'border-box' }} />
        </div>

        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={()=>navigate(`/estate/${id}`)} style={{ flex:1, padding:'12px', background:'none', border:'1px solid #e0d8d0', borderRadius:'8px', cursor:'pointer', color:'#6b5c4c', fontSize:'15px', fontFamily:'DM Sans, sans-serif' }}>Cancel</button>
          <button onClick={save} disabled={!form.title.trim()||loading} style={{
            flex:2, padding:'12px', background:form.title.trim()?'#1a1410':'#c0b8b0',
            color:'#f5f0eb', border:'none', borderRadius:'8px',
            cursor:form.title.trim()?'pointer':'not-allowed', fontSize:'15px', fontFamily:'DM Sans, sans-serif',
          }}>{loading?'Saving…':'Add item'}</button>
        </div>
      </div>
    </div>
  )
}
