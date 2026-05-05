import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function FeedbackWidget({ session, estateId }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('bug')
  const [content, setContent] = useState('')
  const [nps, setNps] = useState(null)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!content.trim() && nps === null) return
    setSending(true)
    await supabase.from('feedback').insert({
      user_id: session?.user?.id || null,
      estate_id: estateId || null,
      type,
      content: content.trim(),
      nps_score: nps,
    })
    setSending(false)
    setSent(true)
    setTimeout(() => { setOpen(false); setSent(false); setContent(''); setNps(null) }, 2000)
  }

  return (
    <>
      {/* Trigger button */}
      <button onClick={() => setOpen(true)} style={{
        position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
        background: '#1a1410', color: '#f5f0eb',
        border: 'none', borderRadius: '20px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        padding: '8px 18px', cursor: 'pointer',
        fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        💬 Feedback
      </button>

      {/* Modal */}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 10000, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
          padding: '80px 20px',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '16px', padding: '28px',
            width: '340px', boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
            fontFamily: 'DM Sans, sans-serif',
          }}>
            {sent ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>🙏</div>
                <div style={{ fontSize: '16px', color: '#1a1410', fontWeight: '500' }}>Thank you!</div>
                <div style={{ fontSize: '13px', color: '#8c7b6b', marginTop: '4px' }}>Your feedback helps us improve</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', fontWeight: '400', color: '#1a1410' }}>
                    Share feedback
                  </h3>
                  <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#a89080', cursor: 'pointer' }}>×</button>
                </div>

                {/* Type selector */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                  {[
                    { id: 'bug', label: '🐛 Bug' },
                    { id: 'idea', label: '💡 Idea' },
                    { id: 'general', label: '💬 General' },
                  ].map(t => (
                    <button key={t.id} onClick={() => setType(t.id)} style={{
                      flex: 1, padding: '7px', border: `2px solid ${type === t.id ? '#1a1410' : '#e0d8d0'}`,
                      borderRadius: '8px', cursor: 'pointer', fontSize: '12px',
                      background: type === t.id ? '#1a1410' : '#fff',
                      color: type === t.id ? '#f5f0eb' : '#6b5c4c',
                      fontFamily: 'DM Sans, sans-serif',
                    }}>{t.label}</button>
                  ))}
                </div>

                {/* Message */}
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={
                    type === 'bug' ? 'What went wrong? What did you expect?' :
                    type === 'idea' ? 'What feature would make this more useful?' :
                    'Tell us what you think…'
                  }
                  rows={4}
                  style={{
                    width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0',
                    borderRadius: '8px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
                    background: '#faf7f3', color: '#1a1410', resize: 'none', outline: 'none',
                    boxSizing: 'border-box', marginBottom: '16px',
                  }}
                />

                {/* NPS score */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '13px', color: '#8c7b6b', marginBottom: '8px' }}>
                    How likely are you to recommend HeirSplit? (optional)
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button key={n} onClick={() => setNps(nps === n ? null : n)} style={{
                        flex: 1, padding: '6px 0', border: `1px solid ${nps === n ? '#1a1410' : '#e0d8d0'}`,
                        borderRadius: '6px', cursor: 'pointer', fontSize: '11px',
                        background: nps === n ? '#1a1410' : nps && n <= nps ? '#f0ebe4' : '#fff',
                        color: nps === n ? '#fff' : '#6b5c4c',
                        fontFamily: 'DM Sans, sans-serif',
                      }}>{n}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a89080', marginTop: '4px' }}>
                    <span>Not likely</span><span>Very likely</span>
                  </div>
                </div>

                <button
                  onClick={send}
                  disabled={sending || (!content.trim() && nps === null)}
                  style={{
                    width: '100%', padding: '12px',
                    background: (content.trim() || nps !== null) ? '#1a1410' : '#c0b8b0',
                    color: '#f5f0eb', border: 'none', borderRadius: '8px',
                    cursor: (content.trim() || nps !== null) ? 'pointer' : 'not-allowed',
                    fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  {sending ? 'Sending…' : 'Send feedback'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
