import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AIAssistant from '../components/AIAssistant'
import { getItem, addInterest, removeInterest, deleteItem, getComments, addComment, deleteComment, assignItem, getEstateMembers, supabase } from '../lib/supabase'
import { usePlan } from '../hooks/usePlan'
import { Avatar } from '../components/UI'

export default function ItemDetailPage({ session, profile, onToast }) {
  const { id, itemId } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [comments, setComments] = useState([])
  const [members, setMembers] = useState([])
  const [myRole, setMyRole] = useState('member')
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  const [showReason, setShowReason] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const commentsEndRef = useRef(null)
  const { can } = usePlan()

  const load = async () => {
    const [{ data: it }, { data: cms }, { data: mems }, { data: mem }] = await Promise.all([
      getItem(itemId),
      getComments(itemId),
      getEstateMembers(id),
      supabase.from('estate_members').select('role').eq('estate_id', id).eq('user_id', session.user.id).single(),
    ])
    setItem(it)
    setComments(cms || [])
    setMembers(mems || [])
    setMyRole(mem?.role || 'member')
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase.channel(`item-detail-${itemId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'comments', filter:`item_id=eq.${itemId}` }, load)
      .on('postgres_changes', { event:'*', schema:'public', table:'interests', filter:`item_id=eq.${itemId}` }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [itemId])

  useEffect(() => { commentsEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [comments.length])

  if (loading) return <div style={{ padding:'80px', textAlign:'center', color:'#a89080', fontFamily:'DM Sans, sans-serif' }}>Loading…</div>
  if (!item) return <div style={{ padding:'80px', textAlign:'center', color:'#a89080', fontFamily:'DM Sans, sans-serif' }}>Item not found.</div>

  const cat = item.categories || { emoji:'📦', label:'Other' }
  const myInterest = item.interests?.find(x => x.user_id === session.user.id)
  const isAssigned = item.status === 'assigned'

  const handleInterest = async () => {
    if (myInterest) { await removeInterest(itemId, session.user.id); onToast('Interest removed'); load(); return }
    if (!showReason) { setShowReason(true); return }
    await addInterest(itemId, session.user.id, reason)
    onToast('Interest registered ✓'); setShowReason(false); setReason(''); load()
  }

  const handleComment = async () => {
    if (!commentText.trim()) return
    if (!can('comments')) { onToast('Comments require a paid plan', 'error'); return }
    setSubmittingComment(true)
    await addComment(itemId, session.user.id, commentText.trim())
    setCommentText(''); setSubmittingComment(false); load()
  }

  const handleAssign = async (userId) => {
    await assignItem(itemId, userId)
    onToast('Item assigned ✓'); setShowAssign(false); load()
  }

  const handleDelete = async () => { await deleteItem(itemId); onToast('Item deleted'); navigate(`/estate/${id}`) }

  return (
    <div style={{ maxWidth:'700px', margin:'0 auto', padding:'28px 16px', fontFamily:'DM Sans, sans-serif' }}>
      <button onClick={()=>navigate(`/estate/${id}`)} style={{ background:'none', border:'none', color:'#8c7b6b', cursor:'pointer', fontSize:'13px', padding:'0 0 20px', fontFamily:'DM Sans, sans-serif' }}>← Back to estate</button>

      <div style={{ background:'#f0ebe4', borderRadius:'14px', height:'260px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'24px', overflow:'hidden' }}>
        {item.image_url ? <img src={item.image_url} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'contain', background:'#f0ebe4' }} /> : <span style={{ fontSize:'90px' }}>{cat.emoji}</span>}
      </div>

      <div style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'14px', padding:'32px', marginBottom:'20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
          <h1 style={{ fontFamily:'Playfair Display, serif', fontSize:'24px', fontWeight:'400', color:'#1a1410', margin:0 }}>{item.title}</h1>
          <span style={{ fontSize:'12px', color:'#a89080', background:'#f5f0eb', padding:'4px 12px', borderRadius:'20px', marginLeft:'12px', whiteSpace:'nowrap' }}>{cat.emoji} {cat.label}</span>
        </div>
        <p style={{ color:'#a89080', fontSize:'13px', marginBottom:'8px' }}>Added by {item.added_by_name || 'unknown'} · {new Date(item.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}</p>
        {item.estimated_value && <p style={{ color:'#c4855a', fontSize:'13px', marginBottom:'8px' }}>Estimated value: {item.estimated_value}</p>}
        {item.description && <p style={{ color:'#4a3c30', lineHeight:'1.8', marginBottom:'24px', fontSize:'15px' }}>{item.description}</p>}

        {isAssigned ? (
          <div style={{ padding:'16px', background:'#f0faf0', border:'1px solid #b8ddb8', borderRadius:'10px', display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
            <Avatar name={item.assigned_to_profile?.display_name||'?'} size={40} color={item.assigned_to_profile?.avatar_color} />
            <div>
              <div style={{ fontSize:'14px', color:'#1a1410', fontWeight:'500' }}>Assigned to {item.assigned_to_profile?.display_name}</div>
              <div style={{ fontSize:'12px', color:'#7aaa7a' }}>This item has been officially distributed ✅</div>
            </div>
          </div>
        ) : myInterest ? (
          <button onClick={handleInterest} style={{ width:'100%', padding:'14px', background:'#f0ebe4', color:'#1a1410', border:'1px solid #1a1410', borderRadius:'10px', cursor:'pointer', fontSize:'15px', fontFamily:'DM Sans, sans-serif', marginBottom:'24px' }}>
            ✓ You're interested — click to withdraw
          </button>
        ) : showReason ? (
          <div style={{ marginBottom:'24px' }}>
            <label style={{ display:'block', fontSize:'14px', color:'#6b5c4c', marginBottom:'10px' }}>
              Why do you want this item? <span style={{ color:'#a89080' }}>(optional — visible to all)</span>
            </label>
            <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. I remember this from childhood, it means a lot to me…" rows={3}
              style={{ width:'100%', padding:'12px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'14px', fontFamily:'DM Sans, sans-serif', color:'#1a1410', background:'#faf7f3', resize:'vertical', outline:'none', boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:'10px', marginTop:'10px' }}>
              <button onClick={()=>setShowReason(false)} style={{ flex:1, padding:'11px', background:'none', border:'1px solid #e0d8d0', borderRadius:'8px', cursor:'pointer', color:'#6b5c4c', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>Cancel</button>
              <button onClick={handleInterest} style={{ flex:2, padding:'11px', background:'#1a1410', color:'#f5f0eb', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>Register interest</button>
            </div>
          </div>
        ) : (
          <button onClick={handleInterest} style={{ width:'100%', padding:'14px', background:'#1a1410', color:'#f5f0eb', border:'none', borderRadius:'10px', cursor:'pointer', fontSize:'15px', fontFamily:'DM Sans, sans-serif', marginBottom:'24px' }}>
            Register interest
          </button>
        )}

        {/* Interested people */}
        <div style={{ borderTop:'1px solid #f0ebe4', paddingTop:'24px', marginBottom:'16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
            <h3 style={{ fontSize:'13px', color:'#a89080', fontWeight:'400', textTransform:'uppercase', letterSpacing:'1px' }}>
              Interested ({item.interests?.length || 0})
            </h3>
            {myRole === 'admin' && !isAssigned && item.interests?.length > 0 && (
              <button onClick={()=>setShowAssign(!showAssign)} style={{ fontSize:'13px', color:'#c4855a', background:'none', border:'1px solid #e8c4a0', padding:'5px 12px', borderRadius:'6px', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                ✅ Assign item
              </button>
            )}
          </div>

          {showAssign && (
            <div style={{ background:'#fef3e8', border:'1px solid #e8c4a0', borderRadius:'10px', padding:'16px', marginBottom:'16px' }}>
              <p style={{ fontSize:'13px', color:'#6b5c4c', marginBottom:'12px' }}>Who gets this item?</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {members.map(m => (
                  <button key={m.user_id} onClick={()=>handleAssign(m.user_id)} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:'#fff', border:'1px solid #e8c4a0', borderRadius:'8px', cursor:'pointer', textAlign:'left', fontFamily:'DM Sans, sans-serif' }}>
                    <Avatar name={m.profiles?.display_name||'?'} size={32} color={m.profiles?.avatar_color} />
                    <span style={{ fontSize:'14px', color:'#1a1410' }}>{m.profiles?.display_name}</span>
                    {item.interests?.some(x=>x.user_id===m.user_id) && <span style={{ fontSize:'11px', color:'#c4855a', marginLeft:'auto' }}>interested</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!item.interests?.length ? (
            <p style={{ color:'#c0b0a0', fontSize:'14px', fontStyle:'italic' }}>No one has shown interest yet.</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {item.interests.map(x => (
                <div key={x.id} style={{ display:'flex', gap:'14px', alignItems:'flex-start', padding:'14px 16px', background:'#faf7f3', border:'1px solid #e8e0d6', borderRadius:'10px' }}>
                  <Avatar name={x.profiles?.display_name||'?'} size={40} color={x.profiles?.avatar_color} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'14px', color:'#1a1410', marginBottom:'4px', fontWeight:'500' }}>
                      {x.profiles?.display_name}
                      {x.user_id === session.user.id && <span style={{ color:'#a89080', fontSize:'12px', fontWeight:'400', marginLeft:'6px' }}>(you)</span>}
                    </div>
                    {x.reason && <div style={{ fontSize:'13px', color:'#6b5c4c', fontStyle:'italic', lineHeight:1.6 }}>"{x.reason}"</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Admin tools */}
        {myRole === 'admin' && (
          <div style={{ borderTop:'1px solid #f0ebe4', paddingTop:'20px' }}>
            {!confirmDelete
              ? <button onClick={()=>setConfirmDelete(true)} style={{ background:'none', border:'none', color:'#c0a090', cursor:'pointer', fontSize:'13px', fontFamily:'DM Sans, sans-serif' }}>Delete item…</button>
              : <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                  <span style={{ fontSize:'13px', color:'#6b5c4c' }}>Cannot be undone.</span>
                  <button onClick={handleDelete} style={{ padding:'7px 16px', background:'#c0392b', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'13px', fontFamily:'DM Sans, sans-serif' }}>Delete</button>
                  <button onClick={()=>setConfirmDelete(false)} style={{ padding:'7px 16px', background:'none', border:'1px solid #e0d8d0', borderRadius:'6px', cursor:'pointer', fontSize:'13px', fontFamily:'DM Sans, sans-serif', color:'#6b5c4c' }}>Cancel</button>
                </div>
            }
          </div>
        )}
      </div>

      {/* AI Assistant */}
      <AIAssistant item={item} profile={profile} />

      {/* Comments */}
      <div style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'14px', padding:'28px' }}>
        <h3 style={{ fontFamily:'Playfair Display, serif', fontSize:'18px', fontWeight:'400', color:'#1a1410', marginBottom:'20px' }}>
          Comments ({comments.length})
        </h3>

        {!can('comments') ? (
          <div style={{ padding:'24px', background:'#fef3e8', border:'1px solid #e8c4a0', borderRadius:'10px', textAlign:'center' }}>
            <div style={{ fontSize:'24px', marginBottom:'8px' }}>💬</div>
            <div style={{ fontSize:'14px', color:'#6b5c4c', marginBottom:'12px' }}>Comments require a paid plan — let the family share memories!</div>
            <a href="/pricing" style={{ fontSize:'13px', color:'#c4855a', textDecoration:'underline' }}>See plans →</a>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'20px', maxHeight:'360px', overflowY:'auto' }}>
              {comments.length === 0 ? (
                <p style={{ color:'#c0b0a0', fontSize:'14px', fontStyle:'italic' }}>No comments yet. Be the first to share a memory!</p>
              ) : comments.map(c => (
                <div key={c.id} style={{ display:'flex', gap:'12px', alignItems:'flex-start' }}>
                  <Avatar name={c.profiles?.display_name||'?'} size={36} color={c.profiles?.avatar_color} />
                  <div style={{ flex:1, background:'#faf7f3', border:'1px solid #e8e0d6', borderRadius:'10px', padding:'12px 14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                      <span style={{ fontSize:'13px', fontWeight:'500', color:'#1a1410' }}>{c.profiles?.display_name}</span>
                      <span style={{ fontSize:'11px', color:'#a89080' }}>{new Date(c.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}</span>
                    </div>
                    <p style={{ fontSize:'14px', color:'#4a3c30', lineHeight:'1.6', margin:0 }}>{c.content}</p>
                    {c.user_id === session.user.id && (
                      <button onClick={async()=>{await deleteComment(c.id); load()}} style={{ background:'none', border:'none', color:'#c0a090', cursor:'pointer', fontSize:'12px', marginTop:'6px', fontFamily:'DM Sans, sans-serif' }}>delete</button>
                    )}
                  </div>
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>

            <div style={{ display:'flex', gap:'10px', alignItems:'flex-end' }}>
              <Avatar name={profile?.display_name||'?'} size={36} color={profile?.avatar_color} />
              <div style={{ flex:1 }}>
                <textarea value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleComment()} }}
                  placeholder="Share a memory or comment… (Enter to send)" rows={2}
                  style={{ width:'100%', padding:'11px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'14px', fontFamily:'DM Sans, sans-serif', color:'#1a1410', background:'#faf7f3', resize:'none', outline:'none', boxSizing:'border-box' }} />
              </div>
              <button onClick={handleComment} disabled={!commentText.trim()||submittingComment} style={{
                padding:'11px 16px', background:commentText.trim()?'#1a1410':'#c0b8b0', color:'#f5f0eb',
                border:'none', borderRadius:'8px', cursor:commentText.trim()?'pointer':'not-allowed',
                fontSize:'14px', fontFamily:'DM Sans, sans-serif', whiteSpace:'nowrap',
              }}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
