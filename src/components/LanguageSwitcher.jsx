import { useState } from 'react'
import { LANGUAGES, CURRENCIES, getLang, getCurrency } from '../lib/i18n'

export default function LanguageSwitcher({ onLangChange, onCurrencyChange }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('lang')
  const [currentLang, setCurrentLang] = useState(getLang())
  const [currentCurrency, setCurrentCurrency] = useState(getCurrency())

  const lang = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[1]

  const handleLang = (code) => {
    try { localStorage.setItem('hs_lang', code) } catch {}
    setCurrentLang(code)
    const defaultCurrency = LANGUAGES.find(l => l.code === code)?.currency || 'USD'
    try { localStorage.setItem('hs_currency', defaultCurrency) } catch {}
    setCurrentCurrency(defaultCurrency)
    setOpen(false)
    onLangChange?.(code)
    onCurrencyChange?.(defaultCurrency)
  }

  const handleCurrency = (code) => {
    try { localStorage.setItem('hs_currency', code) } catch {}
    setCurrentCurrency(code)
    setOpen(false)
    onCurrencyChange?.(code)
  }

  return (
    <div style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 500, fontFamily: 'DM Sans, sans-serif' }}>
      {open && (
        <>
          {/* Backdrop */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: -1 }} />

          <div style={{
            position: 'absolute', bottom: '52px', left: 0,
            background: '#fff', border: '1px solid #e8e0d6',
            borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
            width: '260px', overflow: 'hidden',
          }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #f0ebe4' }}>
              {[['lang', '🌍 Language'], ['currency', '💱 Currency']].map(([t, l]) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: '11px 8px', border: 'none', cursor: 'pointer',
                  background: tab === t ? '#f5f0eb' : '#fff',
                  fontSize: '13px', color: '#1a1410', fontFamily: 'DM Sans, sans-serif',
                  borderBottom: tab === t ? '2px solid #1a1410' : '2px solid transparent',
                  fontWeight: tab === t ? '500' : '400',
                }}>{l}</button>
              ))}
            </div>

            {/* Language list */}
            {tab === 'lang' && (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {LANGUAGES.map(l => (
                  <button key={l.code} onClick={() => handleLang(l.code)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '10px 16px', border: 'none',
                    background: currentLang === l.code ? '#f0ebe4' : '#fff',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
                    borderBottom: '1px solid #f8f5f2',
                  }}>
                    <span style={{ fontSize: '20px' }}>{l.flag}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', color: '#1a1410' }}>{l.label}</div>
                      <div style={{ fontSize: '11px', color: '#a89080' }}>{l.currency} · {l.marketUrl}</div>
                    </div>
                    {currentLang === l.code && <span style={{ color: '#7aaa7a' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Currency list */}
            {tab === 'currency' && (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {CURRENCIES.map(c => (
                  <button key={c.code} onClick={() => handleCurrency(c.code)} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    width: '100%', padding: '10px 16px', border: 'none',
                    background: currentCurrency === c.code ? '#f0ebe4' : '#fff',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
                    borderBottom: '1px solid #f8f5f2',
                  }}>
                    <span style={{ fontSize: '16px', fontWeight: '600', color: '#c4855a', minWidth: '20px' }}>{c.symbol}</span>
                    <div style={{ fontSize: '13px', color: '#1a1410', flex: 1 }}>{c.label}</div>
                    {currentCurrency === c.code && <span style={{ color: '#7aaa7a' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', background: '#fff',
          border: '1px solid #e0d8d0', borderRadius: '20px',
          cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
          fontSize: '14px', fontFamily: 'DM Sans, sans-serif', color: '#1a1410',
        }}
      >
        <span>{lang.flag}</span>
        <span style={{ fontSize: '12px', color: '#8c7b6b' }}>{lang.code.toUpperCase()}</span>
        <span style={{ fontSize: '11px', color: '#c4855a', fontWeight: '500' }}>{currentCurrency}</span>
        <span style={{ fontSize: '10px', color: '#c0b0a0' }}>{open ? '▲' : '▼'}</span>
      </button>
    </div>
  )
}
