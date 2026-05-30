import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getEstate, getItems, getCategories, supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const PALETTE = ['#c4855a','#6b8fa8','#7aaa7a','#b87ab8','#c4b06a','#6ab8b8']

export default function EstatePage({ session, profile, onToast }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [estate, setEstate] = useState(null)
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [myRole, setMyRole] = useState('member')
  const [tab, setTab] = useState('items')
  const [filterCat, setFilterCat] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const scrollPos = useRef(0)

  useEffect(() => {
    const saved = sessionStorage.getItem('estate_scroll_' + id)
    if (saved) setTimeout(() => window.scrollTo(0, parseInt(saved)), 100)
    const onScroll = () => sessionStorage.setItem('estate_scroll_' + id, window.scrollY)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [id])

  const load = async () => {
    const [{ data: est }, { data: its }, { data: cats }, { data: mem }] = await Promise.all([
      getEstate(id),
      getItems(id),
      getCategories(),
      supabase.from('estate_members').select('role').eq('estate_id', id).eq('user_id', session.user.id).single(),
    ])
    setEstate(est)
    setItems(its || [])
    setCategories(cats || [])
    setMyRole(mem?.role || 'member')
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase.channel(`estate-${id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'items', filter:`estate_id=eq.${id}` }, load)
      .on('postgres_changes', { event:'*', schema:'public', table:'interests' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id])

  if (loading) return <div style={{ padding:'80px', textAlign:'center', color:'#a89080', fontFamily:'DM Sans, sans-serif' }}>Laster…</div>
  if (!estate) return <div style={{ padding:'60px', textAlign:'center', color:'#a89080' }}>Estate ikke funnet.</div>

  const myItems = items.filter(i => i.interests?.some(x => x.user_id === session.user.id))
  const otherItems = items.filter(i => !i.interests?.some(x => x.user_id === session.user.id))

  const getFiltered = () => {
    if (filterStatus === 'mine') return items.filter(i => i.interests?.some(x => x.user_id === session.user.id))
    if (filterStatus === 'contested') return items.filter(i => i.interests?.length > 1)
    if (filterStatus === 'wanted') return items.filter(i => i.interests?.length > 0)
    if (filterStatus === 'unwanted') return items.filter(i => i.interests?.length === 0)
    if (filterStatus === 'assigned') return items.filter(i => i.status === 'assigned')
    return items
  }

  const filtered = getFiltered().filter(i => filterCat === 'all' || i.category_id === filterCat)

  const myCount = myItems.length
  const contested = items.filter(i => i.interests?.length > 1).length
  const unwanted = items.filter(i => i.interests?.length === 0).length
  const assigned = items.filter(i => i.status === 'assigned').length

  const handleDelete = async (item, e) => {
    e.stopPropagation()
    const canDelete = myRole === 'admin' || item.added_by === session.user.id
    if (!canDelete) { onToast('Bare admin kan slette andres gjenstander', 'error'); return }
    if (!window.confirm(`Slette "${item.title}"? Kan ikke angres.`)) return
    await supabase.from('items').delete().eq('id', item.id)
    onToast('Gjenstand slettet')
    load()
  }

  const byCat = categories.map(c => ({
    name: `${c.emoji} ${c.label}`,
    count: items.filter(i => i.category_id === c.id).length,
  })).filter(x => x.count > 0).sort((a,b) => b.count - a.count)

  const pieData = [
    { name: 'Tildelt', value: assigned },
    { name: 'Ettertraktet', value: contested },
    { name: 'Ønsket', value: items.filter(i => i.interests?.length === 1).length },
    { name: 'Ingen vil ha', value: unwanted },
  ].filter(d => d.value > 0)

  return (
    <div style={{ maxWidth:'920px', margin:'0 auto', padding:'28px 16px', fontFamily:'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'28px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <button onClick={() => navigate('/')} style={{ background:'none', border:'none', color:'#8c7b6b', cursor:'pointer', fontSize:'13px', padding:'0 0 8px', fontFamily:'DM Sans, sans-serif' }}>← Alle estates</button>
          <h1 style={{ fontFamily:'Playfair Display, serif', fontSize:'26px', fontWeight:'400', color:'#1a1410', marginBottom:'4px' }}>{estate.name}</h1>
          {estate.description && <p style={{ color:'#8c7b6b', fontSize:'14px' }}>{estate.description}</p>}
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {myRole === 'admin' && (
            <button onClick={() => navigate(`/estate/${id}/admin`)} style={{ padding:'9px 16px', background:'none', border:'1px solid #e0d8d0', borderRadius:'8px', cursor:'pointer', color:'#6b5c4c', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>
              ⚙️ Administrer
            </button>
          )}
          <button onClick={() => navigate(`/estate/${id}/add`)} style={{ padding:'9px 20px', background:'#1a1410', color:'#f5f0eb', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>
            + Legg til
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:'10px', marginBottom:'28px' }}>
        {[
          { v:items.length, l:'Gjenstander', emoji:'📦' },
          { v:myCount, l:'Mine interesser', emoji:'❤️', clickStatus:'mine' },
          { v:contested, l:'Ettertraktede', emoji:'🔥', warn:contested>0, clickStatus:'contested' },
          { v:items.filter(i => i.interests?.length > 0).length, l:'Noen vil ha', emoji:'🙋', clickStatus:'wanted' },
          { v:unwanted, l:'Ingen vil ha', emoji:'😔', clickStatus:'unwanted' },
          { v:assigned, l:'Tildelt', emoji:'✅', clickStatus:'assigned' },
        ].map(s => (
          <div key={s.l} onClick={s.clickStatus ? () => setFilterStatus(filterStatus===s.clickStatus?'all':s.clickStatus) : undefined} style={{
            background: filterStatus===s.clickStatus?'#fef3e8':'#fff',
            border:`1px solid ${s.warn&&s.v>0?'#e8c4a0':'#e8e0d6'}`, borderRadius:'10px', padding:'14px',
            cursor: s.clickStatus?'pointer':'default',
          }}>
            <div style={{ fontSize:'18px', marginBottom:'4px' }}>{s.emoji}</div>
            <div style={{ fontSize:'24px', color:s.warn&&s.v>0?'#c4855a':'#1a1410', fontFamily:'Playfair Display, serif' }}>{s.v}</div>
            <div style={{ fontSize:'12px', color:'#a89080', marginTop:'2px' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Modules */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:'10px', marginBottom:'28px' }}>
        {[
          { path:`/estate/${id}/tasks`, emoji:'📋', label:'Oppgaveliste', desc:'Steg-for-steg', color:'#fef3e8', border:'#e8c4a0' },
          { path:`/estate/${id}/documents`, emoji:'🔒', label:'Dokumenthvelv', desc:'Testament, skjøter', color:'#e8f0fe', border:'#b3c6f5' },
          { path:`/estate/${id}/heirs`, emoji:'👨‍👩‍👧', label:'Arvinger', desc:'Fordelingskalkulator', color:'#f0faf0', border:'#b8ddb8' },
          { path:`/estate/${id}/goodwill`, emoji:'⭐', label:'Goodwill', desc:'Oppgaver, rettferdighet', color:'#fef9e8', border:'#e8d8a0' },
        ].map(mod => (
          <button key={mod.path} onClick={() => navigate(mod.path)} style={{
            padding:'16px', background:mod.color, border:`1px solid ${mod.border}`,
            borderRadius:'10px', cursor:'pointer', textAlign:'left', fontFamily:'DM Sans, sans-serif',
          }}>
            <div style={{ fontSize:'24px', marginBottom:'6px' }}>{mod.emoji}</div>
            <div style={{ fontSize:'13px', fontWeight:'500', color:'#1a1410', marginBottom:'2px' }}>{mod.label}</div>
            <div style={{ fontSize:'11px', color:'#8c7b6b' }}>{mod.desc}</div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'4px', borderBottom:'1px solid #e8e0d6', marginBottom:'24px' }}>
        {[['items','Gjenstander'],['analytics','Analyse']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:'10px 18px', border:'none', background:'none', cursor:'pointer',
            fontSize:'14px', fontFamily:'DM Sans, sans-serif',
            color:tab===t?'#1a1410':'#8c7b6b',
            borderBottom:tab===t?'2px solid #1a1410':'2px solid transparent', marginBottom:'-1px',
          }}>{l}</button>
        ))}
      </div>

      {tab === 'analytics' ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
          <div style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'12px', padding:'24px' }}>
            <h3 style={{ fontFamily:'Playfair Display, serif', fontSize:'16px', fontWeight:'400', color:'#1a1410', marginBottom:'20px' }}>Gjenstander per kategori</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byCat} margin={{ bottom:40, left:-20 }}>
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'#8c7b6b' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize:10, fill:'#8c7b6b' }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#c4855a" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'12px', padding:'24px' }}>
            <h3 style={{ fontFamily:'Playfair Display, serif', fontSize:'16px', fontWeight:'400', color:'#1a1410', marginBottom:'20px' }}>Status</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((_,i) => <Cell key={i} fill={PALETTE[i%PALETTE.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              style={{ flex:1, minWidth:'140px', padding:'9px 12px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'14px', background:'#fff', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif' }}>
              <option value="all">Alle kategorier</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ flex:1, minWidth:'140px', padding:'9px 12px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'14px', background:'#fff', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif' }}>
              <option value="all">Alle gjenstander</option>
              <option value="mine">Mine interesser</option>
              <option value="contested">Ettertraktede</option>
              <option value="wanted">Noen vil ha</option>
              <option value="unwanted">Ingen vil ha</option>
              <option value="assigned">Tildelt</option>
            </select>
          </div>

          {/* My interests first */}
          {filterStatus === 'all' && myItems.length > 0 && (
            <div style={{ marginBottom:'24px' }}>
              <div style={{ fontSize:'13px', color:'#c4855a', fontWeight:'500', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                ❤️ Mine interesser ({myItems.length})
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'12px', marginBottom:'20px' }}>
                {myItems.filter(i => filterCat === 'all' || i.category_id === filterCat).map(item => (
                  <ItemCard key={item.id} item={item} userId={session.user.id} myRole={myRole}
                    onClick={() => navigate(`/estate/${id}/item/${item.id}`)}
                    onDelete={e => handleDelete(item, e)} />
                ))}
              </div>
              {otherItems.filter(i => filterCat === 'all' || i.category_id === filterCat).length > 0 && (
                <div style={{ fontSize:'13px', color:'#8c7b6b', fontWeight:'500', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                  📦 Andre gjenstander
                </div>
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'80px 20px', color:'#a89080' }}>
              <div style={{ fontSize:'48px', marginBottom:'16px' }}>📦</div>
              <p style={{ marginBottom:'20px' }}>Ingen gjenstander ennå.</p>
              <button onClick={() => navigate(`/estate/${id}/add`)} style={{ padding:'11px 24px', background:'#1a1410', color:'#f5f0eb', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>
                Legg til første gjenstand
              </button>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'12px' }}>
              {(filterStatus === 'all' ? otherItems : filtered).filter(i => filterCat === 'all' || i.category_id === filterCat).map(item => (
                <ItemCard key={item.id} item={item} userId={session.user.id} myRole={myRole}
                  onClick={() => navigate(`/estate/${id}/item/${item.id}`)}
                  onDelete={e => handleDelete(item, e)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ItemCard({ item, userId, onClick, onDelete, myRole }) {
  const cat = item.categories || { emoji:'📦', label:'Annet' }
  const myInterest = item.interests?.some(x => x.user_id === userId)
  const count = item.interests?.length || 0
  const isAssigned = item.status === 'assigned'
  const canDelete = myRole === 'admin' || item.added_by === userId

  return (
    <div onClick={onClick} style={{
      background:'#fff', borderRadius:'10px', overflow:'hidden', cursor:'pointer',
      border: isAssigned ? '1.5px solid #7aaa7a' : myInterest ? '2px solid #1a1410' : '1px solid #e8e0d6',
      transition:'transform 0.15s, box-shadow 0.15s', position:'relative',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,0.09)' }}
    onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}>

      {/* Delete button - red, visible for own items and admin */}
      {canDelete && (
        <button onClick={onDelete} style={{
          position:'absolute', top:'6px', left:'6px', zIndex:10,
          background:'#c0392b', color:'#fff', border:'none',
          borderRadius:'6px', padding:'3px 8px', cursor:'pointer',
          fontSize:'11px', fontFamily:'DM Sans, sans-serif',
        }}>🗑 Slett</button>
      )}

      <div style={{ height:'130px', background:'#f0ebe4', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative' }}>
        {item.image_url
          ? <img src={item.image_url} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
          : <span style={{ fontSize:'44px' }}>{cat.emoji}</span>}
        {count > 1 && !isAssigned && <span style={{ position:'absolute', top:'6px', right:'6px', background:'#c4855a', color:'#fff', fontSize:'10px', padding:'2px 6px', borderRadius:'20px' }}>🔥 {count}</span>}
        {isAssigned && <span style={{ position:'absolute', top:'6px', right:'6px', background:'#7aaa7a', color:'#fff', fontSize:'10px', padding:'2px 6px', borderRadius:'20px' }}>✅</span>}
      </div>

      <div style={{ padding:'12px' }}>
        <div style={{ fontSize:'14px', color:'#1a1410', marginBottom:'4px', lineHeight:'1.3' }}>{item.title}</div>
        {item.estimated_value && <div style={{ fontSize:'11px', color:'#8c7b6b', marginBottom:'6px' }}>{item.estimated_value}</div>}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', gap:'2px' }}>
            {(item.interests||[]).slice(0,4).map(x => (
              <div key={x.id} title={x.profiles?.display_name} style={{
                width:'20px', height:'20px', borderRadius:'50%',
                background:x.profiles?.avatar_color||'#ccc',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'9px', color:'#fff', fontWeight:'600',
              }}>{(x.profiles?.display_name||'?')[0].toUpperCase()}</div>
            ))}
            {count === 0 && <span style={{ fontSize:'11px', color:'#c0b0a0', fontStyle:'italic' }}>Ingen ennå</span>}
          </div>
          {myInterest && <span style={{ fontSize:'10px', color:'#1a1410', background:'#f0ebe4', padding:'2px 6px', borderRadius:'20px' }}>❤️ Meg</span>}
        </div>
      </div>
    </div>
  )
}
