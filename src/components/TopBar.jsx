import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '../lib/supabase'
import { getLang, setLang } from '../lib/lang'

export default function TopBar({ profile, session, estate }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [lang, setLangState] = useState(getLang())

  const brandColor = estate?.branding_color || '#3A2F26'
  const brandName = estate?.name ? `HeirSplit · ${estate.name}` : 'HeirSplit'

  const toggleLang = () => {
    const next = lang === 'en' ? 'no' : 'en'
    setLang(next)
    setLangState(next)
    setMenuOpen(false)
    window.location.reload()
  }

  return (
    <div style={{
      background: brandColor, color: '#FBF9F5', height: '56px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', position: 'sticky', top: 0, zIndex: 100,
      fontFamily: 'Karla, sans-serif', boxShadow: '0 1px 12px rgba(0,0,0,0.18)',
    }}>
      <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FBF9F5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18M7 21h10M5 7h4M15 7h4M5 7L2.5 12a2.5 2.5 0 0 0 5 0L5 7zM19 7l-2.5 5a2.5 2.5 0 0 0 5 0L19 7z"/>
        </svg>
        <span style={{ fontFamily: 'Fraunces, serif', fontSize: '17px', color: '#FBF9F5' }}>{brandName}</span>
      </button>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: profile?.avatar_color || '#8B9A7D',
          border: '2px solid rgba(255,255,255,0.25)', cursor: 'pointer',
          fontSize: '14px', color: '#fff', fontWeight: '500', fontFamily: 'Karla, sans-serif',
        }}>{(profile?.display_name || '?')[0].toUpperCase()}</button>

        {menuOpen && (
          <div style={{
            position: 'absolute', top: '44px', right: 0, background: '#fff',
            border: '1px solid #D9CFC0', borderRadius: '12px', minWidth: '200px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)', overflow: 'hidden', zIndex: 200,
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E8DFD0' }}>
              <div style={{ fontSize: '14px', color: '#3A2F26', fontWeight: '500' }}>{profile?.display_name}</div>
              <div style={{ fontSize: '12px', color: '#9C8267', marginTop: '2px' }}>{session?.user?.email}</div>
            </div>

            <button onClick={toggleLang} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              width: '100%', padding: '11px 16px', background: 'none',
              border: 'none', borderBottom: '1px solid #E8DFD0',
              textAlign: 'left', cursor: 'pointer', fontSize: '14px',
              color: '#3A2F26', fontFamily: 'Karla, sans-serif',
            }}>
              {lang === 'en' ? '🇳🇴 Bytt til Norsk' : '🇬🇧 Switch to English'}
            </button>

            {[
              { label: 'Min profil', action: () => { navigate('/setup'); setMenuOpen(false) } },
              ...(profile?.is_founder ? [{ label: 'Founder dashboard', action: () => { navigate('/founder'); setMenuOpen(false) } }] : []),
              { label: 'Logg ut', action: () => { signOut(); setMenuOpen(false) }, danger: true },
            ].map(({ label, action, danger }) => (
              <button key={label} onClick={action} style={{
                display: 'block', width: '100%', padding: '11px 16px',
                background: 'none', border: 'none', textAlign: 'left',
                cursor: 'pointer', fontSize: '14px',
                color: danger ? '#8B3A3A' : '#3A2F26',
                fontFamily: 'Karla, sans-serif',
              }}>{label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
