import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCategories, createItem, uploadImage, supabase } from '../lib/supabase'

const DEPRECIATION_RATES = {
  'Electronics': 0.30, 'Furniture': 0.08, 'Art & pictures': 0.02,
  'Jewelry': 0.03, 'Books': 0.10, 'Kitchen': 0.12,
  'Clothing & textiles': 0.20, 'Collectibles': -0.03, 'Other': 0.12,
}
const VALUE_FLOORS = {
  'Electronics': 0.05, 'Furniture': 0.20, 'Art & pictures': 0.30,
  'Jewelry': 0.40, 'Collectibles': 0.50, 'Other': 0.10,
}

export default function AddItemPage({ session, profile, onToast }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ title: '', category_id: '', description: '', estimated_value: '', condition: 'good', purchase_price: '', purchase_year: '' })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [step, setStep] = useState('photo')
  const [followUpAnswers, setFollowUpAnswers] = useState({})
  const fileRef = useRef()

  useEffect(() => {
    getCategories().then(({ data }) => {
      setCategories(data || [])
      if (data?.length) setForm(f => ({ ...f, category_id: data[0].id }))
    })
  }, [])

  const handleImage = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target.result)
      setImageBase64(ev.target.result.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  const analyzeWithAI = async () => {
    if (!imageBase64) return
    setAnalyzing(true)
    try {
      const { data, error } = await supabase.functions.invoke('analyze-item', {
        body: { imageBase64, mimeType: imageFile.type }
      })
      if (error || !data?.success) throw new Error(error?.message || 'Analysis failed')
      const ai = data.data
      setAiSuggestions(ai)
      const matchedCat = categories.find(c =>
        c.label.toLowerCase().includes(ai.category?.toLowerCase()) ||
        ai.category?.toLowerCase().includes(c.label.toLowerCase())
      )
      setForm(f => ({ ...f, title: ai.title || f.title, description: ai.description || f.description, category_id: matchedCat?.id || f.category_id, condition: ai.condition || 'good' }))
      setStep('details')
      onToast('AI analysis complete! ✓')
    } catch (e) {
      onToast('Analysis failed: ' + e.message, 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  const save = async () => {
    if (!form.title.trim()) return
    setLoading(true)
    try {
      const { data: newItem, error } = await createItem({
        title: form.title.trim(), category_id: form.category_id,
        description: form.description.trim(), estate_id: id,
        added_by: session.user.id, added_by_name: profile?.display_name || session.user.email,
        estimated_value: form.estimated_value.trim() || null,
        condition: form.condition,
        purchase_price: parseFloat(form.purchase_price) || null,
        purchase_year: parseInt(form.purchase_year) || null,
        image_url: null, status: 'active',
      })
      if (error) throw error
      if (imageFile) {
        const url = await uploadImage(imageFile, newItem.id)
        await supabase.from('items').update({ image_url: url }).eq('id', newItem.id)
      }
      onToast('Item added! ✓')
      navigate(`/estate/${id}`)
    } catch (e) { onToast('Error: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  const catLabel = categories.find(c => c.id === form.category_id)?.label || 'Other'
  const yearsOld = form.purchase_year ? new Date().getFullYear() - parseInt(form.purchase_year) : 0
  const depRate = DEPRECIATION_RATES[catLabel] || 0.12
  const floorPct = VALUE_FLOORS[catLabel] || 0.10
  const purchaseNum = parseFloat(form.purchase_price) || 0
  const depValue = purchaseNum > 0 ? Math.max(purchaseNum * Math.pow(1 - depRate, yearsOld), purchaseNum * floorPct) : 0

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '28px 16px', fontFamily: 'DM Sans, sans-serif' }}>
      <button onClick={() => navigate(`/estate/${id}`)} style={{ background: 'none', border: 'none', color: '#8c7b6b', cursor: 'pointer', fontSize: '13px', padding: '0 0 20px', fontFamily: 'DM Sans, sans-serif' }}>← Back</button>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', fontWeight: '400', color: '#1a1410', marginBottom: '8px' }}>Add item</h1>
      <p style={{ color: '#8c7b6b', fontSize: '14px', marginBottom: '24px' }}>Take a photo — AI identifies and describes the item automatically</p>

      {/* Step tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[['photo','📸 Photo'],['details','📝 Details'],['value','💰 Value']].map(([s,l]) => (
          <div key={s} onClick={() => imagePreview && setStep(s)} style={{
            flex: 1, padding: '9px', textAlign: 'center', borderRadius: '8px', fontSize: '13px',
            background: step === s ? '#1a1410' : '#f0ebe4',
            color: step === s ? '#f5f0eb' : '#8c7b6b',
            cursor: imagePreview ? 'pointer' : 'default',
          }}>{l}</div>
        ))}
      </div>

      {/* PHOTO STEP */}
      {step === 'photo' && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '14px', padding: '28px' }}>
          <div onClick={() => fileRef.current.click()} style={{ height: '240px', background: '#f0ebe4', border: '2px dashed #d4c8b8', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
            {imagePreview
              ? <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <><span style={{ fontSize: '48px', marginBottom: '12px' }}>📸</span><span style={{ fontSize: '16px', color: '#6b5c4c' }}>Tap to take or upload photo</span><span style={{ fontSize: '13px', color: '#a89080', marginTop: '6px' }}>AI will identify and describe the item</span></>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} style={{ display: 'none' }} />

          {imagePreview && (
            <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
              <button onClick={() => { setImageFile(null); setImagePreview(null); setImageBase64(null); setAiSuggestions(null) }} style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>Retake</button>
              <button onClick={analyzeWithAI} disabled={analyzing} style={{ flex: 2, padding: '12px', background: analyzing ? '#c0b8b0' : '#c4855a', color: '#fff', border: 'none', borderRadius: '8px', cursor: analyzing ? 'not-allowed' : 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
                {analyzing ? '🤖 Analyzing…' : '🤖 Analyze with AI'}
              </button>
            </div>
          )}

          {analyzing && (
            <div style={{ marginTop: '16px', padding: '14px', background: '#fef3e8', border: '1px solid #e8c4a0', borderRadius: '10px', fontSize: '13px', color: '#854F0B' }}>
              🤖 Identifying item, estimating age, checking category…
            </div>
          )}

          {!imagePreview && (
            <div style={{ marginTop: '20px', padding: '14px', background: '#f5f0eb', borderRadius: '10px' }}>
              <div style={{ fontSize: '13px', color: '#6b5c4c', fontWeight: '500', marginBottom: '6px' }}>💡 Tips for best results:</div>
              <div style={{ fontSize: '12px', color: '#8c7b6b', lineHeight: '1.7' }}>
                • Good lighting — natural light works best<br/>
                • Fill the frame with the item<br/>
                • Include visible markings, labels or hallmarks<br/>
                • Take close-ups of unique details
              </div>
            </div>
          )}

          <button onClick={() => setStep('details')} style={{ marginTop: '16px', width: '100%', padding: '12px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
            Skip AI — fill in manually →
          </button>
        </div>
      )}

      {/* DETAILS STEP */}
      {step === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {aiSuggestions && (
            <div style={{ background: '#f0faf0', border: '1px solid #b8ddb8', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '13px', color: '#3a7a3a', fontWeight: '500', marginBottom: '6px' }}>✓ AI identified this item — confidence: {aiSuggestions.confidence}</div>
              {aiSuggestions.identifying_features && <div style={{ fontSize: '12px', color: '#4a3c30' }}>Notable: {aiSuggestions.identifying_features}</div>}
            </div>
          )}

          {imagePreview && (
            <div style={{ height: '100px', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
              <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => setStep('photo')} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontFamily: 'DM Sans, sans-serif' }}>Change</button>
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '6px' }}>Item name *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Oak rocking chair, early 1900s"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '15px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '6px' }}>Category</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '15px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '8px' }}>Condition</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['excellent','good','fair','poor'].map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, condition: c }))} style={{
                    flex: 1, padding: '9px 4px', border: `2px solid ${form.condition === c ? '#1a1410' : '#e0d8d0'}`,
                    borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontFamily: 'DM Sans, sans-serif',
                    background: form.condition === c ? '#1a1410' : '#fff',
                    color: form.condition === c ? '#f5f0eb' : '#6b5c4c', textTransform: 'capitalize',
                  }}>{c}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '6px' }}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Material, color, condition, history…" rows={4}
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', background: '#faf7f3', color: '#1a1410', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {aiSuggestions?.follow_up_questions?.length > 0 && (
              <div style={{ background: '#fef3e8', border: '1px solid #e8c4a0', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '13px', color: '#854F0B', fontWeight: '500', marginBottom: '10px' }}>🤖 Answer these to improve value estimate:</div>
                {aiSuggestions.follow_up_questions.map((q, i) => (
                  <div key={i} style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6b5c4c', marginBottom: '4px' }}>{q}</label>
                    <input value={followUpAnswers[i] || ''} onChange={e => setFollowUpAnswers(p => ({ ...p, [i]: e.target.value }))} placeholder="Your answer…"
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #e8c4a0', borderRadius: '6px', fontSize: '13px', background: '#fff', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep('photo')} style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>← Back</button>
            <button onClick={() => setStep('value')} disabled={!form.title.trim()} style={{ flex: 2, padding: '12px', background: form.title.trim() ? '#1a1410' : '#c0b8b0', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: form.title.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* VALUE STEP */}
      {step === 'value' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '15px', color: '#1a1410', fontWeight: '500' }}>{form.title}</div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '6px' }}>Purchase price (NOK)</label>
                <input type="number" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} placeholder="e.g. 8000"
                  style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '6px' }}>Year bought</label>
                <input type="number" value={form.purchase_year} onChange={e => setForm(f => ({ ...f, purchase_year: e.target.value }))} placeholder="e.g. 1992"
                  style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Live depreciation preview */}
            {purchaseNum > 0 && form.purchase_year && (
              <div style={{ background: '#f5f0eb', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontSize: '13px', color: '#6b5c4c', fontWeight: '500', marginBottom: '10px' }}>📊 Insurance depreciation model ({catLabel})</div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {[
                    { l: 'Original', v: `${purchaseNum.toLocaleString()} kr` },
                    { l: 'Age', v: `${yearsOld} years` },
                    { l: 'Dep. rate', v: `${Math.abs(Math.round(depRate * 100))}%/yr` },
                    { l: 'Est. value', v: `${Math.round(depValue).toLocaleString()} kr`, highlight: true },
                  ].map(s => (
                    <div key={s.l} style={{ textAlign: 'center', background: s.highlight ? '#fff' : 'transparent', padding: s.highlight ? '8px 14px' : '4px', borderRadius: '8px', border: s.highlight ? '1px solid #e0d8d0' : 'none' }}>
                      <div style={{ fontSize: '11px', color: '#a89080' }}>{s.l}</div>
                      <div style={{ fontSize: s.highlight ? '18px' : '15px', color: s.highlight ? '#c4855a' : '#1a1410', fontWeight: s.highlight ? '500' : '400' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height: '5px', background: '#e0d8d0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((depValue / purchaseNum) * 100)}%`, background: '#c4855a', borderRadius: '3px' }} />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '6px' }}>Your own estimate (optional)</label>
              <input value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))} placeholder="e.g. 2000-5000 kr  or  sentimental value"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep('details')} style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>← Back</button>
            <button onClick={save} disabled={loading} style={{ flex: 2, padding: '12px', background: '#1a1410', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
              {loading ? 'Saving…' : '✓ Add item'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
