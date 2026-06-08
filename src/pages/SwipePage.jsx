import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getItems, addInterest, removeInterest, supabase } from '../lib/supabase'

export default function SwipePage({ session, profile, onToast }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [action, setAction] = useState(null) // 'like' | 'pass' | 'trash'
  const startPos = useRef(null)
  const cardRef = useRef(null)

  useEffect(() => {
    getItems(id).then(({ data }) => {
      // Filter out already-interacted items
      const unswipedItems = (data || []).filter(item =>
        !item.interests?.some(x => x.user_id === session.user.id)
      )
      setItems(unswipedItems)
      setLoading(false)
    })
  }, [id])

  const currentItem = items[index]

  const handleAction = async (type) => {
    if (!currentItem) return
    setAction(type)

    setTimeout(async () => {
      if (type === 'like') {
        await addInterest(currentItem.id, session.user.id, '')
        onToast('❤️ Interesse registrert!')
      } else if (type === 'trash') {
        await supabase.from('items').update({ marked_for_disposal: true }).eq('id', currentItem.id)
        onToast('🗑️ Merket for kast')
      } else {
        onToast('👈 Hoppet over')
      }

      setOffset({ x: 0, y: 0 })
      setAction(null)
      if (index + 1 >= items.length) {
        setDone(true)
      } else {
        setIndex(i => i + 1)
      }
    }, 400)
  }

  // Touch handlers
  const onTouchStart = (e) => {
    startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    setDragging(true)
  }

  const onTouchMove = (e) => {
    if (!startPos.current) return
    const dx = e.touches[0].clientX - startPos.current.x
    const dy = e.touches[0].clientY - startPos.current.y
    setOffset({ x: dx, y: dy })

    if (dy < -80) setAction('trash')
    else if (dx > 60) setAction('like')
    else if (dx < -60) setAction('pass')
    else setAction(null)
  }

  const onTouchEnd = () => {
    setDragging(false)
    if (action) {
      handleAction(action)
    } else {
      setOffset({ x: 0, y: 0 })
    }
    startPos.current = null
  }

  // Mouse handlers for desktop
  const onMouseDown = (e) => {
    startPos.current = { x: e.clientX, y: e.clientY }
    setDragging(true)
  }

  const onMouseMove = (e) => {
    if (!dragging || !startPos.current) return
    const dx = e.clientX - startPos.current.x
    const dy = e.clientY - startPos.current.y
    setOffset({ x: dx, y: dy })
    if (dy < -80) setAction('trash')
    else if (dx > 60) setAction('like')
    else if (dx < -60) setAction('pass')
    else setAction(null)
  }

  const onMouseUp = () => {
    if (!dragging) return
    setDragging(false)
    if (action) {
      handleAction(action)
    } else {
      setOffset({ x: 0, y: 0 })
    }
    startPos.current = null
  }

  const rotate = offset.x * 0.08
  const cardStyle = {
    transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg)`,
    transition: dragging ? 'none' : 'transform 0.3s ease',
    cursor: dragging ? 'grabbing' : 'grab',
    userSelect: 'none',
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans, sans-serif', color:'#a89080' }}>
      Laster…
    </div>
  )

  if (done || items.length === 0) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans, sans-serif', padding:'20px', textAlign:'center', background:'#f8f5f0' }}>
      <div style={{ fontSize:'64px', marginBottom:'20px' }}>🎉</div>
      <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:'24px', fontWeight:'400', color:'#1a1410', marginBottom:'12px' }}>
        {items.length === 0 ? 'Ingen gjenstander igjen!' : 'Du har sett alle gjenstander!'}
      </h2>
      <p style={{ color:'#8c7b6b', marginBottom:'32px' }}>Gå tilbake for å se dine interesser</p>
      <button onClick={() => navigate(`/estate/${id}`)} style={{ padding:'14px 32px', background:'#1a1410', color:'#f5f0eb', border:'none', borderRadius:'10px', cursor:'pointer', fontSize:'16px', fontFamily:'DM Sans, sans-serif' }}>
        ← Tilbake til oversikt
      </button>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f8f5f0', fontFamily:'DM Sans, sans-serif', display:'flex', flexDirection:'column' }}
      onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

      {/* Header */}
      <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={() => navigate(`/estate/${id}`)} style={{ background:'none', border:'none', color:'#8c7b6b', cursor:'pointer', fontSize:'14px', fontFamily:'DM Sans, sans-serif' }}>
          ← Tilbake
        </button>
        <div style={{ fontSize:'13px', color:'#a89080' }}>
          {index + 1} / {items.length}
        </div>
        <div style={{ width:'60px' }} />
      </div>

      {/* Progress bar */}
      <div style={{ height:'3px', background:'#e8e0d6', margin:'0 20px' }}>
        <div style={{ height:'100%', background:'#1a1410', width:`${((index) / items.length) * 100}%`, transition:'width 0.3s', borderRadius:'2px' }} />
      </div>

      {/* Card area */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px', position:'relative' }}>

        {/* Action indicators */}
        {action === 'like' && (
          <div style={{ position:'absolute', top:'30px', left:'30px', background:'#7aaa7a', color:'#fff', padding:'8px 20px', borderRadius:'8px', fontSize:'22px', fontWeight:'700', transform:'rotate(-15deg)', zIndex:10, border:'3px solid #5a8a5a' }}>
            ❤️ VIL HA
          </div>
        )}
        {action === 'pass' && (
          <div style={{ position:'absolute', top:'30px', right:'30px', background:'#c0392b', color:'#fff', padding:'8px 20px', borderRadius:'8px', fontSize:'22px', fontWeight:'700', transform:'rotate(15deg)', zIndex:10, border:'3px solid #a02020' }}>
            👈 PASS
          </div>
        )}
        {action === 'trash' && (
          <div style={{ position:'absolute', top:'30px', left:'50%', transform:'translateX(-50%)', background:'#e67e22', color:'#fff', padding:'8px 20px', borderRadius:'8px', fontSize:'22px', fontWeight:'700', zIndex:10, border:'3px solid #c0621a' }}>
            🗑️ KAST
          </div>
        )}

        {/* Next card (background) */}
        {items[index + 1] && (
          <div style={{ position:'absolute', width:'min(380px, 90vw)', background:'#fff', borderRadius:'20px', overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', transform:'scale(0.95) translateY(10px)', zIndex:0 }}>
            <div style={{ height:'320px', background:'#f0ebe4' }} />
          </div>
        )}

        {/* Main card */}
        <div ref={cardRef} style={{ ...cardStyle, width:'min(380px, 90vw)', background:'#fff', borderRadius:'20px', overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,0.12)', zIndex:1, position:'relative' }}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}>

          {/* Image */}
          <div style={{ height:'320px', background:'#f0ebe4', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            {currentItem.image_url
              ? <img src={currentItem.image_url} alt={currentItem.title} style={{ width:'100%', height:'100%', objectFit:'contain', pointerEvents:'none' }} />
              : <span style={{ fontSize:'80px' }}>{currentItem.categories?.emoji || '📦'}</span>
            }
          </div>

          {/* Info */}
          <div style={{ padding:'20px' }}>
            <h2 style={{ fontFamily:'Playfair Display, serif', fontSize:'20px', fontWeight:'400', color:'#1a1410', marginBottom:'6px' }}>{currentItem.title}</h2>
            <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'8px' }}>
              <span style={{ fontSize:'12px', color:'#a89080', background:'#f5f0eb', padding:'3px 10px', borderRadius:'20px' }}>
                {currentItem.categories?.emoji} {currentItem.categories?.label || 'Annet'}
              </span>
              {currentItem.estimated_value && (
                <span style={{ fontSize:'12px', color:'#c4855a' }}>{currentItem.estimated_value}</span>
              )}
            </div>
            {currentItem.description && (
              <p style={{ fontSize:'13px', color:'#6b5c4c', lineHeight:'1.6', margin:0 }}>{currentItem.description.slice(0, 100)}{currentItem.description.length > 100 ? '…' : ''}</p>
            )}
            {currentItem.interests?.length > 0 && (
              <p style={{ fontSize:'12px', color:'#c4855a', marginTop:'8px' }}>
                {currentItem.interests.length} {currentItem.interests.length === 1 ? 'person' : 'personer'} er interessert
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ padding:'16px 20px 32px', display:'flex', justifyContent:'center', gap:'20px', alignItems:'center' }}>
        <button onClick={() => handleAction('pass')} style={{
          width:'64px', height:'64px', borderRadius:'50%', border:'2px solid #e0d8d0',
          background:'#fff', fontSize:'28px', cursor:'pointer',
          boxShadow:'0 4px 16px rgba(0,0,0,0.1)', display:'flex', alignItems:'center', justifyContent:'center',
        }}>👈</button>

        <button onClick={() => handleAction('trash')} style={{
          width:'52px', height:'52px', borderRadius:'50%', border:'2px solid #e8c4a0',
          background:'#fff', fontSize:'22px', cursor:'pointer',
          boxShadow:'0 4px 16px rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'center',
        }}>🗑️</button>

        <button onClick={() => handleAction('like')} style={{
          width:'64px', height:'64px', borderRadius:'50%', border:'2px solid #b8ddb8',
          background:'#fff', fontSize:'28px', cursor:'pointer',
          boxShadow:'0 4px 16px rgba(0,0,0,0.1)', display:'flex', alignItems:'center', justifyContent:'center',
        }}>❤️</button>
      </div>

      {/* Hint */}
      <div style={{ textAlign:'center', paddingBottom:'16px', fontSize:'12px', color:'#c0b0a0' }}>
        Sveip ← pass · ❤️ vil ha · ↑ kast
      </div>
    </div>
  )
}
