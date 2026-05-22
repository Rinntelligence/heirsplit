import { useState } from 'react'
import { getLang, setLang } from '../lib/lang'

export default function LanguageSwitcher() {
  const [lang, setLangState] = useState(getLang())

  const toggle = () => {
    const next = lang === 'en' ? 'no' : 'en'
    setLang(next)
    setLangState(next)
    window.location.reload()
  }

  return (
    <button onClick={toggle} style={{
      position: 'fixed', bottom: '16px', left: '16px', zIndex: 9999,
      background: 'rgba(255,255,255,0.95)', border: '1px solid #e0d8d0',
      borderRadius: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
      padding: '7px 12px', cursor: 'pointer',
      fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: '#1a1410',
      display: 'flex', alignItems: 'center', gap: '5px',
    }}>
      {lang === 'en' ? '🇳🇴' : '🇬🇧'}
    </button>
  )
}
