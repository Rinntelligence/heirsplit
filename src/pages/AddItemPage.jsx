import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCategories, uploadImage, supabase } from '../lib/supabase'

export default function AddItemPage({ session, profile, onToast }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [condition, setCondition] = useState('good')
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    getCategories().then(({ data }) => {
      setCategories(data || [])
      if (data?.length) setCategoryId(data[0].id)
    })
  }, [])

  const handleImages = (e) => {
    const files = Array.from(e.target.files).slice(0, 5)
    if (!files.length) return
    const newFiles = [...imageFiles, ...files].slice(0, 5)
    setImageFiles(newFiles)
    newFiles.forEach((file, i) => {
      if (imagePreviews[i]) return
      const reader = new FileReader()
      reader.onload = ev => setImagePreviews(prev => {
        const next = [...prev]
        next[i] = ev.target.result
        return next
      })
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const save = async () => {
    if (!title.trim()) { onToast('Legg til navn på gjenstanden', 'error'); return }
    setSaving(true)
    try {
      const { data: newItem, error } = await supabase.from('items').insert({
        estate_id: id,
        title: title.trim(),
        description: description.trim() || null,
        category_id: categoryId || null,
        condition,
        added_by: session.user.id,
        added_by_name: profile?.display_name || '',
        status: 'active',
        image_url: null,
      }).select().single()

      if (error) throw error

      // Upload images one by one
      if (imageFiles.length > 0) {
        const urls = []
        for (const file of imageFiles) {
          try {
            const url = await uploadImage(file, newItem.id + '-' + Date.now())
            urls.push(url)
          } catch (e) { console.error('Bilde feilet:', e) }
        }
        if (urls.length > 0) {
          await supabase.from('items').update({
            image_url: urls[0],
          }).eq('id', newItem.id)
        }
      }

      onToast('Gjenstand lagt til! ✓')
      navigate(`/estate/${id}`)
    } catch (e) {
      console.error('Save error:', e)
      onToast('Feil: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '20px 16px 100px', fontFamily: 'DM Sans, sans-serif' }}>
      <button onClick={() => navigate(`/estate/${id}`)} style={{ background: 'none', border: 'none', color: '#8c7b6b', cursor: 'pointer', fontSize: '14px', padding: '0 0 16px', fontFamily: 'DM Sans, sans-serif' }}>
        ← Tilbake
      </button>

      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', fontWeight: '400', color: '#1a1410', marginBottom: '6px' }}>
        Legg til gjenstand
      </h1>
      <p style={{ color: '#8c7b6b', fontSize: '14px', marginBottom: '24px' }}>
        Fyll inn navn og ta gjerne bilde
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Images */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '8px' }}>
            Bilder (valgfri, maks 5)
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {imagePreviews.map((src, i) => (
              <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', background: '#f0ebe4' }}>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <button onClick={() => removeImage(i)} style={{
                  position: 'absolute', top: '2px', right: '2px',
                  background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
                  borderRadius: '50%', width: '20px', height: '20px',
                  cursor: 'pointer', fontSize: '12px', lineHeight: '1',
                }}>×</button>
              </div>
            ))}
            {imagePreviews.length < 5 && (
              <div onClick={() => fileRef.current.click()} style={{
                width: '80px', height: '80px', borderRadius: '8px',
                border: '2px dashed #d4c8b8', background: '#f5f0eb',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', gap: '4px',
              }}>
                <span style={{ fontSize: '24px' }}>📸</span>
                <span style={{ fontSize: '10px', color: '#8c7b6b' }}>Legg til</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={handleImages} style={{ display: 'none' }} />
        </div>

        {/* Title - most important */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '6px' }}>
            Navn på gjenstand *
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="f.eks. Bestemors gyngestol"
            autoFocus
            style={{
              width: '100%', padding: '14px', border: '1px solid #e0d8d0',
              borderRadius: '10px', fontSize: '16px', background: '#faf7f3',
              color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Category */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '6px' }}>
            Kategori
          </label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{
            width: '100%', padding: '14px', border: '1px solid #e0d8d0',
            borderRadius: '10px', fontSize: '16px', background: '#faf7f3',
            color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif',
          }}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
          </select>
        </div>

        {/* Condition */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '8px' }}>
            Tilstand
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[['excellent','Utmerket'],['good','God'],['fair','Middels'],['poor','Dårlig']].map(([val, label]) => (
              <button key={val} onClick={() => setCondition(val)} style={{
                flex: 1, padding: '10px 4px',
                border: `2px solid ${condition === val ? '#1a1410' : '#e0d8d0'}`,
                borderRadius: '8px', cursor: 'pointer', fontSize: '12px',
                fontFamily: 'DM Sans, sans-serif',
                background: condition === val ? '#1a1410' : '#fff',
                color: condition === val ? '#f5f0eb' : '#6b5c4c',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '6px' }}>
            Beskrivelse (valgfri)
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Materiale, farge, historikk, minner…"
            rows={3}
            style={{
              width: '100%', padding: '14px', border: '1px solid #e0d8d0',
              borderRadius: '10px', fontSize: '15px', fontFamily: 'DM Sans, sans-serif',
              background: '#faf7f3', color: '#1a1410', resize: 'none',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

      </div>

      {/* Fixed save button at bottom - easy to reach on mobile */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '16px', background: '#fff',
        borderTop: '1px solid #e8e0d6',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        zIndex: 100,
      }}>
        <button
          onClick={save}
          disabled={saving || !title.trim()}
          style={{
            width: '100%', maxWidth: '560px', display: 'block', margin: '0 auto',
            padding: '16px',
            background: title.trim() ? '#1a1410' : '#c0b8b0',
            color: '#f5f0eb', border: 'none', borderRadius: '10px',
            cursor: title.trim() ? 'pointer' : 'not-allowed',
            fontSize: '16px', fontFamily: 'DM Sans, sans-serif', fontWeight: '500',
          }}
        >
          {saving ? 'Lagrer…' : '✓ Lagre gjenstand'}
        </button>
      </div>
    </div>
  )
}
