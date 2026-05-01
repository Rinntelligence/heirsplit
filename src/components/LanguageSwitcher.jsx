import { useState } from 'react'
import { LANGUAGES, CURRENCIES, getLang, setLang, getCurrency, setCurrency } from '../lib/i18n'

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('lang')
  const currentLang = LANGUAGES.find(l => l.code === getLang()) || LANGUAGES[1]
  const currentCurrency = getCurrency()

  return (
    <div style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 500 }}>
      {open && (
        <div style={{
          position: 'absolute', bottom: '52px', left: 0,
          background: '#fff', border: '1px solid #e8e0d6',
          borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
          width: '260px', overflow: 'hidden',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #f0ebe4' }}>
            {[['lang','🌍 Language'],['currency','💱 Currency']].map(([t,l]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                background: tab === t ? '#f5f0eb' : '#fff',
                fontSize: '13px', color: '#1a1410', fontFamily: 'DM Sans, sans-serif',
                borderBottom: tab === t ? '2px solid #1a1410' : '2px solid transparent',
              }}>{l}</button>
            ))}
          </div>

          {/* Language list */}
          {tab === 'lang' && (
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {LANGUAGES.map(lang => (
                <button key={lang.code} onClick={() => setLang(lang.code)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '10px 16px', border: 'none',
                  background: currentLang.code === lang.code ? '#f0ebe4' : '#fff',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
                  borderBottom: '1px solid #f8f5f2',
                }}>
                  <span style={{ fontSize: '20px' }}>{lang.flag}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', color: '#1a1410' }}>{lang.label}</div>
                    <div style={{ fontSize: '11px', color: '#a89080' }}>{lang.currency} · {lang.marketUrl}</div>
                  </div>
                  {currentLang.code === lang.code && <span style={{ color: '#7aaa7a', fontSize: '16px' }}>✓</span>}
                </button>
              ))}
            </div>
          )}

          {/* Currency list */}
          {tab === 'currency' && (
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {CURRENCIES.map(cur => (
                <button key={cur.code} onClick={() => setCurrency(cur.code)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '10px 16px', border: 'none',
                  background: currentCurrency === cur.code ? '#f0ebe4' : '#fff',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif',
                  borderBottom: '1px solid #f8f5f2',
                }}>
                  <span style={{ fontSize: '18px', fontWeight: '600', color: '#c4855a', minWidth: '24px' }}>{cur.symbol}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', color: '#1a1410' }}>{cur.label}</div>
                  </div>
                  {currentCurrency === cur.code && <span style={{ color: '#7aaa7a', fontSize: '16px' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Trigger button */}
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 14px', background: '#fff',
        border: '1px solid #e0d8d0', borderRadius: '20px',
        cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
        fontSize: '14px', fontFamily: 'DM Sans, sans-serif', color: '#1a1410',
      }}>
        <span>{currentLang.flag}</span>
        <span style={{ fontSize: '12px', color: '#8c7b6b' }}>{currentLang.code.toUpperCase()}</span>
        <span style={{ fontSize: '11px', color: '#c4855a', fontWeight: '500' }}>{currentCurrency}</span>
      </button>
    </div>
  )
}
