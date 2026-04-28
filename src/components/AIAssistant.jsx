import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AIAssistant({ item, profile }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [valueResult, setValueResult] = useState(null)
  const [estimating, setEstimating] = useState(false)
  const endRef = useRef()

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initial greeting when opened
  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = {
        role: 'assistant',
        content: `Hi! I'm here to help with "${item.title}". I can help you identify it more precisely, estimate its value, or answer any questions about it.\n\n${item.estimated_value ? `The current value estimate is: ${item.estimated_value}.\n\n` : ''}What would you like to know?`
      }
      setMessages([greeting])
    }
  }, [open])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          itemContext: {
            title: item.title,
            description: item.description,
            category: item.categories?.label,
            condition: item.condition,
            estimated_value: item.estimated_value,
            purchase_price: item.purchase_price,
            purchase_year: item.purchase_year,
          }
        }
      })
      if (error || !data?.success) throw new Error('Failed to get response')
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const getAIValueEstimate = async () => {
    setEstimating(true)
    try {
      const { data, error } = await supabase.functions.invoke('estimate-value', {
        body: {
          title: item.title,
          description: item.description,
          category: item.categories?.label || 'Other',
          condition: item.condition || 'good',
          purchase_price: item.purchase_price,
          purchase_year: item.purchase_year,
        }
      })
      if (error || !data?.success) throw new Error('Estimation failed')
      setValueResult(data.data)
    } catch (e) {
      alert('Value estimation failed: ' + e.message)
    } finally {
      setEstimating(false)
    }
  }

  return (
    <div>
      {/* Value estimator */}
      <div style={{ marginBottom: '16px' }}>
        <button onClick={getAIValueEstimate} disabled={estimating} style={{
          width: '100%', padding: '12px', background: estimating ? '#c0b8b0' : '#f0ebe4',
          color: '#1a1410', border: '1px solid #d4c8b8', borderRadius: '10px',
          cursor: estimating ? 'not-allowed' : 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          {estimating ? '🔍 Searching eBay & calculating…' : '💰 Get AI value estimate + eBay prices'}
        </button>

        {valueResult && (
          <div style={{ marginTop: '12px', background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Market estimate */}
            <div style={{ padding: '20px', borderBottom: '1px solid #f0ebe4' }}>
              <div style={{ fontSize: '13px', color: '#8c7b6b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Market Estimate</div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#a89080' }}>Low</div>
                  <div style={{ fontSize: '16px', color: '#1a1410' }}>{valueResult.summary?.low_nok?.toLocaleString()} kr</div>
                </div>
                <div style={{ flex: 1, height: '4px', background: '#f0ebe4', borderRadius: '2px', position: 'relative', minWidth: '60px' }}>
                  <div style={{ position: 'absolute', left: '30%', right: '30%', height: '100%', background: '#c4855a', borderRadius: '2px' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#a89080' }}>High</div>
                  <div style={{ fontSize: '16px', color: '#1a1410' }}>{valueResult.summary?.high_nok?.toLocaleString()} kr</div>
                </div>
                <div style={{ background: '#fef3e8', border: '1px solid #e8c4a0', borderRadius: '8px', padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#854F0B' }}>Most likely</div>
                  <div style={{ fontSize: '20px', color: '#c4855a', fontWeight: '500' }}>{valueResult.summary?.likely_nok?.toLocaleString()} kr</div>
                </div>
              </div>
              {valueResult.market?.reasoning && (
                <p style={{ fontSize: '13px', color: '#6b5c4c', marginTop: '12px', lineHeight: '1.6', fontStyle: 'italic' }}>
                  {valueResult.market.reasoning}
                </p>
              )}
              <div style={{ fontSize: '12px', color: '#a89080', marginTop: '6px' }}>
                Confidence: {valueResult.market?.confidence} · {valueResult.market?.market_notes}
              </div>
            </div>

            {/* Depreciation */}
            {valueResult.depreciation && (
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ebe4', background: '#faf7f3' }}>
                <div style={{ fontSize: '13px', color: '#8c7b6b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Insurance depreciation model</div>
                <div style={{ fontSize: '14px', color: '#1a1410' }}>
                  {valueResult.depreciation.original_price?.toLocaleString()} kr original → <strong>{Math.round(valueResult.depreciation.value).toLocaleString()} kr</strong> today
                  <span style={{ fontSize: '12px', color: '#a89080', marginLeft: '6px' }}>({valueResult.depreciation.years_old} yr at {Math.round(valueResult.depreciation.rate_used * 100)}%/yr)</span>
                </div>
              </div>
            )}

            {/* eBay sold listings */}
            {valueResult.ebay_sold?.length > 0 && (
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '13px', color: '#8c7b6b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent eBay sold listings</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {valueResult.ebay_sold.slice(0, 4).map((e, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '6px 0', borderBottom: i < 3 ? '1px solid #f5f0eb' : 'none' }}>
                      <span style={{ color: '#4a3c30', flex: 1, paddingRight: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                      <span style={{ color: '#c4855a', fontWeight: '500', whiteSpace: 'nowrap' }}>{Math.round(e.price * 10.5).toLocaleString()} kr</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding: '10px 20px', background: '#f5f0eb', fontSize: '11px', color: '#a89080' }}>
              ⚠️ Estimates are for guidance only and do not constitute professional appraisal
            </div>
          </div>
        )}
      </div>

      {/* AI Chat */}
      <div style={{ border: '1px solid #e8e0d6', borderRadius: '12px', overflow: 'hidden' }}>
        <button onClick={() => setOpen(!open)} style={{
          width: '100%', padding: '14px 18px', background: open ? '#1a1410' : '#faf7f3',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'DM Sans, sans-serif',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🤖</span>
            <span style={{ fontSize: '14px', color: open ? '#f5f0eb' : '#1a1410', fontWeight: '500' }}>AI Assistant</span>
            <span style={{ fontSize: '12px', color: open ? '#c0a888' : '#8c7b6b' }}>Ask about this item</span>
          </div>
          <span style={{ color: open ? '#f5f0eb' : '#8c7b6b', fontSize: '16px' }}>{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div>
            <div style={{ height: '260px', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#fff' }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {m.role === 'assistant' && (
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1a1410', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>🤖</div>
                  )}
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px', borderRadius: '10px', fontSize: '14px', lineHeight: '1.6',
                    background: m.role === 'user' ? '#1a1410' : '#f5f0eb',
                    color: m.role === 'user' ? '#f5f0eb' : '#1a1410',
                    whiteSpace: 'pre-wrap',
                  }}>{m.content}</div>
                  {m.role === 'user' && (
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: profile?.avatar_color || '#c4855a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#fff', fontWeight: '500', flexShrink: 0 }}>
                      {(profile?.display_name || 'U')[0].toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1a1410', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🤖</div>
                  <div style={{ padding: '10px 14px', background: '#f5f0eb', borderRadius: '10px', fontSize: '14px', color: '#8c7b6b' }}>Thinking…</div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Quick prompts */}
            <div style={{ padding: '8px 16px', background: '#faf7f3', borderTop: '1px solid #f0ebe4', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['What is this worth?', 'How old is it?', 'Is it rare?', 'Should I get it appraised?'].map(q => (
                <button key={q} onClick={() => { setInput(q); }} style={{
                  padding: '5px 10px', background: '#fff', border: '1px solid #e0d8d0',
                  borderRadius: '20px', cursor: 'pointer', fontSize: '12px', color: '#6b5c4c', fontFamily: 'DM Sans, sans-serif',
                }}>{q}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', padding: '12px 16px', background: '#fff', borderTop: '1px solid #f0ebe4' }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Ask about this item…"
                style={{ flex: 1, padding: '10px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
              <button onClick={send} disabled={loading || !input.trim()} style={{
                padding: '10px 18px', background: input.trim() ? '#1a1410' : '#c0b8b0',
                color: '#f5f0eb', border: 'none', borderRadius: '8px',
                cursor: input.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
              }}>Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
