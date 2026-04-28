import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Goodwill point values
const GOODWILL_EVENTS = {
  chore_small:     { points: 15, label: 'Completed a small task', emoji: '🧹' },
  chore_medium:    { points: 35, label: 'Completed a medium task', emoji: '💪' },
  chore_large:     { points: 70, label: 'Completed a big task', emoji: '🏆' },
  yielded_item:    { points: 25, label: 'Gave up a wanted item', emoji: '🤝' },
  added_items:     { points: 5,  label: 'Added items to inventory', emoji: '📦' },
  drove_to_dump:   { points: 40, label: 'Drove to the dump', emoji: '🚛' },
}

const CHORE_SIZES = [
  { id: 'small',  label: 'Small',  desc: 'Under 1 hour',    points: 15, emoji: '🧹' },
  { id: 'medium', label: 'Medium', desc: '1–3 hours',       points: 35, emoji: '💪' },
  { id: 'large',  label: 'Large',  desc: 'Half/full day',   points: 70, emoji: '🏆' },
  { id: 'dump',   label: 'Dump run', desc: 'Drive to dump', points: 40, emoji: '🚛' },
]

const SCORE_COLORS = ['#c4855a', '#6b8fa8', '#7aaa7a', '#b87ab8', '#c4b06a', '#6ab8b8', '#c46a6a']
const getScoreColor = (i) => SCORE_COLORS[i % SCORE_COLORS.length]

export default function GoodwillPage({ session, profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [members, setMembers] = useState([])
  const [chores, setChores] = useState([])
  const [goodwillLog, setGoodwillLog] = useState([])
  const [myRole, setMyRole] = useState('member')
  const [tab, setTab] = useState('overview')
  const [showAddChore, setShowAddChore] = useState(false)
  const [newChore, setNewChore] = useState({ title: '', description: '', size: 'medium', assigned_to: '' })
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [{ data: mems }, { data: chs }, { data: log }, { data: mem }] = await Promise.all([
      supabase.from('estate_members').select('user_id, profiles(display_name, avatar_color, email)').eq('estate_id', id),
      supabase.from('chores').select('*, assigned_to_profile:profiles!chores_assigned_to_fkey(display_name, avatar_color), completed_by_profile:profiles!chores_completed_by_fkey(display_name, avatar_color)').eq('estate_id', id).order('created_at', { ascending: false }),
      supabase.from('goodwill_log').select('*, profiles(display_name, avatar_color)').eq('estate_id', id).order('created_at', { ascending: false }),
      supabase.from('estate_members').select('role').eq('estate_id', id).eq('user_id', session.user.id).single(),
    ])
    setMembers(mems || [])
    setChores(chs || [])
    setGoodwillLog(log || [])
    setMyRole(mem?.role || 'member')
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase.channel(`goodwill-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chores', filter: `estate_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goodwill_log', filter: `estate_id=eq.${id}` }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id])

  // Calculate goodwill scores per member
  const scores = members.map(m => ({
    ...m,
    score: goodwillLog.filter(e => e.user_id === m.user_id).reduce((sum, e) => sum + (e.points || 0), 0),
    events: goodwillLog.filter(e => e.user_id === m.user_id),
  })).sort((a, b) => b.score - a.score)

  const maxScore = Math.max(...scores.map(s => s.score), 1)
  const myScore = scores.find(s => s.user_id === session.user.id)?.score || 0

  const claimChore = async (choreId) => {
    await supabase.from('chores').update({ assigned_to: session.user.id }).eq('id', choreId)
    load()
  }

  const completeChore = async (chore) => {
    const size = CHORE_SIZES.find(s => s.id === chore.size) || CHORE_SIZES[1]
    await supabase.from('chores').update({ completed: true, completed_by: session.user.id, completed_at: new Date().toISOString() }).eq('id', chore.id)
    await supabase.from('goodwill_log').insert({
      estate_id: id, user_id: session.user.id,
      event_type: `chore_${chore.size}`, points: size.points,
      description: `Completed: ${chore.title}`, reference_id: chore.id,
    })
    load()
  }

  const addChore = async () => {
    if (!newChore.title.trim()) return
    const size = CHORE_SIZES.find(s => s.id === newChore.size)
    await supabase.from('chores').insert({
      estate_id: id, title: newChore.title.trim(),
      description: newChore.description.trim(), size: newChore.size,
      assigned_to: newChore.assigned_to || null,
      added_by: session.user.id, completed: false,
      points: size?.points || 35,
    })
    setNewChore({ title: '', description: '', size: 'medium', assigned_to: '' })
    setShowAddChore(false)
    load()
  }

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', color: '#a89080', fontFamily: 'DM Sans, sans-serif' }}>Loading…</div>

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '28px 16px', fontFamily: 'DM Sans, sans-serif' }}>
      <button onClick={() => navigate(`/estate/${id}`)} style={{ background: 'none', border: 'none', color: '#8c7b6b', cursor: 'pointer', fontSize: '13px', padding: '0 0 20px', fontFamily: 'DM Sans, sans-serif' }}>← Back to estate</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '26px', fontWeight: '400', color: '#1a1410', marginBottom: '4px' }}>⭐ Goodwill & work</h1>
          <p style={{ color: '#8c7b6b', fontSize: '14px' }}>Track contributions, compromises and fairness</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowAddChore(true)} style={{ padding: '9px 18px', background: '#1a1410', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
            + Add task
          </button>
        </div>
      </div>

      {/* My goodwill score highlight */}
      <div style={{ background: 'linear-gradient(135deg, #1a1410 0%, #3a2820 100%)', borderRadius: '14px', padding: '24px', marginBottom: '24px', color: '#f5f0eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#c0a888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your goodwill score</div>
            <div style={{ fontSize: '42px', fontFamily: 'Playfair Display, serif', fontWeight: '400', color: '#f5f0eb' }}>{myScore}</div>
            <div style={{ fontSize: '13px', color: '#c0a888', marginTop: '4px' }}>
              {myScore === 0 ? 'Start contributing to earn goodwill' :
               myScore < 50 ? 'Good start — keep contributing!' :
               myScore < 150 ? 'You\'ve been helpful 👍' :
               myScore < 300 ? 'Strong contributor! 💪' : 'Outstanding contribution! 🏆'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', color: '#c0a888', marginBottom: '8px' }}>Family ranking</div>
            {scores.slice(0, 3).map((s, i) => (
              <div key={s.user_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#c0a888' }}>#{i+1}</span>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: s.profiles?.avatar_color || '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#fff', fontWeight: '600' }}>
                  {(s.profiles?.display_name || '?')[0].toUpperCase()}
                </div>
                <span style={{ fontSize: '13px', color: s.user_id === session.user.id ? '#f5f0eb' : '#c0a888', fontWeight: s.user_id === session.user.id ? '500' : '400' }}>
                  {s.profiles?.display_name} — {s.score} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e8e0d6', marginBottom: '24px' }}>
        {[['overview','⭐ Overview'],['chores','🧹 Tasks'],['log','📋 Activity log']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
            color: tab === t ? '#1a1410' : '#8c7b6b',
            borderBottom: tab === t ? '2px solid #1a1410' : '2px solid transparent',
            marginBottom: '-1px',
          }}>{l}</button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '17px', fontWeight: '400', color: '#1a1410', marginBottom: '20px' }}>Fairness overview</h3>
            {scores.map((s, i) => (
              <div key={s.user_id} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: s.profiles?.avatar_color || getScoreColor(i), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#fff', fontWeight: '500' }}>
                      {(s.profiles?.display_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', color: '#1a1410', fontWeight: s.user_id === session.user.id ? '500' : '400' }}>
                        {s.profiles?.display_name}
                        {s.user_id === session.user.id && <span style={{ fontSize: '11px', color: '#a89080', marginLeft: '6px' }}>(you)</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: '#a89080' }}>{s.events.length} contributions</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontFamily: 'Playfair Display, serif', color: getScoreColor(i) }}>{s.score}</div>
                    <div style={{ fontSize: '11px', color: '#a89080' }}>points</div>
                  </div>
                </div>
                <div style={{ height: '8px', background: '#f0ebe4', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(s.score / maxScore) * 100}%`, background: getScoreColor(i), borderRadius: '4px', transition: 'width 0.5s ease' }} />
                </div>
                {/* Recent events for this person */}
                {s.events.slice(0, 2).map(e => (
                  <div key={e.id} style={{ fontSize: '12px', color: '#8c7b6b', marginTop: '4px', paddingLeft: '42px' }}>
                    {GOODWILL_EVENTS[e.event_type]?.emoji || '⭐'} {e.description} <span style={{ color: '#c4855a' }}>+{e.points}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* How to earn goodwill */}
          <div style={{ background: '#f5f0eb', border: '1px solid #e0d8d0', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ fontSize: '14px', color: '#1a1410', fontWeight: '500', marginBottom: '14px' }}>How to earn goodwill ⭐</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
              {[
                { emoji: '🧹', action: 'Small task (under 1hr)', pts: '+15' },
                { emoji: '💪', action: 'Medium task (1-3hrs)', pts: '+35' },
                { emoji: '🏆', action: 'Big task (half/full day)', pts: '+70' },
                { emoji: '🚛', action: 'Dump run', pts: '+40' },
                { emoji: '🤝', action: 'Yielded a wanted item', pts: '+25' },
                { emoji: '📦', action: 'Added item to inventory', pts: '+5' },
              ].map(g => (
                <div key={g.action} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fff', borderRadius: '8px', border: '1px solid #e0d8d0' }}>
                  <span style={{ fontSize: '13px', color: '#4a3c30' }}>{g.emoji} {g.action}</span>
                  <span style={{ fontSize: '13px', color: '#c4855a', fontWeight: '500', marginLeft: '8px' }}>{g.pts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CHORES TAB */}
      {tab === 'chores' && (
        <div>
          {showAddChore && (
            <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
              <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px', fontWeight: '400', color: '#1a1410', marginBottom: '16px' }}>Add task</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input value={newChore.title} onChange={e => setNewChore(p => ({ ...p, title: e.target.value }))} placeholder="Task title, e.g. Clean out the garage"
                  style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
                <input value={newChore.description} onChange={e => setNewChore(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)"
                  style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {CHORE_SIZES.map(s => (
                    <button key={s.id} onClick={() => setNewChore(p => ({ ...p, size: s.id }))} style={{
                      padding: '9px 14px', border: `2px solid ${newChore.size === s.id ? '#1a1410' : '#e0d8d0'}`,
                      borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
                      background: newChore.size === s.id ? '#1a1410' : '#fff',
                      color: newChore.size === s.id ? '#f5f0eb' : '#6b5c4c',
                    }}>
                      {s.emoji} {s.label} <span style={{ fontSize: '11px', opacity: 0.7 }}>+{s.points}pts</span>
                    </button>
                  ))}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#8c7b6b', marginBottom: '6px' }}>Assign to (optional)</label>
                  <select value={newChore.assigned_to} onChange={e => setNewChore(p => ({ ...p, assigned_to: e.target.value }))}
                    style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}>
                    <option value="">— Anyone can claim —</option>
                    {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profiles?.display_name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setShowAddChore(false)} style={{ flex: 1, padding: '11px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
                  <button onClick={addChore} disabled={!newChore.title.trim()} style={{ flex: 2, padding: '11px', background: newChore.title.trim() ? '#1a1410' : '#c0b8b0', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: newChore.title.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
                    Add task
                  </button>
                </div>
              </div>
            </div>
          )}

          {chores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#a89080' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧹</div>
              <p style={{ marginBottom: '20px' }}>No tasks yet. Add things that need doing — garage, dump runs, packing.</p>
              <button onClick={() => setShowAddChore(true)} style={{ padding: '11px 24px', background: '#1a1410', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>Add first task</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Open tasks */}
              {chores.filter(c => !c.completed).length > 0 && (
                <>
                  <div style={{ fontSize: '13px', color: '#8c7b6b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Open tasks</div>
                  {chores.filter(c => !c.completed).map(chore => (
                    <ChoreCard key={chore.id} chore={chore} session={session} members={members}
                      onClaim={() => claimChore(chore.id)}
                      onComplete={() => completeChore(chore)} />
                  ))}
                </>
              )}
              {/* Completed tasks */}
              {chores.filter(c => c.completed).length > 0 && (
                <>
                  <div style={{ fontSize: '13px', color: '#8c7b6b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '12px 0 4px' }}>Completed ✓</div>
                  {chores.filter(c => c.completed).map(chore => (
                    <ChoreCard key={chore.id} chore={chore} session={session} members={members} completed />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ACTIVITY LOG TAB */}
      {tab === 'log' && (
        <div>
          {goodwillLog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#a89080' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
              <p>No activity yet. Complete tasks and yield items to build goodwill.</p>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', overflow: 'hidden' }}>
              {goodwillLog.map((event, i) => (
                <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', borderBottom: i < goodwillLog.length - 1 ? '1px solid #f5f0eb' : 'none' }}>
                  <div style={{ fontSize: '22px', flexShrink: 0 }}>{GOODWILL_EVENTS[event.event_type]?.emoji || '⭐'}</div>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: event.profiles?.avatar_color || '#8c7b6b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#fff', fontWeight: '500', flexShrink: 0 }}>
                    {(event.profiles?.display_name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', color: '#1a1410' }}>
                      <strong>{event.profiles?.display_name}</strong> — {event.description}
                    </div>
                    <div style={{ fontSize: '12px', color: '#a89080', marginTop: '2px' }}>
                      {new Date(event.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ fontSize: '16px', color: '#c4855a', fontWeight: '500', whiteSpace: 'nowrap' }}>+{event.points} pts</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChoreCard({ chore, session, members, onClaim, onComplete, completed }) {
  const size = CHORE_SIZES.find(s => s.id === chore.size) || CHORE_SIZES[1]
  const isAssignedToMe = chore.assigned_to === session.user.id
  const isUnassigned = !chore.assigned_to

  return (
    <div style={{
      background: completed ? '#f9f9f9' : '#fff',
      border: `1px solid ${isAssignedToMe ? '#b8ddb8' : '#e8e0d6'}`,
      borderRadius: '10px', padding: '16px 18px',
      opacity: completed ? 0.75 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '18px' }}>{size.emoji}</span>
            <span style={{ fontSize: '15px', color: '#1a1410', textDecoration: completed ? 'line-through' : 'none' }}>{chore.title}</span>
          </div>
          {chore.description && <div style={{ fontSize: '13px', color: '#6b5c4c', marginBottom: '8px', paddingLeft: '26px' }}>{chore.description}</div>}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingLeft: '26px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', background: '#f0ebe4', color: '#6b5c4c', padding: '2px 8px', borderRadius: '20px' }}>
              {size.label} · {size.desc}
            </span>
            <span style={{ fontSize: '12px', color: '#c4855a', fontWeight: '500' }}>+{size.points} pts</span>
            {completed && chore.completed_by_profile && (
              <span style={{ fontSize: '12px', color: '#7aaa7a' }}>✓ Done by {chore.completed_by_profile.display_name}</span>
            )}
            {!completed && chore.assigned_to_profile && (
              <span style={{ fontSize: '12px', color: '#6b8fa8' }}>Claimed by {chore.assigned_to_profile.display_name}</span>
            )}
            {!completed && isUnassigned && (
              <span style={{ fontSize: '12px', color: '#a89080', fontStyle: 'italic' }}>Unclaimed — first to complete gets points</span>
            )}
          </div>
        </div>

        {!completed && (
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {isUnassigned && (
              <button onClick={onClaim} style={{ padding: '8px 14px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#6b5c4c', fontFamily: 'DM Sans, sans-serif' }}>
                Claim it
              </button>
            )}
            {(isAssignedToMe || isUnassigned) && (
              <button onClick={onComplete} style={{ padding: '8px 14px', background: '#7aaa7a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>
                ✓ Mark done (+{size.points} pts)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
