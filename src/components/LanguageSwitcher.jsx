import { useState } from 'react'

const getLang = () => { try { return localStorage.getItem('hs_lang') || 'en' } catch { return 'en' } }

export default function LanguageSwitcher() {
  const [lang, setLangState] = useState(getLang())

  const toggle = () => {
    const next = lang === 'en' ? 'no' : 'en'
    try { localStorage.setItem('hs_lang', next) } catch {}
    setLangState(next)
    window.location.reload()
  }

  return (
    <button onClick={toggle} style={{
      position: 'fixed', bottom: '20px', left: '20px', zIndex: 9999,
      background: '#fff', border: '1px solid #e0d8d0', borderRadius: '20px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
      padding: '9px 20px', cursor: 'pointer',
      fontSize: '14px', fontFamily: 'DM Sans, sans-serif', color: '#1a1410',
      display: 'flex', alignItems: 'center', gap: '8px',
    }}>
      {lang === 'en'
        ? <><span>🇳🇴</span><span>Norsk</span></>
        : <><span>🇬🇧</span><span>English</span></>}
    </button>
  )
}
