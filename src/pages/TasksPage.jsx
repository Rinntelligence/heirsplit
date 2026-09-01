import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DEFAULT_TASKS = [
  { category: 'Umiddelbart', title: 'Registrer dødsfallet', description: 'Innhent dødsattest fra sykehus eller lege', priority: 1 },
  { category: 'Umiddelbart', title: 'Varsle nærmeste familie', description: 'Informer nærmeste familiemedlemmer og nære venner', priority: 2 },
  { category: 'Umiddelbart', title: 'Kontakt begravelsesbyrå', description: 'Planlegg begravelse og gravferd eller kremasjon', priority: 3 },
  { category: 'Uke 1', title: 'Varsle banken', description: 'Informer alle banker og fryse eller overføre kontoer', priority: 4 },
  { category: 'Uke 1', title: 'Finn testamentet', description: 'Finn original signert testament og relaterte dokumenter', priority: 5 },
  { category: 'Uke 1', title: 'Kontakt livsforsikring', description: 'Meld krav til alle livsforsikringsleverandører', priority: 6 },
  { category: 'Uke 1', title: 'Sikre eiendommen', description: 'Sørg for at bolig og verdisaker er låst og sikret', priority: 7 },
  { category: 'Måned 1', title: 'Start skiftebehandling', description: 'Start den juridiske prosessen for å fordele boet', priority: 8 },
  { category: 'Måned 1', title: 'Kanseller abonnementer', description: 'Avslutt strømmetjenester, telefon, treningssenter og andre løpende tjenester', priority: 9 },
  { category: 'Måned 1', title: 'Videresend post', description: 'Sett opp postvideresending til bobestyrer', priority: 10 },
  { category: 'Måned 1', title: 'Varsle NAV og pensjon', description: 'Informer relevante statlige og pensjonsinstanser', priority: 11 },
  { category: 'Måned 1', title: 'Lever siste selvangivelse', description: 'Forbered og lever siste personlige selvangivelse', priority: 12 },
  { category: 'Fordeling', title: 'Inventariser alle eiendeler', description: 'Lag fullstendig liste over eiendom, kontoer, kjøretøy og verdisaker', priority: 13 },
  { category: 'Fordeling', title: 'Betal utestående gjeld', description: 'Gjør opp eventuelle lån, kredittkort eller regninger', priority: 14 },
  { category: 'Fordeling', title: 'Fordel boet til arvingene', description: 'Overfør eiendeler og gjenstander i henhold til testamentet', priority: 15 },
  { category: 'Fordeling', title: 'Lukk bokontoer', description: 'Avslutt eventuelle bokontoer og fullfør det siste papirarbeidet', priority: 16 },
]

const CATEGORY_ORDER = ['Umiddelbart', 'Uke 1', 'Måned 1', 'Fordeling']
const CATEGORY_COLORS = {
  'Umiddelbart': { bg: '#fef3e8', border: '#e8c4a0', text: '#854F0B', dot: '#c4855a' },
  'Uke 1':       { bg: '#e8f0fe', border: '#b3c6f5', text: '#1a56db', dot: '#6b8fa8' },
  'Måned 1':     { bg: '#f0faf0', border: '#b8ddb8', text: '#3a7a3a', dot: '#7aaa7a' },
  'Fordeling':   { bg: '#f5f0fb', border: '#d4b8f0', text: '#5a3a8a', dot: '#b87ab8' },
}

export default function TasksPage({ session, profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', category: 'Uke 1', due_date: '' })
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
    setNewTask({ title: '', description: '', category: 'Uke 1', due_date: '' })
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
      <button onClick={() => navigate(`/estate/${id}`)} style={{ background: 'none', border: 'none', color: '#8c7b6b', cursor: 'pointer', fontSize: '13px', padding: '0 0 20px', fontFamily: 'DM Sans, sans-serif' }}>← Tilbake til boet</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '26px', fontWeight: '400', color: '#1a1410', marginBottom: '4px' }}>📋 Oppgaveliste</h1>
          <p style={{ color: '#8c7b6b', fontSize: '14px' }}>Steg-for-steg-veiledning gjennom arveprosessen</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {tasks.length === 0 && (
            <button onClick={seedTasks} style={{ padding: '9px 18px', background: '#c4855a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
              Last standard sjekkliste
            </button>
          )}
          <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '9px 18px', background: '#1a1410', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
            + Legg til oppgave
          </button>
        </div>
      </div>

      {/* Fremdriftslinje */}
      {total > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px', color: '#1a1410', fontWeight: '500' }}>Samlet fremdrift</span>
            <span style={{ fontSize: '22px', fontFamily: 'Playfair Display, serif', color: progress === 100 ? '#7aaa7a' : '#1a1410' }}>{progress}%</span>
          </div>
          <div style={{ height: '8px', background: '#f0ebe4', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#7aaa7a' : '#c4855a', borderRadius: '4px', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ fontSize: '13px', color: '#a89080', marginTop: '8px' }}>{completed} av {total} oppgaver fullført</div>
        </div>
      )}

      {/* Legg til oppgave */}
      {showAdd && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', color: '#1a1410', marginBottom: '16px', fontFamily: 'Playfair Display, serif', fontWeight: '400' }}>Legg til egendefinert oppgave</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Oppgavetittel *"
              style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
            <input value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} placeholder="Beskrivelse (valgfri)"
              style={{ width: '100%', padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select value={newTask.category} onChange={e => setNewTask(p => ({ ...p, category: e.target.value }))}
                style={{ flex: 1, padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}>
                {[...CATEGORY_ORDER, 'Annet'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="date" value={newTask.due_date} onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))}
                style={{ flex: 1, padding: '11px 14px', border: '1px solid #e0d8d0', borderRadius: '8px', fontSize: '14px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '10px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>Avbryt</button>
              <button onClick={addTask} disabled={!newTask.title.trim()} style={{ flex: 2, padding: '10px', background: newTask.title.trim() ? '#1a1410' : '#c0b8b0', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: newTask.title.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>Legg til oppgave</button>
            </div>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#a89080' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <p style={{ marginBottom: '20px', fontSize: '15px' }}>Ingen oppgaver ennå. Last standard sjekkliste for å komme i gang.</p>
          <button onClick={seedTasks} style={{ padding: '12px 28px', background: '#c4855a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontFamily: 'DM Sans, sans-serif' }}>Last standard sjekkliste</button>
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
          {isOverdue && <span style={{ fontSize: '11px', background: '#fef3e8', color: '#c4855a', padding: '2px 7px', borderRadius: '20px' }}>Forfalt</span>}
          {task.due_date && !isOverdue && <span style={{ fontSize: '11px', color: '#a89080' }}>{new Date(task.due_date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}</span>}
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
              <span style={{ fontSize: '12px', color: '#8c7b6b' }}>Tildel til:</span>
              <select value={task.assigned_to || ''} onChange={e => onAssign(e.target.value)}
                style={{ padding: '5px 10px', border: '1px solid #e0d8d0', borderRadius: '6px', fontSize: '13px', background: '#faf7f3', color: '#1a1410', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}>
                <option value="">— ikke tildelt —</option>
                {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profiles?.display_name}</option>)}
              </select>
            </div>
            {myRole === 'admin' && (
              <button onClick={onDelete} style={{ fontSize: '12px', color: '#c0a090', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginLeft: 'auto' }}>Slett oppgave</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Loader() {
  return <div style={{ padding: '80px', textAlign: 'center', color: '#a89080', fontFamily: 'DM Sans, sans-serif' }}>Laster…</div>
}
