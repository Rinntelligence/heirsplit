import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCategories, uploadImage, supabase } from '../lib/supabase'
import { t, getLang, getMarketUrl, getMarketLabel, formatMoney } from '../lib/lang'

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
  // Multiple images support
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
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

  useEffect(() => {
    if (step === 'value' && !valueEstimate && form.title) fetchEstimate()
  }, [step])

  const handleImages = (e) => {
    const files = Array.from(e.target.files).slice(0, 5) // max 5 images
    if (!files.length) return
    setImageFiles(prev => [...prev, ...files].slice(0, 5))
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        setImagePreviews(prev => [...prev, ev.target.result].slice(0, 5))
        // Use first image for AI analysis
        if (imagePreviews.length === 0) {
          setImageBase64(ev.target.result.split(',')[1])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
    if (index === 0) setImageBase64(null)
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
              { type: 'image', source: { type: 'base64', media_type: imageFiles[0]?.type || 'image/jpeg', data: imageBase64 } },
              { type: 'text', text: `Analyze this estate item. Respond ONLY with JSON:
{
  "title": "specific item name with brand/model if visible",
  "description": "material, color, condition, notable features, estimated era",
  "category": "one of: Electronics|Furniture|Art & pictures|Jewelry|Books|Kitchen|Clothing & textiles|Collectibles|Tools|Other",
  "estimated_age": "e.g. 1970s or circa 2015",
  "condition": "excellent|good|fair|poor",
  "identifying_features": "brand, model, hallmarks visible",
  "follow_up_questions": ["question 1", "question 2"],
  "confidence": "high|medium|low"
}` }
            ]
          }]
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      const ai = JSON.parse(data.content[0].text.match(/\{[\s\S]*\}/)[0])
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
      const lang = getLang()
      const market = lang === 'no' ? 'Norwegian (finn.no prices in NOK)' : 'US/international (eBay prices in USD)'
      const purchaseInfo = form.purchase_price && form.purchase_year
        ? `Original price: ${form.purchase_price} ${lang === 'no' ? 'NOK' : 'USD'} bought in ${form.purchase_year}.` : ''

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
          messages: [{
            role: 'user',
            content: `You are an estate appraiser. Estimate current market value for this item in the ${market} market.

Item: ${form.title}
Category: ${catLabel}
Condition: ${form.condition}
${form.description ? `Description: ${form.description}` : ''}
${aiSuggestions?.identifying_features ? `Features: ${aiSuggestions.identifying_features}` : ''}
${aiSuggestions?.estimated_age ? `Age: ${aiSuggestions.estimated_age}` : ''}
${purchaseInfo}

Respond ONLY with JSON:
{
  "low": <number>,
  "high": <number>,
  "likely": <number>,
  "currency": "${lang === 'no' ? 'NOK' : 'USD'}",
  "reasoning": "max 2 sentences",
  "market_references": ["reference 1", "reference 2"],
  "estimated_year": "e.g. 2018-2020",
  "confidence": "high|medium|low",
  "trend": "appreciating|stable|depreciating",
  "search_terms": "best search terms for ${lang === 'no' ? 'finn.no' : 'eBay'}"
}`
          }]
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)
      const est = JSON.parse(data.content[0].text.match(/\{[\s\S]*\}/)[0])

      // Depreciation calc
      let dep = null
      if (form.purchase_price && form.purchase_year) {
        const yrs = new Date().getFullYear() - parseInt(form.purchase_year)
        const rate = DEPRECIATION_RATES[catLabel] || 0.12
        const floor = VALUE_FLOORS[catLabel] || 0.10
        dep = {
          value: Math.round(Math.max(
            parseFloat(form.purchase_price) * Math.pow(1 - rate, yrs),
            parseFloat(form.purchase_price) * floor
          )),
          years: yrs, rate, original: parseFloat(form.purchase_price)
        }
      }

      setValueEstimate({ ...est, depreciation: dep })
      setForm(f => ({ ...f, estimated_value: `${est.low.toLocaleString()}–${est.high.toLocaleString()} ${est.currency}` }))
    } catch (e) {
      console.error('Estimate failed:', e)
    } finally {
      setEstimating(false)
    }
  }

  const save = async () => {
    if (!form.title.trim()) { onToast('Please add a title', 'error'); return }
    if (!id) { onToast('Error: no estate ID', 'error'); return }
    setSaving(true)
    try {
      // Insert item
      const { data: newItem, error } = await supabase.from('items').insert({
        estate_id: id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category_id: form.category_id || null,
        estimated_value: form.estimated_value.trim() || null,
        condition: form.condition,
        purchase_price: parseFloat(form.purchase_price) || null,
        purchase_year: parseInt(form.purchase_year) || null,
        added_by: session.user.id,
        added_by_name: profile?.display_name || session.user.email,
        status: 'active',
        image_url: null,
      }).select().single()

      if (error) throw error

      // Upload images
      if (imageFiles.length > 0) {
        const uploadedUrls = []
        for (const file of imageFiles) {
          try {
            const url = await uploadImage(file, newItem.id + '-' + Date.now())
            uploadedUrls.push(url)
          } catch (e) { console.error('Image upload failed:', e) }
        }
        // Set first image as main image_url
        if (uploadedUrls.length > 0) {
          await supabase.from('items').update({
            image_url: uploadedUrls[0],
            extra_images: uploadedUrls.slice(1),
          }).eq('id', newItem.id)
        }
      }

      onToast('Item added! ✓')
      navigate(`/estate/${id}`)
    } catch (e) {
      onToast('Error saving: ' + e.message, 'error')
      console.error('Save error:', e)
    } finally {
      setSaving(false)
    }
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
      <button onClick={() => navigate(`/estate/${id}`)} style={{ background: 'none', border: 'none', color: '#8c7b6b', cursor: 'pointer', fontSize: '13px', padding: '0 0 20px', fontFamily: 'DM Sans, sans-serif' }}>
        {t('back')}
      </button>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', fontWeight: '400', color: '#1a1410', marginBottom: '6px' }}>{t('addItemTitle')}</h1>
      <p style={{ color: '#8c7b6b', fontSize: '14px', marginBottom: '24px' }}>{t('addItemSub')}</p>

      {/* Steps */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[['photo', t('photoStep')], ['details', t('detailsStep')], ['value', t('valueStep')]].map(([s, l]) => (
          <div key={s} onClick={() => setStep(s)} style={{
            flex: 1, padding: '9px', textAlign: 'center', borderRadius: '8px', fontSize: '13px',
            background: step === s ? '#1a1410' : '#f0ebe4',
            color: step === s ? '#f5f0eb' : '#8c7b6b', cursor: 'pointer',
          }}>{l}</div>
        ))}
      </div>

      {/* ── PHOTO STEP ── */}
      {step === 'photo' && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '14px', padding: '28px' }}>
          {/* Image grid */}
          <div style={{ display: 'grid', gridTemplateColumns: imagePreviews.length > 0 ? 'repeat(3, 1fr)' : '1fr', gap: '8px', marginBottom: '16px' }}>
            {imagePreviews.map((src, i) => (
              <div key={i} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', aspectRatio: '1', background: '#f0ebe4' }}>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <button onClick={() => removeImage(i)} style={{
                  position: 'absolute', top: '4px', right: '4px',
                  background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
                  borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '12px',
                }}>×</button>
                {i === 0 && <span style={{ position: 'absolute', bottom: '4px', left: '4px', background: '#1a1410', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>Main</span>}
              </div>
            ))}
            {imagePreviews.length < 5 && (
              <div onClick={() => fileRef.current.click()} style={{
                borderRadius: '10px', border: '2px dashed #d4c8b8', background: '#f5f0eb',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', aspectRatio: imagePreviews.length === 0 ? 'auto' : '1',
                minHeight: imagePreviews.length === 0 ? '200px' : 'auto', padding: '16px',
              }}>
                <span style={{ fontSize: imagePreviews.length === 0 ? '44px' : '24px', marginBottom: '8px' }}>📸</span>
                <span style={{ fontSize: '13px', color: '#6b5c4c', textAlign: 'center' }}>
                  {imagePreviews.length === 0 ? t('takePhoto') : `+ Add photo (${imagePreviews.length}/5)`}
                </span>
                {imagePreviews.length === 0 && <span style={{ fontSize: '12px', color: '#a89080', marginTop: '4px' }}>{t('aiIdentifies')}</span>}
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={handleImages} style={{ display: 'none' }} />

          {imagePreviews.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              <button onClick={() => { setImageFiles([]); setImagePreviews([]); setImageBase64(null); setAiSuggestions(null) }}
                style={{ flex: 1, padding: '11px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
                {t('retake')}
              </button>
              {imageBase64 && (
                <button onClick={analyzeWithAI} disabled={analyzing} style={{
                  flex: 2, padding: '11px', background: analyzing ? '#c0b8b0' : '#c4855a',
                  color: '#fff', border: 'none', borderRadius: '8px',
                  cursor: analyzing ? 'not-allowed' : 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
                }}>{analyzing ? t('analyzing') : t('analyzeAI')}</button>
              )}
            </div>
          )}

          <button onClick={() => setStep('details')} style={{ width: '100%', padding: '11px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
            {t('skipAI')}
          </button>
        </div>
      )}

      {/* ── DETAILS STEP ── */}
      {step === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {aiSuggestions && (
            <div style={{ background: '#f0faf0', border: '1px solid #b8ddb8', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '13px', color: '#3a7a3a', fontWeight: '500' }}>✓ AI identified — {aiSuggestions.confidence} confidence</div>
              {aiSuggestions.estimated_age && <div style={{ fontSize: '12px', color: '#4a3c30', marginTop: '3px' }}>Age: {aiSuggestions.estimated_age}</div>}
              {aiSuggestions.identifying_features && <div style={{ fontSize: '12px', color: '#4a3c30', marginTop: '2px' }}>Notable: {aiSuggestions.identifying_features}</div>}
            </div>
          )}

          {imagePreviews.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', height: '70px' }}>
              {imagePreviews.map((src, i) => (
                <div key={i} style={{ width: '70px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#f0ebe4' }} />
                </div>
              ))}
              <button onClick={() => setStep('photo')} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', padding: '0 12px', cursor: 'pointer', fontSize: '12px', color: '#6b5c4c', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>
                Edit photos
              </button>
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '5px' }}>{t('itemName')}</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Oak rocking chair 1920s"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '15px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '5px' }}>{t('category')}</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '15px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '7px' }}>{t('condition')}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['excellent', 'good', 'fair', 'poor'].map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, condition: c }))} style={{
                    flex: 1, padding: '9px 4px', border: `2px solid ${form.condition === c ? '#1a1410' : '#e0d8d0'}`,
                    borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontFamily: 'DM Sans, sans-serif',
                    background: form.condition === c ? '#1a1410' : '#fff',
                    color: form.condition === c ? '#f5f0eb' : '#6b5c4c', textTransform: 'capitalize',
                  }}>{t(c)}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '5px' }}>{t('description')}</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Material, color, history, memories…" rows={3}
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', background: '#faf7f3', color: '#1a1410', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep('photo')} style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>{t('back')}</button>
            <button onClick={() => setStep('value')} disabled={!form.title.trim()} style={{
              flex: 2, padding: '12px', background: form.title.trim() ? '#1a1410' : '#c0b8b0',
              color: '#f5f0eb', border: 'none', borderRadius: '8px',
              cursor: form.title.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
            }}>{t('getEstimate')}</button>
          </div>
          {form.title.trim() && (
            <button onClick={save} disabled={saving} style={{
              width: '100%', padding: '11px', background: 'none', border: '1px solid #e0d8d0',
              borderRadius: '8px', cursor: 'pointer', color: '#8c7b6b', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
            }}>{saving ? t('saving') : t('saveWithout')}</button>
          )}
        </div>
      )}

      {/* ── VALUE STEP ── */}
      {step === 'value' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {estimating && (
            <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', padding: '28px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔍</div>
              <div style={{ fontSize: '14px', color: '#1a1410', fontWeight: '500' }}>{t('estimating')}</div>
            </div>
          )}

          {valueEstimate && !estimating && (
            <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '20px', background: 'linear-gradient(135deg, #1a1410 0%, #3a2820 100%)' }}>
                <div style={{ fontSize: '11px', color: '#c0a888', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t('aiMarketEst')} · {valueEstimate.trend === 'depreciating' ? '📉' : valueEstimate.trend === 'appreciating' ? '📈' : '📊'}
                  {valueEstimate.estimated_year && ` · ${valueEstimate.estimated_year}`}
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#c0a888' }}>{t('low')}</div>
                    <div style={{ fontSize: '20px', color: '#f5f0eb', fontFamily: 'Playfair Display, serif' }}>
                      {valueEstimate.low?.toLocaleString()} {valueEstimate.currency}
                    </div>
                  </div>
                  <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', minWidth: '30px' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#c0a888' }}>{t('high')}</div>
                    <div style={{ fontSize: '20px', color: '#f5f0eb', fontFamily: 'Playfair Display, serif' }}>
                      {valueEstimate.high?.toLocaleString()} {valueEstimate.currency}
                    </div>
                  </div>
                  <div style={{ background: '#c4855a', borderRadius: '10px', padding: '10px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>{t('likelyVal')}</div>
                    <div style={{ fontSize: '26px', color: '#fff', fontFamily: 'Playfair Display, serif' }}>
                      {valueEstimate.likely?.toLocaleString()} {valueEstimate.currency}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: '#c0a888', marginTop: '12px', lineHeight: '1.6' }}>{valueEstimate.reasoning}</div>
              </div>

              {valueEstimate.market_references?.length > 0 && (
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0ebe4' }}>
                  <div style={{ fontSize: '11px', color: '#a89080', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('marketRefs')}</div>
                  {valueEstimate.market_references.map((r, i) => (
                    <div key={i} style={{ fontSize: '13px', color: '#4a3c30', marginBottom: '3px' }}>• {r}</div>
                  ))}
                </div>
              )}

              {valueEstimate.depreciation && (
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0ebe4', background: '#faf7f3' }}>
                  <div style={{ fontSize: '11px', color: '#a89080', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('insuranceModel')}</div>
                  <div style={{ fontSize: '13px', color: '#4a3c30' }}>
                    {valueEstimate.depreciation.original?.toLocaleString()} {valueEstimate.currency} →
                    <strong style={{ color: '#c4855a' }}> {valueEstimate.depreciation.value?.toLocaleString()} {valueEstimate.currency}</strong>
                    <span style={{ color: '#a89080' }}> ({valueEstimate.depreciation.years} yr × {Math.round(valueEstimate.depreciation.rate * 100)}%/yr)</span>
                  </div>
                </div>
              )}

              <div style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: '11px', color: '#a89080', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('verifyYourself')}</div>
                <a href={getMarketUrl(valueEstimate.search_terms || form.title)} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-block', padding: '7px 14px', background: '#f0ebe4', border: '1px solid #e0d8d0', borderRadius: '20px', fontSize: '13px', color: '#1a1410', textDecoration: 'none' }}>
                  {getMarketLabel()}
                </a>
              </div>
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '13px', color: '#8c7b6b' }}>{t('knowPurchasePrice')}</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#8c7b6b', marginBottom: '5px' }}>{t('purchasePrice')}</label>
                <input type="number" value={form.purchase_price} onChange={e => { setForm(f => ({ ...f, purchase_price: e.target.value })); setValueEstimate(null) }} placeholder="e.g. 8000"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#8c7b6b', marginBottom: '5px' }}>{t('yearBought')}</label>
                <input type="number" value={form.purchase_year} onChange={e => { setForm(f => ({ ...f, purchase_year: e.target.value })); setValueEstimate(null) }} placeholder="e.g. 2019"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
              </div>
            </div>

            {!valueEstimate && !estimating && (
              <button onClick={fetchEstimate} style={{ padding: '11px', background: '#c4855a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
                🔍 {t('getEstimate')}
              </button>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#8c7b6b', marginBottom: '5px' }}>{t('finalValue')}</label>
              <input value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))} placeholder="e.g. 1000–2500 kr"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
              {valueEstimate && <div style={{ fontSize: '11px', color: '#a89080', marginTop: '4px' }}>{t('autoFilled')}</div>}
            </div>
          </div>

          <p style={{ fontSize: '11px', color: '#b0a090', lineHeight: '1.6' }}>{t('disclaimer')}</p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep('details')} style={{ flex: 1, padding: '12px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>{t('back')}</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '12px', background: '#1a1410', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
              {saving ? t('saving') : t('addItemBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
