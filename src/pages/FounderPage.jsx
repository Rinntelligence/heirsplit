import { useEffect, useState } from 'react'
import { getAllEstates, getAllProfiles, getAllFeedback, supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'

export default function FounderPage({ session }) {
  const [estates, setEstates] = useState([])
  const [profiles, setProfiles] = useState([])
  const [feedback, setFeedback] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    const load = async () => {
      const [{ data: es }, { data: ps }, { data: fb }, { data: its }] = await Promise.all([
        getAllEstates(),
        getAllProfiles(),
        getAllFeedback(),
        supabase.from('items').select('id, created_at, estate_id'),
      ])
      setEstates(es || [])
      setProfiles(ps || [])
      setFeedback(fb || [])
      setItems(its || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ padding:'80px', textAlign:'center', color:'#a89080', fontFamily:'DM Sans, sans-serif' }}>Loading founder dashboard…</div>

  const planCounts = profiles.reduce((acc, p) => { acc[p.plan||'free']=(acc[p.plan||'free']||0)+1; return acc }, {})
  const mrr = (planCounts.family||0)*9 + (planCounts.business||0)*99 + (planCounts.enterprise||0)*299
  const avgNps = feedback.filter(f=>f.nps_score).length ? (feedback.filter(f=>f.nps_score).reduce((a,f)=>a+f.nps_score,0)/feedback.filter(f=>f.nps_score).length).toFixed(1) : 'N/A'

  // Growth by month
  const byMonth = {}
  profiles.forEach(p => {
    const m = new Date(p.created_at).toLocaleDateString('en-GB', { month:'short', year:'2-digit' })
    byMonth[m] = (byMonth[m]||0)+1
  })
  const growthData = Object.entries(byMonth).slice(-6).map(([m,v])=>({ month:m, users:v }))

  // Plan distribution
  const planData = Object.entries(planCounts).map(([plan,count])=>({ plan, count }))

  // Activity: estates with most items
  const estateActivity = estates.map(e => ({
    name: e.name,
    items: items.filter(i=>i.estate_id===e.id).length,
    owner: e.profiles?.display_name || e.profiles?.email || 'Unknown',
  })).sort((a,b)=>b.items-a.items).slice(0,8)

  return (
    <div style={{ maxWidth:'960px', margin:'0 auto', padding:'28px 16px', fontFamily:'DM Sans, sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'32px' }}>
        <div>
          <h1 style={{ fontFamily:'Playfair Display, serif', fontSize:'28px', fontWeight:'400', color:'#1a1410', marginBottom:'4px' }}>🔭 Founder Dashboard</h1>
          <p style={{ color:'#8c7b6b', fontSize:'14px' }}>Private — only visible to you</p>
        </div>
        <div style={{ background:'#f0faf0', border:'1px solid #b8ddb8', borderRadius:'10px', padding:'12px 20px', textAlign:'center' }}>
          <div style={{ fontSize:'24px', color:'#1a1410', fontFamily:'Playfair Display, serif' }}>${mrr.toLocaleString()}</div>
          <div style={{ fontSize:'12px', color:'#7aaa7a' }}>Est. MRR</div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:'10px', marginBottom:'32px' }}>
        {[
          { v:profiles.length, l:'Total users', emoji:'👤' },
          { v:estates.length, l:'Estates created', emoji:'🏠' },
          { v:items.length, l:'Items listed', emoji:'📦' },
          { v:planCounts.family||0, l:'Family plan', emoji:'👨‍👩‍👧' },
          { v:planCounts.business||0, l:'Business plan', emoji:'💼' },
          { v:planCounts.enterprise||0, l:'Enterprise', emoji:'🏢' },
          { v:feedback.length, l:'Feedback recv.', emoji:'💬' },
          { v:avgNps, l:'Avg NPS score', emoji:'⭐' },
        ].map(s=>(
          <div key={s.l} style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'10px', padding:'14px' }}>
            <div style={{ fontSize:'18px', marginBottom:'4px' }}>{s.emoji}</div>
            <div style={{ fontSize:'22px', color:'#1a1410', fontFamily:'Playfair Display, serif' }}>{s.v}</div>
            <div style={{ fontSize:'11px', color:'#a89080', marginTop:'2px' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'4px', borderBottom:'1px solid #e8e0d6', marginBottom:'24px' }}>
        {[['overview','Overview'],['users','Users'],['feedback','Feedback'],['estates','Estates']].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'10px 18px', border:'none', background:'none', cursor:'pointer',
            fontSize:'14px', fontFamily:'DM Sans, sans-serif',
            color:tab===t?'#1a1410':'#8c7b6b',
            borderBottom:tab===t?'2px solid #1a1410':'2px solid transparent', marginBottom:'-1px',
          }}>{l}</button>
        ))}
      </div>

      {tab==='overview' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
          <div style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'12px', padding:'24px' }}>
            <h3 style={{ fontFamily:'Playfair Display, serif', fontSize:'16px', fontWeight:'400', color:'#1a1410', marginBottom:'20px' }}>User growth (last 6 months)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe4" />
                <XAxis dataKey="month" tick={{ fontSize:11, fill:'#8c7b6b' }} />
                <YAxis tick={{ fontSize:11, fill:'#8c7b6b' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontFamily:'DM Sans', fontSize:12, borderRadius:8 }} />
                <Line type="monotone" dataKey="users" stroke="#c4855a" strokeWidth={2} dot={{ fill:'#c4855a' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'12px', padding:'24px' }}>
            <h3 style={{ fontFamily:'Playfair Display, serif', fontSize:'16px', fontWeight:'400', color:'#1a1410', marginBottom:'20px' }}>Plan distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={planData}>
                <XAxis dataKey="plan" tick={{ fontSize:11, fill:'#8c7b6b' }} />
                <YAxis tick={{ fontSize:11, fill:'#8c7b6b' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontFamily:'DM Sans', fontSize:12, borderRadius:8 }} />
                <Bar dataKey="count" fill="#6b8fa8" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ gridColumn:'1/-1', background:'#fff', border:'1px solid #e8e0d6', borderRadius:'12px', padding:'24px' }}>
            <h3 style={{ fontFamily:'Playfair Display, serif', fontSize:'16px', fontWeight:'400', color:'#1a1410', marginBottom:'16px' }}>Most active estates</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {estateActivity.map((e,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', background:'#faf7f3', border:'1px solid #e8e0d6', borderRadius:'8px' }}>
                  <span style={{ fontSize:'13px', color:'#a89080', minWidth:'20px' }}>#{i+1}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'14px', color:'#1a1410' }}>{e.name}</div>
                    <div style={{ fontSize:'12px', color:'#a89080' }}>by {e.owner}</div>
                  </div>
                  <span style={{ fontSize:'13px', color:'#c4855a', fontWeight:'500' }}>{e.items} items</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab==='users' && (
        <div style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'12px', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#faf7f3', borderBottom:'1px solid #e8e0d6' }}>
                {['Name','Email','Plan','Joined','Estates'].map(h=>(
                  <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:'12px', color:'#8c7b6b', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p,i)=>(
                <tr key={p.id} style={{ borderBottom: i<profiles.length-1?'1px solid #f0ebe4':'none' }}>
                  <td style={{ padding:'12px 16px', fontSize:'14px', color:'#1a1410' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:p.avatar_color||'#8c7b6b', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'#fff', fontWeight:'500' }}>{(p.display_name||'?')[0].toUpperCase()}</div>
                      {p.display_name||'—'}
                    </div>
                  </td>
                  <td style={{ padding:'12px 16px', fontSize:'13px', color:'#6b5c4c' }}>{p.email}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <select
                      value={p.plan || 'free'}
                      onChange={async (e) => {
                        await supabase.from('profiles').update({ plan: e.target.value }).eq('user_id', p.user_id)
                        setProfiles(prev => prev.map(x => x.user_id === p.user_id ? {...x, plan: e.target.value} : x))
                      }}
                      style={{ fontSize:'12px', border:'1px solid #e0d8d0', borderRadius:'6px', padding:'3px 8px', background:'#fff', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}
                    >
                      <option value="free">free</option>
                      <option value="family">family</option>
                      <option value="business">business</option>
                      <option value="enterprise">enterprise</option>
                    </select>
                  </td>
                  <td style={{ padding:'12px 16px', fontSize:'13px', color:'#a89080' }}>{new Date(p.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</td>
                  <td style={{ padding:'12px 16px', fontSize:'13px', color:'#a89080' }}>{estates.filter(e=>e.owner_id===p.user_id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==='feedback' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {feedback.length===0 ? (
            <div style={{ padding:'60px', textAlign:'center', color:'#a89080' }}>No feedback yet — feedback widget will appear inside the app for users.</div>
          ) : feedback.map(f=>(
            <div key={f.id} style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'12px', padding:'20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                  <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#c4855a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', color:'#fff', fontWeight:'500' }}>{(f.profiles?.display_name||'?')[0].toUpperCase()}</div>
                  <div>
                    <div style={{ fontSize:'14px', color:'#1a1410', fontWeight:'500' }}>{f.profiles?.display_name||'Unknown'}</div>
                    <div style={{ fontSize:'12px', color:'#a89080' }}>{f.profiles?.email} · {new Date(f.created_at).toLocaleDateString('en-GB')}</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  {f.nps_score && <span style={{ fontSize:'13px', color:f.nps_score>=8?'#7aaa7a':f.nps_score>=6?'#c4b06a':'#c46a6a', fontWeight:'500' }}>NPS: {f.nps_score}/10</span>}
                  <span style={{ fontSize:'11px', background:'#f5f0eb', color:'#6b5c4c', padding:'3px 8px', borderRadius:'20px' }}>{f.type}</span>
                </div>
              </div>
              {f.content && <p style={{ fontSize:'14px', color:'#4a3c30', lineHeight:'1.7', fontStyle:'italic' }}>"{f.content}"</p>}
            </div>
          ))}
        </div>
      )}

      {tab==='estates' && (
        <div style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'12px', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#faf7f3', borderBottom:'1px solid #e8e0d6' }}>
                {['Estate name','Owner','Status','Created','Items'].map(h=>(
                  <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:'12px', color:'#8c7b6b', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estates.map((e,i)=>(
                <tr key={e.id} style={{ borderBottom:i<estates.length-1?'1px solid #f0ebe4':'none' }}>
                  <td style={{ padding:'12px 16px', fontSize:'14px', color:'#1a1410' }}>{e.name}</td>
                  <td style={{ padding:'12px 16px', fontSize:'13px', color:'#6b5c4c' }}>{e.profiles?.display_name||e.profiles?.email||'—'}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:'11px', background:e.status==='active'?'#f0faf0':'#fef3e8', color:e.status==='active'?'#3a7a3a':'#c4855a', padding:'3px 8px', borderRadius:'20px' }}>{e.status||'active'}</span>
                  </td>
                  <td style={{ padding:'12px 16px', fontSize:'13px', color:'#a89080' }}>{new Date(e.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}</td>
                  <td style={{ padding:'12px 16px', fontSize:'13px', color:'#c4855a', fontWeight:'500' }}>{items.filter(it=>it.estate_id===e.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
