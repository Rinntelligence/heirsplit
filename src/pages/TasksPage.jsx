import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DEFAULT_TASKS = [
  { category: 'Immediate', title: 'Register the death', description: 'Obtain death certificate from hospital or doctor', priority: 1 },
  { category: 'Immediate', title: 'Notify close family', description: 'Inform immediate family members and close friends', priority: 2 },
  { category: 'Immediate', title: 'Contact funeral home', description: 'Arrange funeral and burial or cremation', priority: 3 },
  { category: 'Week 1', title: 'Notify the bank', description: 'Inform all banks and freeze or transfer accounts', priority: 4 },
  { category: 'Week 1', title: 'Locate the will / testament', description: 'Find original signed will and any related documents', priority: 5 },
  { category: 'Week 1', title: 'Contact life insurance', description: 'File life insurance claims with all providers', priority: 6 },
  { category: 'Week 1', title: 'Secure property', description: 'Ensure home and valuables are locked and secure', priority: 7 },
  { category: 'Month 1', title: 'Apply for probate', description: 'Start legal process to validate the will and distribute estate', priority: 8 },
  { category: 'Month 1', title: 'Cancel subscriptions', description: 'Cancel Netflix, phone, gym, magazines and other recurring services', priority: 9 },
  { category: 'Month 1', title: 'Redirect post / mail', description: 'Set up mail forwarding to executor', priority: 10 },
  { category: 'Month 1', title: 'Notify pension / social security', description: 'Inform relevant government and pension bodies', priority: 11 },
  { category: 'Month 1', title: 'File final tax return', description: 'Prepare and file final personal tax return', priority: 12 },
  { category: 'Distribution', title: 'Inventory all assets', description: 'Create full list of property, accounts, vehicles and valuables', priority: 13 },
  { category: 'Distribution', title: 'Pay outstanding debts', description: 'Settle any remaining loans, credit cards or bills', priority: 14 },
  { category: 'Distribution', title: 'Distribute estate to heirs', description: 'Transfer assets and items according to the will', priority: 15 },
  { category: 'Distribution', title: 'Close estate accounts', description: 'Close any estate bank accounts and complete final paperwork', priority: 16 },
]

const CATEGORY_ORDER = ['Immediate', 'Week 1', 'Month 1', 'Distribution']
const CATEGORY_COLORS = {
  'Immediate': { bg: '#fef3e8', border: '#e8c4a0', text: '#854F0B', dot: '#c4855a' },
  'Week 1':    { bg: '#e8f0fe', border: '#b3c6f5', text: '#1a56db', dot: '#6b8fa8' },
  'Month 1':   { bg: '#f0faf0', border: '#b8ddb8', text: '#3a7a3a', dot: '#7aaa7a' },
  'Distribution': { bg: '#f5f0fb', border: '#d4b8f0', text: '#5a3a8a', dot: '#b87ab8' },
}

export default function TasksPage({ session, profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', category: 'Week 1', due_date: '' })
  const [myRole, setMyRole] = useState('member')

  const load = async () => {
    const [{ data: ts }, { data: mems }, { data: mem }] = await Promise.all([
      supabase.from('tasks').select('*, assigned_to_profile:profiles!tasks_assigned_to_fkey(display_name, avatar_color)')
        .eq('estate_id', id).order('priority').order('created_at'),
      supabase.from('estate_members').select('user_id, profiles(display_name, avatar_color)').eq('estate_id', id),
      supabase.from('estate_members').select('role').eq('estate_id', id).eq('user_id', session.user.id).single(),
    ])
    setTasks(ts || [])
    setMembers(mems || [])
    setMyRole(mem?.role || 'member')
    setLoading(false)
  }

  const seedTasks = async () => {
    const toInsert = DEFAULT_TASKS.map(t => ({ ...t, estate_id: id, completed: false, added_by: session.user.id }))
    await supabase.from('tasks').insert(toInsert)
    load()
  }

  useEffect(() => { load() }, [id])

  const toggleTask = async (task) => {
    await supabase.from('tasks').update({ completed: !task.completed, completed_by: !task.completed ? session.user.id : null, completed_at: !task.completed ? new Date().toISOString() : null }).eq('id', task.id)
    load()
  }

  const assignTask = async (taskId, userId) => {
    await supabase.from('tasks').update({ assigned_to: userId || null }).eq('id', taskId)
    load()
  }

  const addTask = async () => {
    if (!newTask.title.trim()) return
    await supabase.from('tasks').insert({ ...newTask, estate_id: id, completed: false, added_by: session.user.id, priority: 99 })
    setNewTask({ title: '', description: '', category: 'Week 1', due_date: '' })
    setShowAdd(false)
    load()
  }

  const deleteTask = async (taskId) => {
    await supabase.from('tasks').delete().eq('id', taskId)
    load()
  }

  const completed = tasks.filter(t => t.completed).length
  const total = tasks.length
  const progress = total ? Math.round((completed / total) * 100) : 0

  if (loading) return <Loader />

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = tasks.filter(t => t.category === cat)
    return acc
  }, {})
  const otherCats = [...new Set(tasks.map(t => t.category))].filter(c => !CATEGORY_ORDER.includes(c))
  otherCats.forEach(cat => { grouped[cat] = tasks.filter(t => t.category === cat) })
  const allCats = [...CATEGORY_ORDER, ...otherCats].filter(cat => (grouped[cat] || []).length > 0)

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '28px 16px', fontFamily: 'DM Sans, sans-serif' }}>
      <button onClick={() => navigate(`/estate/${id}`)} style={{ background: 'none', border: 'none', color: '#8c7b6b', cursor: 'pointer', fontSize: '13px', padding: '0 0 20px', fontFamily: 'DM Sans, sans-serif' }}>← Back to estate</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '26px', fontWeight: '400', color: '#1a1410', marginBottom: '4px' }}>📋 Task checklist</h1>
          <p style={{ color: '#8c7b6b', fontSize: '14px' }}>Step-by-step guide through the estate process</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {tasks.length === 0 && (
            <button onClick={seedTasks} style={{ padding: '9px 18px', background: '#c4855a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
              Load default checklist
            </button>
          )}
          <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '9px 18px', background: '#1a1410', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
            + Add task
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px', color: '#1a1410', fontWeight: '500' }}>Overall progress</span>
            <span style={{ fontSize: '22px', fontFamily: 'Playfair Display, serif', color: progress === 100 ? '#7aaa7a' : '#1a1410' }}>{progress}%</span>
          </div>
          <div style={{ height: '8px', background: '#f0ebe4', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#7aaa7a' : '#c4855a', borderRadius: '4px', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ fontSize: '13px', color: '#a89080', marginTop: '8px' }}>{completed} of {total} tasks completed</div>
        </div>
      )}

      {/* Add task form */}
      {showAdd && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', color: '#1a1410', marginBottom: '16px', fontFamily: 'Playfair Display, serif', fontWeight: '400' }}>Add custom task</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Task title *"
              style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
            <input value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)"
              style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select value={newTask.category} onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))}
                style={{ flex: 1, padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}>
                {[...CATEGORY_ORDER, 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="date" value={newTask.due_date} onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))}
                style={{ flex: 1, padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              <button onClick={addTask} disabled={!newTask.title.trim()} style={{ flex: 2, padding: '10px', background: newTask.title.trim() ? '#1a1410' : '#c0b8b0', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: newTask.title.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>Add task</button>
            </div>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#a89080' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <p style={{ marginBottom: '20px', fontSize: '15px' }}>No tasks yet. Load the default checklist to get started.</p>
          <button onClick={seedTasks} style={{ padding: '12px 28px', background: '#c4855a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontFamily: 'DM Sans, sans-serif' }}>Load default checklist</button>
        </div>
      ) : (
        allCats.map(cat => {
          const catTasks = grouped[cat] || []
          const colors = CATEGORY_COLORS[cat] || { bg: '#f5f0eb', border: '#e0d8d0', text: '#6b5c4c', dot: '#a89080' }
          const catDone = catTasks.filter(t => t.completed).length
          return (
            <div key={cat} style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: colors.dot, flexShrink: 0 }} />
                <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '17px', fontWeight: '400', color: '#1a1410' }}>{cat}</h2>
                <span style={{ fontSize: '12px', color: colors.text, background: colors.bg, border: `1px solid ${colors.border}`, padding: '2px 8px', borderRadius: '20px' }}>{catDone}/{catTasks.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {catTasks.map(task => (
                  <TaskRow key={task.id} task={task} members={members} session={session} myRole={myRole}
                    onToggle={() => toggleTask(task)}
                    onAssign={(uid) => assignTask(task.id, uid)}
                    onDelete={() => deleteTask(task.id)} />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

function TaskRow({ task, members, session, myRole, onToggle, onAssign, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const isOverdue = task.due_date && !task.completed && new Date(task.due_date) < new Date()

  return (
    <div style={{
      background: task.completed ? '#f9f9f9' : '#fff',
      border: `1px solid ${isOverdue ? '#e8c4a0' : '#e8e0d6'}`,
      borderRadius: '10px', overflow: 'hidden',
      opacity: task.completed ? 0.75 : 1,
      transition: 'opacity 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        {/* Checkbox */}
        <button onClick={e => { e.stopPropagation(); onToggle() }} style={{
          width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
          background: task.completed ? '#7aaa7a' : '#fff',
          border: `2px solid ${task.completed ? '#7aaa7a' : '#d4c8b8'}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', color: '#fff',
        }}>{task.completed ? '✓' : ''}</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', color: '#1a1410', textDecoration: task.completed ? 'line-through' : 'none', lineHeight: '1.4' }}>{task.title}</div>
          {task.description && !expanded && <div style={{ fontSize: '12px', color: '#a89080', marginTop: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{task.description}</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {isOverdue && <span style={{ fontSize: '11px', background: '#fef3e8', color: '#c4855a', padding: '2px 7px', borderRadius: '20px' }}>Overdue</span>}
          {task.due_date && !isOverdue && <span style={{ fontSize: '11px', color: '#a89080' }}>{new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
          {task.assigned_to_profile && (
            <div title={task.assigned_to_profile.display_name} style={{ width: '24px', height: '24px', borderRadius: '50%', background: task.assigned_to_profile.avatar_color || '#8c7b6b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff', fontWeight: '500' }}>
              {task.assigned_to_profile.display_name[0].toUpperCase()}
            </div>
          )}
          <span style={{ fontSize: '12px', color: '#c0b0a0' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f0ebe4' }}>
          {task.description && <p style={{ fontSize: '13px', color: '#6b5c4c', lineHeight: '1.6', margin: '12px 0' }}>{task.description}</p>}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#8c7b6b' }}>Assign to:</span>
              <select value={task.assigned_to || ''} onChange={e => onAssign(e.target.value)}
                style={{ padding: '5px 10px', border: '1px solid #e0d8d0', borderRadius: '6px', fontSize: '13px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}>
                <option value="">— unassigned —</option>
                {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profiles?.display_name}</option>)}
              </select>
            </div>
            {myRole === 'admin' && (
              <button onClick={onDelete} style={{ fontSize: '12px', color: '#c0a090', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginLeft: 'auto' }}>Delete task</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Loader() {
  return <div style={{ padding: '80px', textAlign: 'center', color: '#a89080', fontFamily: 'DM Sans, sans-serif' }}>Loading…</div>
}
