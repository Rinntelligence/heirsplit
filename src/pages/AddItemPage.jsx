import { useEffect, useRef, useState, useCallback } from 'react'
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
  const [form, setForm] = useState({
    title: '', category_id: '', description: '',
    estimated_value: '', condition: 'good',
    purchase_price: '', purchase_year: '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [step, setStep] = useState('photo')
  const [followUpAnswers, setFollowUpAnswers] = useState({})
  const [valueEstimate, setValueEstimate] = useState(null)
  const [estimating, setEstimating] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    getCategories().then(({ data }) => {
      setCategories(data || [])
      if (data?.length) setForm(f => ({ ...f, category_id: data[0].id }))
    })
  }, [])

  // Auto-fetch estimate when entering value step
  useEffect(() => {
    if (step === 'value' && !valueEstimate && form.title) {
      fetchEstimate()
    }
  }, [step])

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
      setForm(f => ({
        ...f,
        title: ai.title || f.title,
        description: ai.description || f.description,
        category_id: matchedCat?.id || f.category_id,
        condition: ai.condition || 'good',
      }))
      setStep('details')
      onToast('AI analysis complete! ✓')
    } catch (e) {
      onToast('Analysis failed — fill in manually', 'error')
      setStep('details')
    } finally {
      setAnalyzing(false)
    }
  }

  const fetchEstimate = async () => {
    if (!form.title.trim()) return
    setEstimating(true)
    try {
      const catLabel = categories.find(c => c.id === form.category_id)?.label || 'Other'
      const { data, error } = await supabase.functions.invoke('estimate-value', {
        body: {
          title: form.title,
          description: form.description,
          category: catLabel,
          condition: form.condition,
          purchase_price: parseFloat(form.purchase_price) || null,
          purchase_year: parseInt(form.purchase_year) || null,
          ai_identified_model: aiSuggestions?.identifying_features || null,
        }
      })
      if (error || !data?.success) throw new Error('Estimation failed')
      setValueEstimate(data.data)
      // Auto-fill estimated_value with likely estimate
      if (data.data?.summary?.likely_nok) {
        const low = data.data.summary.low_nok
        const high = data.data.summary.high_nok
        setForm(f => ({ ...f, estimated_value: `${low.toLocaleString()}–${high.toLocaleString()} kr` }))
      }
    } catch (e) {
      // Silently fail — user can still save manually
    } finally {
      setEstimating(false)
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
  const purchaseNum = parseFloat(form.purchase_price) || 0
  const depValue = purchaseNum > 0 && form.purchase_year
    ? Math.max(purchaseNum * Math.pow(1 - depRate, yearsOld), purchaseNum * (VALUE_FLOORS[catLabel] || 0.10))
    : 0

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '28px 16px', fontFamily: 'DM Sans, sans-serif' }}>
      <button onClick={() => navigate(`/estate/${id}`)} style={{ background: 'none', border: 'none', color: '#8c7b6b', cursor: 'pointer', fontSize: '13px', padding: '0 0 20px', fontFamily: 'DM Sans, sans-serif' }}>← Back</button>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', fontWeight: '400', color: '#1a1410', marginBottom: '8px' }}>Add item</h1>
      <p style={{ color: '#8c7b6b', fontSize: '14px', marginBottom: '24px' }}>Take a photo — AI identifies and values the item automatically</p>

      {/* Steps */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[['photo','📸 Photo'],['details','📝 Details'],['value','💰 Value']].map(([s,l]) => (
          <div key={s} onClick={() => (imagePreview || s === 'photo') && setStep(s)} style={{
            flex: 1, padding: '9px', textAlign: 'center', borderRadius: '8px', fontSize: '13px',
            background: step === s ? '#1a1410' : '#f0ebe4',
            color: step === s ? '#f5f0eb' : '#8c7b6b',
            cursor: 'pointer',
          }}>{l}</div>
        ))}
      </div>

      {/* ── PHOTO STEP ── */}
      {step === 'photo' && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '14px', padding: '28px' }}>
          <div onClick={() => fileRef.current.click()} style={{
            height: '240px', background: '#f0ebe4', border: '2px dashed #d4c8b8',
            borderRadius: '12px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden',
          }}>
            {imagePreview
              ? <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <><span style={{ fontSize: '48px', marginBottom: '12px' }}>📸</span>
                 <span style={{ fontSize: '16px', color: '#6b5c4c' }}>Tap to take or upload photo</span>
                 <span style={{ fontSize: '13px', color: '#a89080', marginTop: '6px' }}>AI identifies item + estimates value</span></>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} style={{ display: 'none' }} />

          {imagePreview && (
            <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
              <button onClick={() => { setImageFile(null); setImagePreview(null); setImageBase64(null); setAiSuggestions(null) }}
                style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>Retake</button>
              <button onClick={analyzeWithAI} disabled={analyzing} style={{
                flex: 2, padding: '12px', background: analyzing ? '#c0b8b0' : '#c4855a',
                color: '#fff', border: 'none', borderRadius: '8px',
                cursor: analyzing ? 'not-allowed' : 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
              }}>{analyzing ? '🤖 Analyzing…' : '🤖 Analyze with AI'}</button>
            </div>
          )}

          {analyzing && (
            <div style={{ marginTop: '14px', padding: '14px', background: '#fef3e8', border: '1px solid #e8c4a0', borderRadius: '10px', fontSize: '13px', color: '#854F0B' }}>
              🤖 Identifying item, estimating age and value…
            </div>
          )}

          <button onClick={() => setStep('details')} style={{ marginTop: '14px', width: '100%', padding: '11px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
            Skip — fill in manually →
          </button>

          <div style={{ marginTop: '16px', padding: '14px', background: '#f5f0eb', borderRadius: '10px' }}>
            <div style={{ fontSize: '13px', color: '#6b5c4c', fontWeight: '500', marginBottom: '6px' }}>💡 Best results:</div>
            <div style={{ fontSize: '12px', color: '#8c7b6b', lineHeight: '1.7' }}>Good lighting · Fill the frame · Include labels/markings · Close-ups of unique details</div>
          </div>
        </div>
      )}

      {/* ── DETAILS STEP ── */}
      {step === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {aiSuggestions && (
            <div style={{ background: '#f0faf0', border: '1px solid #b8ddb8', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontSize: '13px', color: '#3a7a3a', fontWeight: '500' }}>✓ AI identified — confidence: {aiSuggestions.confidence}</div>
              {aiSuggestions.estimated_age && <div style={{ fontSize: '12px', color: '#4a3c30', marginTop: '4px' }}>Estimated age: {aiSuggestions.estimated_age}</div>}
              {aiSuggestions.identifying_features && <div style={{ fontSize: '12px', color: '#4a3c30', marginTop: '2px' }}>Notable: {aiSuggestions.identifying_features}</div>}
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
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Samsung 55&quot; TV QLED 2021"
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
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Material, color, condition, history, memories…" rows={3}
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', background: '#faf7f3', color: '#1a1410', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {aiSuggestions?.follow_up_questions?.length > 0 && (
              <div style={{ background: '#fef3e8', border: '1px solid #e8c4a0', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '13px', color: '#854F0B', fontWeight: '500', marginBottom: '10px' }}>🤖 Answer these for a better value estimate:</div>
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
            <button onClick={() => setStep('value')} disabled={!form.title.trim()} style={{
              flex: 2, padding: '12px', background: form.title.trim() ? '#1a1410' : '#c0b8b0',
              color: '#f5f0eb', border: 'none', borderRadius: '8px',
              cursor: form.title.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
            }}>Get value estimate →</button>
          </div>
        </div>
      )}

      {/* ── VALUE STEP ── */}
      {step === 'value' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* AI estimate loading */}
          {estimating && (
            <div style={{ background: '#fef3e8', border: '1px solid #e8c4a0', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</div>
              <div style={{ fontSize: '14px', color: '#854F0B', fontWeight: '500' }}>Estimating value…</div>
              <div style={{ fontSize: '13px', color: '#8c7b6b', marginTop: '4px' }}>Checking market prices and depreciation</div>
            </div>
          )}

          {/* AI value result */}
          {valueEstimate && !estimating && (
            <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Main estimate */}
              <div style={{ padding: '20px', background: 'linear-gradient(135deg, #1a1410 0%, #3a2820 100%)' }}>
                <div style={{ fontSize: '12px', color: '#c0a888', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI value estimate</div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#c0a888' }}>Low</div>
                    <div style={{ fontSize: '18px', color: '#f5f0eb' }}>{valueEstimate.summary?.low_nok?.toLocaleString()} kr</div>
                  </div>
                  <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', minWidth: '40px', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '25%', right: '25%', height: '100%', background: '#c4855a', borderRadius: '2px' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#c0a888' }}>High</div>
                    <div style={{ fontSize: '18px', color: '#f5f0eb' }}>{valueEstimate.summary?.high_nok?.toLocaleString()} kr</div>
                  </div>
                  <div style={{ background: '#c4855a', borderRadius: '10px', padding: '10px 18px', textAlign: 'center', marginLeft: 'auto' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>Most likely</div>
                    <div style={{ fontSize: '24px', color: '#fff', fontFamily: 'Playfair Display, serif' }}>{valueEstimate.summary?.likely_nok?.toLocaleString()} kr</div>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: '#c0a888', marginTop: '12px', lineHeight: '1.6' }}>
                  {valueEstimate.market?.reasoning}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(192,168,136,0.7)', marginTop: '6px' }}>
                  Confidence: {valueEstimate.market?.confidence} · {valueEstimate.market?.category_trend === 'depreciating' ? '📉 Depreciating' : valueEstimate.market?.category_trend === 'appreciating' ? '📈 Appreciating' : '📊 Stable value'}
                  {valueEstimate.market?.estimated_year && ` · Est. year: ${valueEstimate.market.estimated_year}`}
                </div>
              </div>

              {/* Market references */}
              {valueEstimate.market?.market_references?.length > 0 && (
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ebe4' }}>
                  <div style={{ fontSize: '12px', color: '#8c7b6b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Market references</div>
                  {valueEstimate.market.market_references.map((ref, i) => (
                    <div key={i} style={{ fontSize: '13px', color: '#4a3c30', marginBottom: '4px', display: 'flex', gap: '6px' }}>
                      <span style={{ color: '#c4855a' }}>•</span> {ref}
                    </div>
                  ))}
                </div>
              )}

              {/* Depreciation if we have it */}
              {valueEstimate.depreciation && (
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0ebe4', background: '#faf7f3' }}>
                  <div style={{ fontSize: '12px', color: '#8c7b6b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Insurance depreciation model</div>
                  <div style={{ fontSize: '13px', color: '#4a3c30' }}>
                    {valueEstimate.depreciation.original_price?.toLocaleString()} kr original →
                    <strong style={{ color: '#c4855a' }}> {Math.round(valueEstimate.depreciation.value).toLocaleString()} kr</strong> today
                    <span style={{ color: '#a89080', marginLeft: '6px' }}>({valueEstimate.depreciation.years_old} yr × {Math.round(valueEstimate.depreciation.rate_used * 100)}%/yr)</span>
                  </div>
                </div>
              )}

              {/* Check prices yourself links */}
              {valueEstimate.market?.price_check_urls?.length > 0 && (
                <div style={{ padding: '14px 20px' }}>
                  <div style={{ fontSize: '12px', color: '#8c7b6b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Verify prices yourself</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {valueEstimate.market.price_check_urls.map((url, i) => {
                      const label = url.includes('finn.no') ? '🇳🇴 Finn.no' : url.includes('ebay') ? '🌍 eBay sold' : '🔗 Check prices'
                      return (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{
                          padding: '7px 14px', background: '#f0ebe4', border: '1px solid #e0d8d0',
                          borderRadius: '20px', fontSize: '13px', color: '#1a1410', textDecoration: 'none',
                        }}>{label} →</a>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual inputs */}
          <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '14px', color: '#8c7b6b' }}>
              Know the purchase price? Add it for a more accurate depreciation estimate.
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '6px' }}>Purchase price (NOK)</label>
                <input type="number" value={form.purchase_price} onChange={e => { setForm(f => ({ ...f, purchase_price: e.target.value })); setValueEstimate(null) }} placeholder="e.g. 8000"
                  style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '6px' }}>Year bought</label>
                <input type="number" value={form.purchase_year} onChange={e => { setForm(f => ({ ...f, purchase_year: e.target.value })); setValueEstimate(null) }} placeholder="e.g. 2018"
                  style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Recalculate button if price/year changed */}
            {!valueEstimate && form.title && (
              <button onClick={fetchEstimate} disabled={estimating} style={{ padding: '11px', background: '#c4855a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
                {estimating ? '🔍 Estimating…' : '🔍 Recalculate estimate'}
              </button>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '6px' }}>Final value (editable)</label>
              <input value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))} placeholder="e.g. 1000–2500 kr"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
              <div style={{ fontSize: '12px', color: '#a89080', marginTop: '4px' }}>AI filled this in — you can edit it</div>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#b0a090', padding: '0 4px', lineHeight: '1.6' }}>
            ⚠️ Estimates are for guidance only and do not constitute professional appraisal advice.
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
