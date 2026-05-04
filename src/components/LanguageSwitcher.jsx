import { useState } from 'react'
import { CURRENCIES, getLang, getCurrency } from '../lib/i18n'

const LANGS = [
  { code:'en', flag:'🇬🇧', label:'English' },
  { code:'no', flag:'🇳🇴', label:'Norsk' },
  { code:'de', flag:'🇩🇪', label:'Deutsch' },
  { code:'fr', flag:'🇫🇷', label:'Français' },
  { code:'es', flag:'🇪🇸', label:'Español' },
  { code:'sv', flag:'🇸🇪', label:'Svenska' },
  { code:'da', flag:'🇩🇰', label:'Dansk' },
  { code:'nl', flag:'🇳🇱', label:'Nederlands' },
  { code:'pl', flag:'🇵🇱', label:'Polski' },
  { code:'ar', flag:'🇸🇦', label:'العربية' },
]

export default function LanguageSwitcher() {
  const [lang, setLang] = useState(getLang() || 'en')
  const [currency, setCurrency] = useState(getCurrency() || 'USD')

  const handleLang = (e) => {
    const code = e.target.value
    setLang(code)
    try { localStorage.setItem('hs_lang', code) } catch {}
    const combo = document.querySelector('.goog-te-combo')
    if (combo) { combo.value = code; combo.dispatchEvent(new Event('change')) }
    else window.location.reload()
  }

  const handleCurrency = (e) => {
    const code = e.target.value
    setCurrency(code)
    try { localStorage.setItem('hs_currency', code) } catch {}
  }

  const currentFlag = LANGS.find(l => l.code === lang)?.flag || '🌍'

  return (
    <div style={{ position:'fixed', bottom:'20px', left:'20px', zIndex:9999, display:'flex', gap:'8px' }}>
      <div style={{ background:'#fff', border:'1px solid #e0d8d0', borderRadius:'20px', boxShadow:'0 2px 12px rgba(0,0,0,0.10)', padding:'7px 14px', display:'flex', alignItems:'center', gap:'6px' }}>
        <span>{currentFlag}</span>
        <select value={lang} onChange={handleLang} style={{ border:'none', outline:'none', background:'transparent', fontSize:'13px', color:'#1a1410', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
          {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
        </select>
      </div>
      <div style={{ background:'#fff', border:'1px solid #e0d8d0', borderRadius:'20px', boxShadow:'0 2px 12px rgba(0,0,0,0.10)', padding:'7px 14px', display:'flex', alignItems:'center', gap:'6px' }}>
        <span style={{ fontSize:'13px', color:'#c4855a' }}>💱</span>
        <select value={currency} onChange={handleCurrency} style={{ border:'none', outline:'none', background:'transparent', fontSize:'13px', color:'#1a1410', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
        </select>
      </div>
    </div>
  )
}
