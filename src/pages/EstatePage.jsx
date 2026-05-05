import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getEstate, getItems, getCategories, supabase } from '../lib/supabase'
import { usePlan } from '../hooks/usePlan'
import { t } from '../lib/lang'
import { Avatar, Badge } from '../components/UI'
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
  const { plan, limit } = usePlan()

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
      .on('postgres_changes', { event:'*', schema:'public', table:'comments' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id])

  if (loading) return <Loader />
  if (!estate) return <div style={{ padding:'60px', textAlign:'center', color:'#a89080' }}>Estate not found.</div>

  const filtered = items.filter(i => {
    if (filterCat !== 'all' && i.category_id !== filterCat) return false
    if (filterStatus === 'mine' && !i.interests?.some(x => x.user_id === session.user.id)) return false
    if (filterStatus === 'contested' && i.interests?.length <= 1) return false
    if (filterStatus === 'unwanted' && i.interests?.length > 0) return false
    if (filterStatus === 'assigned' && i.status !== 'assigned') return false
    return true
  })

  const myCount = items.filter(i => i.interests?.some(x => x.user_id === session.user.id)).length
  const contested = items.filter(i => i.interests?.length > 1).length
  const unwanted = items.filter(i => i.interests?.length === 0).length
  const assigned = items.filter(i => i.status === 'assigned').length

  const byCat = categories.map(c => ({
    name: `${c.emoji} ${c.label}`,
    count: items.filter(i => i.category_id === c.id).length,
  })).filter(x => x.count > 0).sort((a,b) => b.count - a.count)

  const pieData = [
    { name: t('assigned'), value: assigned },
    { name: t('contested'), value: contested },
    { name: 'Wanted', value: items.filter(i => i.interests?.length === 1).length },
    { name: t('unwanted'), value: unwanted },
  ].filter(d => d.value > 0)

  const canAddItems = items.length < limit('items')

  return (
    <div style={{ maxWidth:'920px', margin:'0 auto', padding:'28px 16px', fontFamily:'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'28px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <button onClick={()=>navigate('/')} style={{ background:'none', border:'none', color:'#8c7b6b', cursor:'pointer', fontSize:'13px', padding:'0 0 8px', fontFamily:'DM Sans, sans-serif' }}>← All estates</button>
          <h1 style={{ fontFamily:'Playfair Display, serif', fontSize:'26px', fontWeight:'400', color:'#1a1410', marginBottom:'4px' }}>{estate.name}</h1>
          {estate.description && <p style={{ color:'#8c7b6b', fontSize:'14px' }}>{estate.description}</p>}
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {myRole === 'admin' && (
            <button onClick={()=>navigate(`/estate/${id}/admin`)} style={{ padding:'9px 16px', background:'none', border:'1px solid #e0d8d0', borderRadius:'8px', cursor:'pointer', color:'#6b5c4c', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>
              ⚙️ Manage
            </button>
          )}
          <button onClick={()=>{
            if (!canAddItems) { onToast(`Free plan limited to ${limit('items')} items — upgrade to add more`, 'error'); return }
            navigate(`/estate/${id}/add`)
          }} style={{ padding:'9px 20px', background:'#1a1410', color:'#f5f0eb', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>
            + Add item
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:'10px', marginBottom:'28px' }}>
        {[
          { v:items.length, l:t('totalItems'), emoji:'📦' },
          { v:myCount, l:t('myInterests'), emoji:'❤️' },
          { v:contested, l:t('contested'), emoji:'🔥', warn:contested>0, clickStatus:'contested' },
          { v:unwanted, l:t('unwanted'), emoji:'😔', clickStatus:'unwanted' },
          { v:assigned, l:t('assigned'), emoji:'✅', clickStatus:'assigned' },
        ].map(s => (
          <div key={s.l} onClick={s.clickStatus ? ()=>setFilterStatus(filterStatus===s.clickStatus?'all':s.clickStatus) : undefined} style={{
            background: filterStatus===s.clickStatus?'#fef3e8':'#fff',
            border:`1px solid ${s.warn&&s.v>0?'#e8c4a0':'#e8e0d6'}`, borderRadius:'10px', padding:'14px 14px',
            cursor: s.clickStatus?'pointer':'default',
          }}>
            <div style={{ fontSize:'18px', marginBottom:'4px' }}>{s.emoji}</div>
            <div style={{ fontSize:'24px', color: s.warn&&s.v>0?'#c4855a':'#1a1410', fontFamily:'Playfair Display, serif' }}>{s.v}</div>
            <div style={{ fontSize:'12px', color:'#a89080', marginTop:'2px' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Module navigation */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))", gap:"10px", marginBottom:"28px" }}>
        {[
          { path:`/estate/${id}/tasks`, emoji:"📋", label:"Task checklist", desc:"Step-by-step guide", color:"#fef3e8", border:"#e8c4a0" },
          { path:`/estate/${id}/documents`, emoji:"🔒", label:"Document vault", desc:"Wills, deeds, IDs", color:"#e8f0fe", border:"#b3c6f5" },
          { path:`/estate/${id}/heirs`, emoji:"👨‍👩‍👧", label:"Heirs & distribution", desc:"Fair split calculator", color:"#f0faf0", border:"#b8ddb8" },
          { path:`/estate/${id}/goodwill`, emoji:"⭐", label:"Goodwill & work", desc:"Tasks, fairness, karma", color:"#fef9e8", border:"#e8d8a0" },
        ].map(mod => (
          <button key={mod.path} onClick={()=>navigate(mod.path)} style={{ padding:"16px", background:mod.color, border:`1px solid ${mod.border}`, borderRadius:"10px", cursor:"pointer", textAlign:"left", fontFamily:"DM Sans, sans-serif" }}>
            <div style={{ fontSize:"24px", marginBottom:"6px" }}>{mod.emoji}</div>
            <div style={{ fontSize:"13px", fontWeight:"500", color:"#1a1410", marginBottom:"2px" }}>{mod.label}</div>
            <div style={{ fontSize:"11px", color:"#8c7b6b" }}>{mod.desc}</div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'4px', borderBottom:'1px solid #e8e0d6', marginBottom:'24px' }}>
        {[['items',t('items')],['analytics',t('analytics')]].map(([t,l]) => (
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'10px 18px', border:'none', background:'none', cursor:'pointer',
            fontSize:'14px', fontFamily:'DM Sans, sans-serif',
            color: tab===t?'#1a1410':'#8c7b6b',
            borderBottom: tab===t?'2px solid #1a1410':'2px solid transparent',
            marginBottom:'-1px',
          }}>{l}</button>
        ))}
      </div>

      {tab === 'analytics' ? (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
          <div style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'12px', padding:'24px' }}>
            <h3 style={{ fontFamily:'Playfair Display, serif', fontSize:'16px', fontWeight:'400', color:'#1a1410', marginBottom:'20px' }}>Items by category</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byCat} margin={{ bottom:40, left:-20 }}>
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'#8c7b6b' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize:10, fill:'#8c7b6b' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontFamily:'DM Sans', fontSize:12, borderRadius:8 }} />
                <Bar dataKey="count" fill="#c4855a" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'12px', padding:'24px' }}>
            <h3 style={{ fontFamily:'Playfair Display, serif', fontSize:'16px', fontWeight:'400', color:'#1a1410', marginBottom:'20px' }}>Status breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((_,i) => <Cell key={i} fill={PALETTE[i%PALETTE.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontFamily:'DM Sans', fontSize:12, borderRadius:8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {contested > 0 && (
            <div style={{ gridColumn:'1/-1', background:'#fff', border:'1px solid #e8e0d6', borderRadius:'12px', padding:'24px' }}>
              <h3 style={{ fontFamily:'Playfair Display, serif', fontSize:'16px', fontWeight:'400', color:'#1a1410', marginBottom:'16px' }}>🔥 Most contested items</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {items.filter(i=>i.interests?.length>1).sort((a,b)=>b.interests.length-a.interests.length).slice(0,5).map(item=>(
                  <div key={item.id} onClick={()=>navigate(`/estate/${id}/item/${item.id}`)} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', background:'#fef3e8', border:'1px solid #e8c4a0', borderRadius:'8px', cursor:'pointer' }}>
                    <span style={{ fontSize:'20px' }}>{item.categories?.emoji||'📦'}</span>
                    <span style={{ flex:1, fontSize:'14px', color:'#1a1410' }}>{item.title}</span>
                    <div style={{ display:'flex', gap:'3px' }}>
                      {item.interests.map(x=><Avatar key={x.id} name={x.profiles?.display_name||'?'} size={22} color={x.profiles?.avatar_color} />)}
                    </div>
                    <span style={{ fontSize:'12px', color:'#c4855a', fontWeight:'500' }}>{item.interests.length} want this</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
            <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
              style={{ flex:1, minWidth:'140px', padding:'9px 12px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'14px', background:'#fff', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif' }}>
              <option value="all">All categories</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
              style={{ flex:1, minWidth:'140px', padding:'9px 12px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'14px', background:'#fff', color:'#1a1410', outline:'none', fontFamily:'DM Sans, sans-serif' }}>
              <option value="all">All items</option>
              <option value="mine">My interests</option>
              <option value="contested">Contested</option>
              <option value="unwanted">Unwanted</option>
              <option value="assigned">Assigned</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'80px 20px', color:'#a89080' }}>
              <div style={{ fontSize:'48px', marginBottom:'16px' }}>📦</div>
              <p style={{ marginBottom:'20px' }}>No items here yet.</p>
              <button onClick={()=>navigate(`/estate/${id}/add`)} style={{ padding:'11px 24px', background:'#1a1410', color:'#f5f0eb', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>Add first item</button>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:'14px' }}>
              {filtered.map(item => <ItemCard key={item.id} item={item} userId={session.user.id} onClick={()=>navigate(`/estate/${id}/item/${item.id}`)} />)}
            </div>
          )}
        </>
      )}

      {!canAddItems && (
        <div style={{ marginTop:'24px', padding:'16px 20px', background:'#fef3e8', border:'1px solid #e8c4a0', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
          <div>
            <div style={{ fontSize:'14px', color:'#1a1410', fontWeight:'500' }}>🔒 Free plan limit reached ({limit('items')} items)</div>
            <div style={{ fontSize:'13px', color:'#8c7b6b', marginTop:'2px' }}>Upgrade to add unlimited items</div>
          </div>
          <button onClick={()=>navigate('/pricing')} style={{ padding:'9px 18px', background:'#c4855a', color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontFamily:'DM Sans, sans-serif' }}>Upgrade →</button>
        </div>
      )}
    </div>
  )
}

function ItemCard({ item, userId, onClick }) {
  const myInterest = item.interests?.some(x => x.user_id === userId)
  const count = item.interests?.length || 0
  const hot = count > 1
  const isAssigned = item.status === 'assigned'
  const cat = item.categories || { emoji:'📦', label:'Other' }

  return (
    <div onClick={onClick} style={{
      background:'#fff', borderRadius:'10px', overflow:'hidden', cursor:'pointer',
      border: isAssigned ? '1.5px solid #7aaa7a' : myInterest ? '2px solid #1a1410' : '1px solid #e8e0d6',
      transition:'transform 0.15s, box-shadow 0.15s',
    }}
    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,0.09)'}}
    onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none'}}>
      <div style={{ height:'140px', background:'#f0ebe4', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative' }}>
        {item.image_url ? <img src={item.image_url} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'contain', background:'#f0ebe4' }} /> : <span style={{ fontSize:'48px' }}>{cat.emoji}</span>}
        {hot && !isAssigned && <span style={{ position:'absolute', top:'8px', right:'8px', background:'#c4855a', color:'#fff', fontSize:'10px', padding:'2px 7px', borderRadius:'20px' }}>🔥 Contested</span>}
        {isAssigned && <span style={{ position:'absolute', top:'8px', right:'8px', background:'#7aaa7a', color:'#fff', fontSize:'10px', padding:'2px 7px', borderRadius:'20px' }}>✅ Assigned</span>}
      </div>
      <div style={{ padding:'14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
          <div style={{ fontSize:'15px', color:'#1a1410', flex:1, paddingRight:'8px', lineHeight:'1.3' }}>{item.title}</div>
          <span style={{ fontSize:'11px', color:'#a89080', background:'#f5f0eb', padding:'2px 7px', borderRadius:'20px', whiteSpace:'nowrap' }}>{cat.emoji}</span>
        </div>
        {item.description && (
          <div style={{ fontSize:'13px', color:'#6b5c4c', lineHeight:1.5, marginBottom:'10px', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
            {item.description}
          </div>
        )}
        {item.estimated_value && (
          <div style={{ fontSize:'12px', color:'#8c7b6b', marginBottom:'8px' }}>Est. value: {item.estimated_value}</div>
        )}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', gap:'3px' }}>
            {(item.interests||[]).slice(0,5).map(x=><Avatar key={x.id} name={x.profiles?.display_name||'?'} size={22} color={x.profiles?.avatar_color} />)}
            {count===0 && <span style={{ fontSize:'12px', color:'#c0b0a0', fontStyle:'italic' }}>No interest yet</span>}
          </div>
          {myInterest && !isAssigned && <span style={{ fontSize:'11px', color:'#1a1410', background:'#f0ebe4', padding:'3px 8px', borderRadius:'20px' }}>✓ Interested</span>}
          {isAssigned && item.assigned_to_profile && (
            <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <Avatar name={item.assigned_to_profile.display_name} size={18} color={item.assigned_to_profile.avatar_color} />
              <span style={{ fontSize:'11px', color:'#7aaa7a' }}>{item.assigned_to_profile.display_name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Loader() {
  return <div style={{ padding:'80px', textAlign:'center', color:'#a89080', fontFamily:'DM Sans, sans-serif' }}>Loading…</div>
}
