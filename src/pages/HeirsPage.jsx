import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const RELATIONSHIPS = ['Child', 'Spouse / Partner', 'Sibling', 'Parent', 'Grandchild', 'Executor', 'Lawyer', 'Advisor', 'Other']
const REL_EMOJI = { 'Child': '👧', 'Spouse / Partner': '💑', 'Sibling': '👫', 'Parent': '👨‍👩‍👧', 'Grandchild': '👶', 'Executor': '⚖️', 'Lawyer': '👨‍💼', 'Advisor': '🧑‍💼', 'Other': '👤' }

export default function HeirsPage({ session, profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [heirs, setHeirs] = useState([])
  const [totalValue, setTotalValue] = useState('')
  const [splitMode, setSplitMode] = useState('equal') // equal | custom | assigned
  const [showAdd, setShowAdd] = useState(false)
  const [newHeir, setNewHeir] = useState({ name: '', email: '', relationship: 'Child', notes: '', percentage: '' })
  const [myRole, setMyRole] = useState('member')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: hs }, { data: mem }, { data: es }] = await Promise.all([
      supabase.from('heirs').select('*').eq('estate_id', id).order('created_at'),
      supabase.from('estate_members').select('role').eq('estate_id', id).eq('user_id', session.user.id).single(),
      supabase.from('estates').select('total_value, split_mode').eq('id', id).single(),
    ])
    setHeirs(hs || [])
    setMyRole(mem?.role || 'member')
    if (es?.total_value) setTotalValue(es.total_value.toString())
    if (es?.split_mode) setSplitMode(es.split_mode)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const saveSettings = async () => {
    setSaving(true)
    await supabase.from('estates').update({ total_value: parseFloat(totalValue) || null, split_mode: splitMode }).eq('id', id)
    // Save custom percentages
    if (splitMode === 'custom') {
      for (const heir of heirs) {
        await supabase.from('heirs').update({ percentage: parseFloat(heir.percentage) || 0 }).eq('id', heir.id)
      }
    }
    setSaving(false)
    load()
  }

  const addHeir = async () => {
    if (!newHeir.name.trim()) return
    await supabase.from('heirs').insert({ ...newHeir, estate_id: id, percentage: parseFloat(newHeir.percentage) || 0 })
    setNewHeir({ name: '', email: '', relationship: 'Child', notes: '', percentage: '' })
    setShowAdd(false)
    load()
  }

  const removeHeir = async (heirId) => {
    await supabase.from('heirs').delete().eq('id', heirId)
    load()
  }

  const updateLocalPercentage = (heirId, val) => {
    setHeirs(prev => prev.map(h => h.id === heirId ? { ...h, percentage: val } : h))
  }

  const total = parseFloat(totalValue) || 0
  const equalShare = heirs.length > 0 ? total / heirs.length : 0
  const totalCustom = heirs.reduce((a, h) => a + (parseFloat(h.percentage) || 0), 0)
  const customValid = Math.abs(totalCustom - 100) < 0.1

  const getShare = (heir) => {
    if (!total) return null
    if (splitMode === 'equal') return equalShare
    if (splitMode === 'custom') return total * ((parseFloat(heir.percentage) || 0) / 100)
    return null
  }

  const formatMoney = (n) => {
    if (n === null || isNaN(n)) return '—'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  }

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', color: '#a89080', fontFamily: 'DM Sans, sans-serif' }}>Loading…</div>

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '28px 16px', fontFamily: 'DM Sans, sans-serif' }}>
      <button onClick={() => navigate(`/estate/${id}`)} style={{ background: 'none', border: 'none', color: '#8c7b6b', cursor: 'pointer', fontSize: '13px', padding: '0 0 20px', fontFamily: 'DM Sans, sans-serif' }}>← Back to estate</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '26px', fontWeight: '400', color: '#1a1410', marginBottom: '4px' }}>👨‍👩‍👧 Heirs & distribution</h1>
          <p style={{ color: '#8c7b6b', fontSize: '14px' }}>Manage heirs and calculate how the estate is divided</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '9px 18px', background: '#1a1410', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
          + Add heir
        </button>
      </div>

      {/* Distribution settings */}
      <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', fontWeight: '400', color: '#1a1410', marginBottom: '20px' }}>Distribution calculator</h2>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '8px' }}>Total estate value (approximate)</label>
          <div style={{ position: 'relative', maxWidth: '280px' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#8c7b6b', fontSize: '15px' }}>$</span>
            <input type="number" value={totalValue} onChange={e => setTotalValue(e.target.value)} placeholder="e.g. 500000"
              style={{ width: '100%', padding: '11px 14px 11px 28px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '15px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
          </div>
          <p style={{ fontSize: '12px', color: '#a89080', marginTop: '6px' }}>This is for calculation only — not legally binding</p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '10px' }}>How to split</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'equal', label: '⚖️ Equal split', desc: 'Everyone gets the same' },
              { id: 'custom', label: '📊 Custom %', desc: 'Set percentages manually' },
              { id: 'assigned', label: '🎯 Per item', desc: 'Based on assigned items' },
            ].map(opt => (
              <button key={opt.id} onClick={() => setSplitMode(opt.id)} style={{
                padding: '10px 16px', border: `2px solid ${splitMode === opt.id ? '#1a1410' : '#e0d8d0'}`,
                borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
                background: splitMode === opt.id ? '#1a1410' : '#fff',
                color: splitMode === opt.id ? '#f5f0eb' : '#1a1410',
                textAlign: 'left',
              }}>
                <div style={{ fontWeight: '500' }}>{opt.label}</div>
                <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {myRole === 'admin' && (
          <button onClick={saveSettings} disabled={saving} style={{ padding: '10px 20px', background: '#1a1410', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        )}
      </div>

      {/* Add heir form */}
      {showAdd && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px', fontWeight: '400', color: '#1a1410', marginBottom: '16px' }}>Add heir</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#8c7b6b', marginBottom: '5px' }}>Full name *</label>
                <input value={newHeir.name} onChange={e => setNewHeir(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Sarah Johnson"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#8c7b6b', marginBottom: '5px' }}>Email (to invite)</label>
                <input type="email" value={newHeir.email} onChange={e => setNewHeir(p => ({ ...p, email: e.target.value }))} placeholder="sarah@email.com"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#8c7b6b', marginBottom: '5px' }}>Relationship</label>
                <select value={newHeir.relationship} onChange={e => setNewHeir(p => ({ ...p, relationship: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}>
                  {RELATIONSHIPS.map(r => <option key={r} value={r}>{REL_EMOJI[r]} {r}</option>)}
                </select>
              </div>
              {splitMode === 'custom' && (
                <div style={{ width: '120px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#8c7b6b', marginBottom: '5px' }}>Share %</label>
                  <input type="number" min="0" max="100" value={newHeir.percentage} onChange={e => setNewHeir(p => ({ ...p, percentage: e.target.value }))} placeholder="e.g. 25"
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
                </div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#8c7b6b', marginBottom: '5px' }}>Notes</label>
              <input value={newHeir.notes} onChange={e => setNewHeir(p => ({ ...p, notes: e.target.value }))} placeholder="Any relevant notes…"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              <button onClick={addHeir} disabled={!newHeir.name.trim()} style={{ flex: 2, padding: '10px', background: newHeir.name.trim() ? '#1a1410' : '#c0b8b0', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: newHeir.name.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>Add heir</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom % validation warning */}
      {splitMode === 'custom' && heirs.length > 0 && !customValid && (
        <div style={{ padding: '12px 16px', background: '#fef3e8', border: '1px solid #e8c4a0', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#854F0B' }}>
          ⚠️ Percentages add up to {totalCustom.toFixed(1)}% — must equal exactly 100%
        </div>
      )}
      {splitMode === 'custom' && heirs.length > 0 && customValid && (
        <div style={{ padding: '12px 16px', background: '#f0faf0', border: '1px solid #b8ddb8', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#3a7a3a' }}>
          ✓ Percentages add up to 100% — looks good!
        </div>
      )}

      {/* Heirs list */}
      {heirs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#a89080' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>👨‍👩‍👧</div>
          <p style={{ marginBottom: '20px' }}>No heirs added yet.</p>
          <button onClick={() => setShowAdd(true)} style={{ padding: '11px 24px', background: '#1a1410', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>Add first heir</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {heirs.map((heir, i) => {
            const share = getShare(heir)
            const pct = splitMode === 'equal' ? (heirs.length > 0 ? (100 / heirs.length).toFixed(1) : 0) : (heir.percentage || 0)

            return (
              <div key={heir.id} style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', padding: '20px', display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Avatar */}
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: ['#c4855a','#6b8fa8','#7aaa7a','#b87ab8','#c4b06a'][i % 5], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#fff', fontWeight: '500', flexShrink: 0 }}>
                  {heir.name[0].toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: '160px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '15px', fontWeight: '500', color: '#1a1410' }}>{heir.name}</span>
                    <span style={{ fontSize: '12px', background: '#f5f0eb', color: '#6b5c4c', padding: '2px 8px', borderRadius: '20px' }}>
                      {REL_EMOJI[heir.relationship]} {heir.relationship}
                    </span>
                  </div>
                  {heir.email && <div style={{ fontSize: '12px', color: '#a89080', marginBottom: '4px' }}>✉️ {heir.email}</div>}
                  {heir.notes && <div style={{ fontSize: '13px', color: '#6b5c4c', fontStyle: 'italic' }}>{heir.notes}</div>}
                </div>

                {/* Share */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {splitMode === 'custom' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <input type="number" min="0" max="100" value={heir.percentage || ''} onChange={e => updateLocalPercentage(heir.id, e.target.value)}
                        style={{ width: '70px', padding: '6px 10px', border: '1px solid #e0d8d0', borderRadius: '6px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', textAlign: 'right' }} />
                      <span style={{ fontSize: '14px', color: '#8c7b6b' }}>%</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: '18px', color: '#c4855a', fontFamily: 'Playfair Display, serif', marginBottom: '4px' }}>{pct}%</div>
                  )}
                  {share !== null && (
                    <div style={{ fontSize: '13px', color: '#1a1410', fontWeight: '500' }}>{formatMoney(share)}</div>
                  )}
                  {myRole === 'admin' && (
                    <button onClick={() => removeHeir(heir.id)} style={{ fontSize: '11px', color: '#c0a090', background: 'none', border: 'none', cursor: 'pointer', marginTop: '6px', fontFamily: 'DM Sans, sans-serif' }}>Remove</button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Total row */}
          {total > 0 && (
            <div style={{ background: '#f0ebe4', border: '1px solid #d4c8b8', borderRadius: '10px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#1a1410' }}>Total estate value</span>
              <span style={{ fontSize: '22px', fontFamily: 'Playfair Display, serif', color: '#1a1410' }}>{formatMoney(total)}</span>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '24px', padding: '16px 20px', background: '#f5f0eb', border: '1px solid #e0d8d0', borderRadius: '10px', fontSize: '12px', color: '#8c7b6b', lineHeight: '1.6' }}>
        ⚠️ <strong>Disclaimer:</strong> These calculations are for informational purposes only and do not constitute legal or financial advice. Consult a qualified estate attorney before making distribution decisions.
      </div>
    </div>
  )
}
