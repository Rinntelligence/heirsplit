import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getItem, getCategories, uploadImage, supabase } from '../lib/supabase'

export default function EditItemPage({ session, profile, onToast }) {
  const { id, itemId } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [categories, setCategories] = useState([])
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [condition, setCondition] = useState('good')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [existingImages, setExistingImages] = useState([])
  const [newFiles, setNewFiles] = useState([])
  const [newPreviews, setNewPreviews] = useState([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    Promise.all([getItem(itemId), getCategories()]).then(([{ data: it }, { data: cats }]) => {
      setItem(it)
      setTitle(it?.title || '')
      setCategoryId(it?.category_id || '')
      setDescription(it?.description || '')
      setCondition(it?.condition || 'good')
      setEstimatedValue(it?.estimated_value || '')
      // Collect all existing images
      const imgs = []
      if (it?.image_url) imgs.push(it.image_url)
      if (it?.extra_images?.length) imgs.push(...it.extra_images)
      setExistingImages(imgs)
      setCategories(cats || [])
    })
  }, [itemId])

  const handleNewImages = (e) => {
    const files = Array.from(e.target.files)
    const total = existingImages.length + newFiles.length + files.length
    if (total > 5) {
      onToast(`Maks 5 bilder totalt (har ${existingImages.length + newFiles.length})`, 'error')
      return
    }
    setNewFiles(prev => [...prev, ...files])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => setNewPreviews(prev => [...prev, ev.target.result])
      reader.readAsDataURL(file)
    })
  }

  const removeExisting = (index) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index))
  }

  const removeNew = (index) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index))
    setNewPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const save = async () => {
    if (!title.trim()) { onToast('Legg til navn', 'error'); return }
    setSaving(true)
    try {
      // Upload new images
      const uploadedUrls = []
      for (const file of newFiles) {
        try {
          const url = await uploadImage(file, itemId + '-' + Date.now())
          uploadedUrls.push(url)
        } catch (e) { console.error('Bilde feilet:', e) }
      }

      // Combine existing + new
      const allImages = [...existingImages, ...uploadedUrls]
      const mainImage = allImages[0] || null
      const extraImages = allImages.slice(1)

      const { error } = await supabase.from('items').update({
        title: title.trim(),
        category_id: categoryId || null,
        description: description.trim() || null,
        condition,
        estimated_value: estimatedValue.trim() || null,
        image_url: mainImage,
        extra_images: extraImages,
      }).eq('id', itemId)

      if (error) throw error
      onToast('Gjenstand oppdatert ✓')
      navigate(`/estate/${id}/item/${itemId}`)
    } catch (e) {
      onToast('Feil: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!item) return <div style={{ padding:'80px', textAlign:'center', color:'#a89080', fontFamily:'DM Sans, sans-serif' }}>Laster…</div>

  const totalImages = existingImages.length + newFiles.length

  return (
    <div style={{ maxWidth:'560px', margin:'0 auto', padding:'20px 16px 100px', fontFamily:'DM Sans, sans-serif' }}>
      <button onClick={() => navigate(`/estate/${id}/item/${itemId}`)} style={{ background:'none', border:'none', color:'#8c7b6b', cursor:'pointer', fontSize:'14px', padding:'0 0 16px', fontFamily:'DM Sans, sans-serif' }}>
        ← Tilbake
      </button>

      <h1 style={{ fontFamily:'Playfair Display, serif', fontSize:'24px', fontWeight:'400', color:'#1a1410', marginBottom:'24px' }}>
        Rediger gjenstand
      </h1>

      <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

        {/* Images */}
        <div>
          <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'8px' }}>
            Bilder ({totalImages}/5)
          </label>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {/* Existing images */}
            {existingImages.map((url, i) => (
              <div key={`ex-${i}`} style={{ position:'relative', width:'80px', height:'80px', borderRadius:'8px', overflow:'hidden', background:'#f0ebe4' }}>
                <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                <button onClick={() => removeExisting(i)} style={{
                  position:'absolute', top:'2px', right:'2px',
                  background:'rgba(192,57,43,0.85)', color:'#fff', border:'none',
                  borderRadius:'50%', width:'20px', height:'20px',
                  cursor:'pointer', fontSize:'12px', lineHeight:'1',
                }}>×</button>
                {i === 0 && <span style={{ position:'absolute', bottom:'2px', left:'2px', background:'#1a1410', color:'#fff', fontSize:'9px', padding:'1px 4px', borderRadius:'4px' }}>Hoved</span>}
              </div>
            ))}

            {/* New image previews */}
            {newPreviews.map((src, i) => (
              <div key={`new-${i}`} style={{ position:'relative', width:'80px', height:'80px', borderRadius:'8px', overflow:'hidden', background:'#f0ebe4', border:'2px solid #7aaa7a' }}>
                <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                <button onClick={() => removeNew(i)} style={{
                  position:'absolute', top:'2px', right:'2px',
                  background:'rgba(192,57,43,0.85)', color:'#fff', border:'none',
                  borderRadius:'50%', width:'20px', height:'20px',
                  cursor:'pointer', fontSize:'12px', lineHeight:'1',
                }}>×</button>
                <span style={{ position:'absolute', bottom:'2px', left:'2px', background:'#7aaa7a', color:'#fff', fontSize:'9px', padding:'1px 4px', borderRadius:'4px' }}>Ny</span>
              </div>
            ))}

            {/* Add more button */}
            {totalImages < 5 && (
              <div onClick={() => fileRef.current.click()} style={{
                width:'80px', height:'80px', borderRadius:'8px',
                border:'2px dashed #d4c8b8', background:'#f5f0eb',
                display:'flex', flexDirection:'column', alignItems:'center',
                justifyContent:'center', cursor:'pointer', gap:'4px',
              }}>
                <span style={{ fontSize:'24px' }}>📸</span>
                <span style={{ fontSize:'10px', color:'#8c7b6b' }}>Legg til</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={handleNewImages} style={{ display:'none' }} />
        </div>

        {/* Title */}
        <div>
          <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'6px' }}>Navn *</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            style={{ width:'100%', padding:'14px', border:'1px solid #e0d8d0', borderRadius:'10px', fontSize:'16px', background:'#faf7f3', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
        </div>

        {/* Category */}
        <div>
          <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'6px' }}>Kategori</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{ width:'100%', padding:'14px', border:'1px solid #e0d8d0', borderRadius:'10px', fontSize:'16px', background:'#faf7f3', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif' }}>
            <option value="">— Velg kategori —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
          </select>
        </div>

        {/* Condition */}
        <div>
          <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'8px' }}>Tilstand</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {[['excellent','Utmerket'],['good','God'],['fair','Middels'],['poor','Dårlig']].map(([val, label]) => (
              <button key={val} onClick={() => setCondition(val)} style={{
                flex:1, padding:'10px 4px',
                border:`2px solid ${condition===val?'#1a1410':'#e0d8d0'}`,
                borderRadius:'8px', cursor:'pointer', fontSize:'12px',
                fontFamily:'DM Sans, sans-serif',
                background: condition===val?'#1a1410':'#fff',
                color: condition===val?'#f5f0eb':'#6b5c4c',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'6px' }}>Beskrivelse</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
            placeholder="Materiale, farge, historikk…"
            style={{ width:'100%', padding:'14px', border:'1px solid #e0d8d0', borderRadius:'10px', fontSize:'15px', fontFamily:'DM Sans, sans-serif', background:'#faf7f3', color:'#1a1410', resize:'none', outline:'none', boxSizing:'border-box' }} />
        </div>

        {/* Estimated value */}
        <div>
          <label style={{ display:'block', fontSize:'13px', color:'#8c7b6b', marginBottom:'6px' }}>Estimert verdi (valgfri)</label>
          <input value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)}
            placeholder="f.eks. 1000-2000 kr"
            style={{ width:'100%', padding:'14px', border:'1px solid #e0d8d0', borderRadius:'10px', fontSize:'15px', background:'#faf7f3', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
        </div>
      </div>

      {/* Fixed save button */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'16px', background:'#fff', borderTop:'1px solid #e8e0d6', boxShadow:'0 -4px 20px rgba(0,0,0,0.08)', zIndex:100 }}>
        <button onClick={save} disabled={saving || !title.trim()} style={{
          width:'100%', maxWidth:'560px', display:'block', margin:'0 auto',
          padding:'16px', background: title.trim() ? '#1a1410' : '#c0b8b0',
          color:'#f5f0eb', border:'none', borderRadius:'10px',
          cursor: title.trim() ? 'pointer' : 'not-allowed',
          fontSize:'16px', fontFamily:'DM Sans, sans-serif', fontWeight:'500',
        }}>{saving ? 'Lagrer…' : '✓ Lagre endringer'}</button>
      </div>
    </div>
  )
}
