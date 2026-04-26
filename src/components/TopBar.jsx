import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { signOut } from '../lib/supabase'

export default function TopBar({ profile, session, onToast, estate }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const brandColor = estate?.branding_color || '#1a1410'
  const brandLogo = estate?.branding_logo
  const brandName = estate?.name ? `HeirSplit · ${estate.name}` : 'HeirSplit'

  return (
    <div style={{
      background: brandColor, color: '#f5f0eb', height: '56px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', position: 'sticky', top: 0, zIndex: 100,
      fontFamily: 'DM Sans, sans-serif', boxShadow: '0 1px 12px rgba(0,0,0,0.18)',
    }}>
      <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
        {brandLogo
          ? <img src={brandLogo} alt="logo" style={{ height: '28px', borderRadius: '4px' }} />
          : <span style={{ fontSize: '20px' }}>⚖️</span>}
        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '17px', color: '#f5f0eb', letterSpacing: '0.3px' }}>{brandName}</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={() => navigate('/pricing')} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>
          Upgrade
        </button>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: profile?.avatar_color || '#6b8fa8',
            border: '2px solid rgba(255,255,255,0.25)', cursor: 'pointer',
            fontSize: '14px', color: '#fff', fontWeight: '500', fontFamily: 'DM Sans, sans-serif',
          }}>{(profile?.display_name || '?')[0].toUpperCase()}</button>

          {menuOpen && (
            <div style={{
              position: 'absolute', top: '42px', right: 0, background: '#fff',
              border: '1px solid #e8e0d6', borderRadius: '10px', minWidth: '180px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.14)', overflow: 'hidden', zIndex: 200,
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0ebe4' }}>
                <div style={{ fontSize: '14px', color: '#1a1410', fontWeight: '500' }}>{profile?.display_name}</div>
                <div style={{ fontSize: '12px', color: '#a89080', marginTop: '2px' }}>{session?.user?.email}</div>
                <div style={{ fontSize: '11px', color: '#c4855a', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Plan: {profile?.plan || 'free'}</div>
              </div>
              {[
                { label: '⚙️ Min profil', action: () => { navigate('/setup'); setMenuOpen(false) } },
                ...(profile?.is_founder ? [{ label: '🔭 Founder dashboard', action: () => { navigate('/founder'); setMenuOpen(false) } }] : []),
                { label: '🚪 Logg ut', action: () => { signOut(); setMenuOpen(false) }, danger: true },
              ].map(({ label, action, danger }) => (
                <button key={label} onClick={action} style={{
                  display: 'block', width: '100%', padding: '11px 16px', background: 'none',
                  border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px',
                  color: danger ? '#c0392b' : '#1a1410', fontFamily: 'DM Sans, sans-serif',
                }}>{label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
