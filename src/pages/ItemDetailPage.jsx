import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getItem, addInterest, removeInterest, deleteItem, getComments, addComment, deleteComment, assignItem, getEstateMembers, supabase } from '../lib/supabase'

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
  const [showAssign, setShowAssign] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false)
  const commentsEndRef = useRef(null)

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

  if (loading) return <div style={{ padding:'80px', textAlign:'center', color:'#a89080', fontFamily:'DM Sans, sans-serif' }}>Laster…</div>
  if (!item) return <div style={{ padding:'80px', textAlign:'center', color:'#a89080', fontFamily:'DM Sans, sans-serif' }}>Gjenstand ikke funnet.</div>

  const cat = item.categories || { emoji:'📦', label:'Annet' }
  const myInterest = item.interests?.find(x => x.user_id === session.user.id)
  const isAssigned = item.status === 'assigned'
  const canDelete = myRole === 'admin' || item.added_by === session.user.id

  const handleInterest = async () => {
    if (myInterest) {
      setShowWithdrawConfirm(true)
      return
    }
    if (!showReason) { setShowReason(true); return }
    await addInterest(itemId, session.user.id, reason)
    onToast('Interesse registrert ✓')
    setShowReason(false); setReason(''); load()
  }

  const confirmWithdraw = async () => {
    await removeInterest(itemId, session.user.id)
    onToast('Interesse trukket tilbake')
    setShowWithdrawConfirm(false)
    load()
  }

  const handleComment = async () => {
    if (!commentText.trim()) return
    setSubmittingComment(true)
    await addComment(itemId, session.user.id, commentText.trim())
    setCommentText(''); setSubmittingComment(false); load()
  }

  const handleAssign = async (userId) => {
    await assignItem(itemId, userId)
    onToast('Gjenstand tildelt ✓'); setShowAssign(false); load()
  }

  const handleDelete = async () => {
    await deleteItem(itemId)
    onToast('Gjenstand slettet')
    navigate(`/estate/${id}`)
  }

  return (
    <div style={{ maxWidth:'700px', margin:'0 auto', padding:'28px 16px', fontFamily:'DM Sans, sans-serif' }}>
      <button onClick={() => navigate(`/estate/${id}`)} style={{ background:'none', border:'none', color:'#8c7b6b', cursor:'pointer', fontSize:'13px', padding:'0 0 20px', fontFamily:'DM Sans, sans-serif' }}>
        ← Tilbake til estate
      </button>

      {/* Image */}
      <div style={{ background:'#f0ebe4', borderRadius:'14px', height:'260px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'24px', overflow:'hidden' }}>
        {item.image_url
          ? <img src={item.image_url} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
          : <span style={{ fontSize:'90px' }}>{cat.emoji}</span>}
      </div>

      {/* Item info */}
      <div style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'14px', padding:'28px', marginBottom:'20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
          <h1 style={{ fontFamily:'Playfair Display, serif', fontSize:'24px', fontWeight:'400', color:'#1a1410', margin:0 }}>{item.title}</h1>
          <span style={{ fontSize:'12px', color:'#a89080', background:'#f5f0eb', padding:'4px 12px', borderRadius:'20px', marginLeft:'12px', whiteSpace:'nowrap' }}>{cat.emoji} {cat.label}</span>
        </div>
        <p style={{ color:'#a89080', fontSize:'13px', marginBottom:'8px' }}>
          Lagt inn av {item.added_by_name || 'ukjent'} · {new Date(item.created_at).toLocaleDateString('nb-NO', { day:'numeric', month:'long', year:'numeric' })}
        </p>
        {item.estimated_value && <p style={{ color:'#c4855a', fontSize:'13px', marginBottom:'8px' }}>Estimert verdi: {item.estimated_value}</p>}
        {item.description && <p style={{ color:'#4a3c30', lineHeight:'1.8', marginBottom:'24px', fontSize:'15px' }}>{item.description}</p>}

        {/* Assigned */}
        {isAssigned ? (
          <div style={{ padding:'16px', background:'#f0faf0', border:'1px solid #b8ddb8', borderRadius:'10px', display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
            <div style={{ fontSize:'32px' }}>✅</div>
            <div>
              <div style={{ fontSize:'14px', color:'#1a1410', fontWeight:'500' }}>Denne gjenstanden er tildelt</div>
              <div style={{ fontSize:'12px', color:'#7aaa7a', marginTop:'2px' }}>Offisielt fordelt</div>
            </div>
          </div>
        ) : showWithdrawConfirm ? (
          /* Withdraw confirmation */
          <div style={{ padding:'18px', background:'#fef3e8', border:'1px solid #e8c4a0', borderRadius:'10px', marginBottom:'24px' }}>
            <div style={{ fontSize:'15px', color:'#1a1410', marginBottom:'12px', fontWeight:'500' }}>
              Vil du angre interessen din for denne gjenstanden?
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={() => setShowWithdrawConfirm(false)} style={{
                flex:1, padding:'11px', background:'#fff', border:'1px solid #e0d8d0',
                borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontFamily:'DM Sans, sans-serif', color:'#6b5c4c',
              }}>Nei, behold</button>
              <button onClick={confirmWithdraw} style={{
                flex:1, padding:'11px', background:'#c0392b', color:'#fff',
                border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontFamily:'DM Sans, sans-serif',
              }}>Ja, angre</button>
            </div>
          </div>
        ) : myInterest ? (
          <button onClick={handleInterest} style={{ width:'100%', padding:'14px', background:'#f0ebe4', color:'#1a1410', border:'1px solid #1a1410', borderRadius:'10px', cursor:'pointer', fontSize:'15px', fontFamily:'DM Sans, sans-serif', marginBottom:'24px' }}>
            ✓ Du er interessert — klikk for å angre
          </button>
        ) : showReason ? (
          <div style={{ marginBottom:'24px' }}>
            <label style={{ display:'block', fontSize:'14px', color:'#6b5c4c', marginBottom:'10px' }}>
              Hvorfor vil du ha denne gjenstanden? <span style={{ color:'#a89080' }}>(valgfri)</span>
            </label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="f.eks. Jeg husker denne fra barndommen…" rows={3}
              style={{ width:'100%', padding:'12px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'14px', fontFamily:'DM Sans, sans-serif', color:'#1a1410', background:'#faf7f3', resize:'vertical', outline:'none', boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:'10px', marginTop:'10px' }}>
              <button onClick={() => setShowReason(false)} style={{ flex:1, padding:'11px', background:'none', border:'1px solid #e0d8d0', borderRadius:'8px', cursor:'pointer', color:'#6b5c4c', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>Avbryt</button>
              <button onClick={handleInterest} style={{ flex:2, padding:'11px', background:'#1a1410', color:'#f5f0eb', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>Registrer interesse</button>
            </div>
          </div>
        ) : (
          <button onClick={handleInterest} style={{ width:'100%', padding:'14px', background:'#1a1410', color:'#f5f0eb', border:'none', borderRadius:'10px', cursor:'pointer', fontSize:'15px', fontFamily:'DM Sans, sans-serif', marginBottom:'24px' }}>
            Registrer interesse
          </button>
        )}

        {/* Interested people */}
        <div style={{ borderTop:'1px solid #f0ebe4', paddingTop:'20px', marginBottom:'16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <h3 style={{ fontSize:'13px', color:'#a89080', fontWeight:'400', textTransform:'uppercase', letterSpacing:'1px' }}>
              Interesserte ({item.interests?.length || 0})
            </h3>
            {myRole === 'admin' && !isAssigned && item.interests?.length > 0 && (
              <button onClick={() => setShowAssign(!showAssign)} style={{ fontSize:'13px', color:'#c4855a', background:'none', border:'1px solid #e8c4a0', padding:'5px 12px', borderRadius:'6px', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                ✅ Tildel
              </button>
            )}
          </div>

          {showAssign && (
            <div style={{ background:'#fef3e8', border:'1px solid #e8c4a0', borderRadius:'10px', padding:'16px', marginBottom:'16px' }}>
              <p style={{ fontSize:'13px', color:'#6b5c4c', marginBottom:'12px' }}>Hvem får denne gjenstanden?</p>
              {members.map(m => (
                <button key={m.user_id} onClick={() => handleAssign(m.user_id)} style={{ display:'flex', alignItems:'center', gap:'10px', width:'100%', padding:'10px 14px', background:'#fff', border:'1px solid #e8c4a0', borderRadius:'8px', cursor:'pointer', textAlign:'left', fontFamily:'DM Sans, sans-serif', marginBottom:'6px' }}>
                  <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:m.profiles?.avatar_color||'#888', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'#fff', fontWeight:'500' }}>
                    {(m.profiles?.display_name||'?')[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize:'14px', color:'#1a1410' }}>{m.profiles?.display_name}</span>
                  {item.interests?.some(x => x.user_id===m.user_id) && <span style={{ fontSize:'11px', color:'#c4855a', marginLeft:'auto' }}>interessert</span>}
                </button>
              ))}
            </div>
          )}

          {!item.interests?.length ? (
            <p style={{ color:'#c0b0a0', fontSize:'14px', fontStyle:'italic' }}>Ingen har vist interesse ennå.</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {item.interests.map(x => (
                <div key={x.id} style={{ display:'flex', gap:'14px', alignItems:'flex-start', padding:'14px 16px', background:'#faf7f3', border:'1px solid #e8e0d6', borderRadius:'10px' }}>
                  <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:x.profiles?.avatar_color||'#888', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', color:'#fff', fontWeight:'500', flexShrink:0 }}>
                    {(x.profiles?.display_name||'?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'14px', color:'#1a1410', marginBottom:'4px', fontWeight:'500' }}>
                      {x.profiles?.display_name}
                      {x.user_id === session.user.id && <span style={{ color:'#a89080', fontSize:'12px', fontWeight:'400', marginLeft:'6px' }}>(deg)</span>}
                    </div>
                    {x.reason && <div style={{ fontSize:'13px', color:'#6b5c4c', fontStyle:'italic', lineHeight:1.6 }}>"{x.reason}"</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        {canDelete && (
          <div style={{ borderTop:'1px solid #f0ebe4', paddingTop:'16px' }}>
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} style={{ background:'none', border:'none', color:'#c0392b', cursor:'pointer', fontSize:'13px', fontFamily:'DM Sans, sans-serif' }}>
                🗑 Slett gjenstand…
              </button>
            ) : (
              <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:'13px', color:'#6b5c4c' }}>Er du sikker? Kan ikke angres.</span>
                <button onClick={handleDelete} style={{ padding:'7px 16px', background:'#c0392b', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'13px', fontFamily:'DM Sans, sans-serif' }}>Slett</button>
                <button onClick={() => setShowDeleteConfirm(false)} style={{ padding:'7px 16px', background:'none', border:'1px solid #e0d8d0', borderRadius:'6px', cursor:'pointer', fontSize:'13px', fontFamily:'DM Sans, sans-serif', color:'#6b5c4c' }}>Avbryt</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comments */}
      <div style={{ background:'#fff', border:'1px solid #e8e0d6', borderRadius:'14px', padding:'24px' }}>
        <h3 style={{ fontFamily:'Playfair Display, serif', fontSize:'18px', fontWeight:'400', color:'#1a1410', marginBottom:'16px' }}>
          Kommentarer ({comments.length})
        </h3>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px', maxHeight:'360px', overflowY:'auto' }}>
          {comments.length === 0 ? (
            <p style={{ color:'#c0b0a0', fontSize:'14px', fontStyle:'italic' }}>Ingen kommentarer ennå.</p>
          ) : comments.map(c => (
            <div key={c.id} style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
              <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:c.profiles?.avatar_color||'#888', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', color:'#fff', fontWeight:'500', flexShrink:0 }}>
                {(c.profiles?.display_name||'?')[0].toUpperCase()}
              </div>
              <div style={{ flex:1, background:'#faf7f3', border:'1px solid #e8e0d6', borderRadius:'10px', padding:'10px 14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                  <span style={{ fontSize:'13px', fontWeight:'500', color:'#1a1410' }}>{c.profiles?.display_name}</span>
                  <span style={{ fontSize:'11px', color:'#a89080' }}>{new Date(c.created_at).toLocaleDateString('nb-NO', { day:'numeric', month:'short' })}</span>
                </div>
                <p style={{ fontSize:'14px', color:'#4a3c30', lineHeight:'1.6', margin:0 }}>{c.content}</p>
                {c.user_id === session.user.id && (
                  <button onClick={async () => { await deleteComment(c.id); load() }} style={{ background:'none', border:'none', color:'#c0a090', cursor:'pointer', fontSize:'12px', marginTop:'4px', fontFamily:'DM Sans, sans-serif' }}>slett</button>
                )}
              </div>
            </div>
          ))}
          <div ref={commentsEndRef} />
        </div>

        <div style={{ display:'flex', gap:'8px', alignItems:'flex-end' }}>
          <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:profile?.avatar_color||'#888', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', color:'#fff', fontWeight:'500', flexShrink:0 }}>
            {(profile?.display_name||'?')[0].toUpperCase()}
          </div>
          <div style={{ flex:1 }}>
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleComment()} }}
              placeholder="Skriv en kommentar… (Enter for å sende)" rows={2}
              style={{ width:'100%', padding:'10px 14px', border:'1px solid #e0d8d0', borderRadius:'8px', fontSize:'14px', fontFamily:'DM Sans, sans-serif', color:'#1a1410', background:'#faf7f3', resize:'none', outline:'none', boxSizing:'border-box' }} />
          </div>
          <button onClick={handleComment} disabled={!commentText.trim()||submittingComment} style={{
            padding:'10px 14px', background:commentText.trim()?'#1a1410':'#c0b8b0', color:'#f5f0eb',
            border:'none', borderRadius:'8px', cursor:commentText.trim()?'pointer':'not-allowed',
            fontSize:'14px', fontFamily:'DM Sans, sans-serif',
          }}>Send</button>
        </div>
      </div>
    </div>
  )
}
