import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCategories, createItem, uploadImage, supabase } from '../lib/supabase'

const DEPRECIATION_RATES = {
  'Electronics': 0.30, 'Furniture': 0.08, 'Art & pictures': 0.02,
  'Jewelry': 0.03, 'Books': 0.10, 'Kitchen': 0.12,
  'Clothing & textiles': 0.20, 'Collectibles': -0.03,
  'Tools': 0.10, 'Sports & outdoors': 0.15, 'Other': 0.12,
}
const VALUE_FLOORS = {
  'Electronics': 0.05, 'Furniture': 0.20, 'Art & pictures': 0.30,
  'Jewelry': 0.40, 'Collectibles': 0.50, 'Other': 0.10,
}

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.content[0].text
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
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [valueEstimate, setValueEstimate] = useState(null)
  const [step, setStep] = useState('photo')
  const fileRef = useRef()

  useEffect(() => {
    getCategories().then(({ data }) => {
      setCategories(data || [])
      if (data?.length) setForm(f => ({ ...f, category_id: data[0].id }))
    })
  }, [])

  // Auto-estimate when entering value step
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
    reader.onload = ev => {
      setImagePreview(ev.target.result)
      setImageBase64(ev.target.result.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  const analyzeWithAI = async () => {
    if (!imageBase64) return
    setAnalyzing(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 800,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: imageFile.type, data: imageBase64 } },
              { type: 'text', text: `Analyze this estate item. Respond ONLY with JSON:
{
  "title": "specific item name with brand/model if visible",
  "description": "material, color, condition, notable features, estimated era",
  "category": "one of: Electronics|Furniture|Art & pictures|Jewelry|Books|Kitchen|Clothing & textiles|Collectibles|Tools|Other",
  "estimated_age": "e.g. 1970s or circa 2015",
  "condition": "excellent|good|fair|poor",
  "identifying_features": "brand, model, hallmarks, serial numbers visible",
  "follow_up_questions": ["question 1", "question 2"],
  "confidence": "high|medium|low"
}` }
            ]
          }]
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      const text = data.content[0].text
      const ai = JSON.parse(text.match(/\{[\s\S]*\}/)[0])
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
    setValueEstimate(null)
    try {
      const catLabel = categories.find(c => c.id === form.category_id)?.label || 'Other'
      const purchaseInfo = form.purchase_price && form.purchase_year
        ? `Original price: ${form.purchase_price} NOK bought in ${form.purchase_year}.`
        : ''
      const prompt = `You are a Norwegian estate appraiser. Estimate the current market value in NOK for this item.

Item: ${form.title}
Category: ${catLabel}
Condition: ${form.condition}
Description: ${form.description || 'none'}
${aiSuggestions?.identifying_features ? `Identifying features: ${aiSuggestions.identifying_features}` : ''}
${aiSuggestions?.estimated_age ? `Estimated age: ${aiSuggestions.estimated_age}` : ''}
${purchaseInfo}

Use your knowledge of finn.no second-hand prices and Norwegian market.
Respond ONLY with this JSON (no other text):
{
  "low_nok": <number>,
  "high_nok": <number>,
  "likely_nok": <number>,
  "reasoning": "max 2 sentences",
  "market_references": ["e.g. Similar item on finn.no: 800-1200 kr", "eBay: $80-120"],
  "estimated_year": "e.g. 2018-2020",
  "confidence": "high|medium|low",
  "trend": "appreciating|stable|depreciating",
  "finn_search": "search terms for finn.no in Norwegian",
  "ebay_search": "search terms for eBay in English"
}`

      const text = await callClaude(prompt)
      const est = JSON.parse(text.match(/\{[\s\S]*\}/)[0])

      // Depreciation calc
      let dep = null
      if (form.purchase_price && form.purchase_year) {
        const yrs = new Date().getFullYear() - parseInt(form.purchase_year)
        const rate = DEPRECIATION_RATES[catLabel] || 0.12
        const floor = VALUE_FLOORS[catLabel] || 0.10
        const val = Math.max(
          parseFloat(form.purchase_price) * Math.pow(1 - rate, yrs),
          parseFloat(form.purchase_price) * floor
        )
        dep = { value: Math.round(val), years: yrs, rate, original: parseFloat(form.purchase_price) }
      }

      setValueEstimate({ ...est, depreciation: dep })
      setForm(f => ({ ...f, estimated_value: `${est.low_nok.toLocaleString()}–${est.high_nok.toLocaleString()} kr` }))
    } catch (e) {
      console.error('Estimate failed:', e)
      onToast('Could not get estimate — add VITE_ANTHROPIC_API_KEY in Vercel', 'error')
    } finally {
      setEstimating(false)
    }
  }

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const { data: newItem, error } = await createItem({
        title: form.title.trim(), category_id: form.category_id || null,
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
    } catch (e) {
      onToast('Error saving: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const catLabel = categories.find(c => c.id === form.category_id)?.label || 'Other'

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '28px 16px', fontFamily: 'DM Sans, sans-serif' }}>
      <button onClick={() => navigate(`/estate/${id}`)} style={{ background: 'none', border: 'none', color: '#8c7b6b', cursor: 'pointer', fontSize: '13px', padding: '0 0 20px', fontFamily: 'DM Sans, sans-serif' }}>← Back</button>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', fontWeight: '400', color: '#1a1410', marginBottom: '6px' }}>Add item</h1>
      <p style={{ color: '#8c7b6b', fontSize: '14px', marginBottom: '24px' }}>Take a photo — AI identifies and values automatically</p>

      {/* Steps */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[['photo','📸 Photo'],['details','📝 Details'],['value','💰 Value']].map(([s,l]) => (
          <div key={s} onClick={() => setStep(s)} style={{
            flex: 1, padding: '9px', textAlign: 'center', borderRadius: '8px', fontSize: '13px',
            background: step === s ? '#1a1410' : '#f0ebe4',
            color: step === s ? '#f5f0eb' : '#8c7b6b', cursor: 'pointer',
          }}>{l}</div>
        ))}
      </div>

      {/* ── PHOTO ── */}
      {step === 'photo' && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '14px', padding: '28px' }}>
          <div onClick={() => fileRef.current.click()} style={{
            height: '220px', background: '#f0ebe4', border: '2px dashed #d4c8b8',
            borderRadius: '12px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden',
          }}>
            {imagePreview
              ? <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <><span style={{ fontSize: '44px', marginBottom: '10px' }}>📸</span>
                 <span style={{ fontSize: '15px', color: '#6b5c4c' }}>Tap to take or upload photo</span>
                 <span style={{ fontSize: '12px', color: '#a89080', marginTop: '4px' }}>AI identifies item and estimates value</span></>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} style={{ display: 'none' }} />

          {imagePreview && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              <button onClick={() => { setImageFile(null); setImagePreview(null); setImageBase64(null); setAiSuggestions(null) }}
                style={{ flex: 1, padding: '11px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>Retake</button>
              <button onClick={analyzeWithAI} disabled={analyzing} style={{
                flex: 2, padding: '11px', background: analyzing ? '#c0b8b0' : '#c4855a',
                color: '#fff', border: 'none', borderRadius: '8px',
                cursor: analyzing ? 'not-allowed' : 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
              }}>{analyzing ? '🤖 Analyzing…' : '🤖 Analyze with AI'}</button>
            </div>
          )}

          {analyzing && (
            <div style={{ marginTop: '12px', padding: '12px', background: '#fef3e8', border: '1px solid #e8c4a0', borderRadius: '8px', fontSize: '13px', color: '#854F0B' }}>
              🤖 Identifying item, estimating age and condition…
            </div>
          )}

          <button onClick={() => setStep('details')} style={{ marginTop: '12px', width: '100%', padding: '11px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
            Skip — fill in manually →
          </button>
        </div>
      )}

      {/* ── DETAILS ── */}
      {step === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {aiSuggestions && (
            <div style={{ background: '#f0faf0', border: '1px solid #b8ddb8', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '13px', color: '#3a7a3a', fontWeight: '500' }}>✓ AI identified — confidence: {aiSuggestions.confidence}</div>
              {aiSuggestions.estimated_age && <div style={{ fontSize: '12px', color: '#4a3c30', marginTop: '3px' }}>Estimated age: {aiSuggestions.estimated_age}</div>}
              {aiSuggestions.identifying_features && <div style={{ fontSize: '12px', color: '#4a3c30', marginTop: '2px' }}>Notable: {aiSuggestions.identifying_features}</div>}
            </div>
          )}

          {imagePreview && (
            <div style={{ height: '90px', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
              <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => setStep('photo')} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontFamily: 'DM Sans, sans-serif' }}>Change</button>
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '5px' }}>Item name *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Samsung 55&quot; QLED TV 2021"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '15px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '5px' }}>Category</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '15px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '7px' }}>Condition</label>
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
              <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '5px' }}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Material, color, history, memories…" rows={3}
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', background: '#faf7f3', color: '#1a1410', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </div>
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

      {/* ── VALUE ── */}
      {step === 'value' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {estimating && (
            <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', padding: '28px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔍</div>
              <div style={{ fontSize: '15px', color: '#1a1410', fontWeight: '500', marginBottom: '4px' }}>Estimating market value…</div>
              <div style={{ fontSize: '13px', color: '#8c7b6b' }}>Checking finn.no prices and depreciation model</div>
            </div>
          )}

          {valueEstimate && !estimating && (
            <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Header with estimate */}
              <div style={{ padding: '20px', background: 'linear-gradient(135deg, #1a1410 0%, #3a2820 100%)' }}>
                <div style={{ fontSize: '11px', color: '#c0a888', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  AI Market Estimate · {catLabel} · {valueEstimate.trend === 'depreciating' ? '📉' : valueEstimate.trend === 'appreciating' ? '📈' : '📊'} {valueEstimate.trend}
                  {valueEstimate.estimated_year && ` · Est. ${valueEstimate.estimated_year}`}
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#c0a888' }}>Low</div>
                    <div style={{ fontSize: '20px', color: '#f5f0eb', fontFamily: 'Playfair Display, serif' }}>{valueEstimate.low_nok?.toLocaleString()} kr</div>
                  </div>
                  <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', minWidth: '30px' }}>
                    <div style={{ width: '60%', marginLeft: '20%', height: '100%', background: '#c4855a', borderRadius: '2px' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#c0a888' }}>High</div>
                    <div style={{ fontSize: '20px', color: '#f5f0eb', fontFamily: 'Playfair Display, serif' }}>{valueEstimate.high_nok?.toLocaleString()} kr</div>
                  </div>
                  <div style={{ background: '#c4855a', borderRadius: '10px', padding: '10px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>Most likely</div>
                    <div style={{ fontSize: '26px', color: '#fff', fontFamily: 'Playfair Display, serif' }}>{valueEstimate.likely_nok?.toLocaleString()} kr</div>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: '#c0a888', marginTop: '12px', lineHeight: '1.6' }}>{valueEstimate.reasoning}</div>
                <div style={{ fontSize: '11px', color: 'rgba(192,168,136,0.6)', marginTop: '4px' }}>Confidence: {valueEstimate.confidence}</div>
              </div>

              {/* Market references */}
              {valueEstimate.market_references?.length > 0 && (
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0ebe4' }}>
                  <div style={{ fontSize: '11px', color: '#a89080', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Market references</div>
                  {valueEstimate.market_references.map((r, i) => (
                    <div key={i} style={{ fontSize: '13px', color: '#4a3c30', marginBottom: '3px' }}>
                      <span style={{ color: '#c4855a' }}>•</span> {r}
                    </div>
                  ))}
                </div>
              )}

              {/* Depreciation */}
              {valueEstimate.depreciation && (
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0ebe4', background: '#faf7f3' }}>
                  <div style={{ fontSize: '11px', color: '#a89080', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Insurance depreciation model</div>
                  <div style={{ fontSize: '13px', color: '#4a3c30' }}>
                    {valueEstimate.depreciation.original.toLocaleString()} kr original →
                    <strong style={{ color: '#c4855a' }}> {valueEstimate.depreciation.value.toLocaleString()} kr</strong> today
                    <span style={{ color: '#a89080' }}> ({valueEstimate.depreciation.years} yr × {Math.round(valueEstimate.depreciation.rate * 100)}%/yr)</span>
                  </div>
                </div>
              )}

              {/* Check yourself links */}
              <div style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: '11px', color: '#a89080', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Verify yourself</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <a href={`https://www.finn.no/bap/forsale/search.html?q=${encodeURIComponent(valueEstimate.finn_search || form.title)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ padding: '7px 14px', background: '#f0ebe4', border: '1px solid #e0d8d0', borderRadius: '20px', fontSize: '13px', color: '#1a1410', textDecoration: 'none' }}>
                    🇳🇴 Finn.no →
                  </a>
                  <a href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(valueEstimate.ebay_search || form.title)}&LH_Sold=1&LH_Complete=1`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ padding: '7px 14px', background: '#f0ebe4', border: '1px solid #e0d8d0', borderRadius: '20px', fontSize: '13px', color: '#1a1410', textDecoration: 'none' }}>
                    🌍 eBay sold →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Manual inputs */}
          <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '13px', color: '#8c7b6b' }}>Know the purchase price? Adds depreciation to the estimate.</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#8c7b6b', marginBottom: '5px' }}>Purchase price (NOK)</label>
                <input type="number" value={form.purchase_price} onChange={e => { setForm(f => ({ ...f, purchase_price: e.target.value })); setValueEstimate(null) }} placeholder="e.g. 8000"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#8c7b6b', marginBottom: '5px' }}>Year bought</label>
                <input type="number" value={form.purchase_year} onChange={e => { setForm(f => ({ ...f, purchase_year: e.target.value })); setValueEstimate(null) }} placeholder="e.g. 2019"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
              </div>
            </div>

            {!valueEstimate && !estimating && (
              <button onClick={fetchEstimate} style={{ padding: '11px', background: '#c4855a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
                🔍 Get value estimate
              </button>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#8c7b6b', marginBottom: '5px' }}>Final value (auto-filled, editable)</label>
              <input value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))} placeholder="e.g. 1000–2500 kr"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
            </div>
          </div>

          <p style={{ fontSize: '11px', color: '#b0a090', lineHeight: '1.6' }}>⚠️ Estimates are for guidance only — not professional appraisal.</p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep('details')} style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>← Back</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '12px', background: '#1a1410', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
              {saving ? 'Saving…' : '✓ Add item'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
