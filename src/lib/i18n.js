export const LANGUAGES = [
  { code: 'no', label: 'Norsk',      flag: '🇳🇴', currency: 'NOK', marketUrl: 'finn.no' },
  { code: 'en', label: 'English',    flag: '🇬🇧', currency: 'USD', marketUrl: 'ebay.com' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪', currency: 'EUR', marketUrl: 'ebay.de' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷', currency: 'EUR', marketUrl: 'leboncoin.fr' },
  { code: 'es', label: 'Español',    flag: '🇪🇸', currency: 'EUR', marketUrl: 'wallapop.com' },
  { code: 'sv', label: 'Svenska',    flag: '🇸🇪', currency: 'SEK', marketUrl: 'blocket.se' },
  { code: 'da', label: 'Dansk',      flag: '🇩🇰', currency: 'DKK', marketUrl: 'dba.dk' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱', currency: 'EUR', marketUrl: 'marktplaats.nl' },
  { code: 'pl', label: 'Polski',     flag: '🇵🇱', currency: 'PLN', marketUrl: 'olx.pl' },
  { code: 'ar', label: 'العربية',    flag: '🇸🇦', currency: 'USD', marketUrl: 'ebay.com' },
]

export const CURRENCIES = [
  { code: 'NOK', symbol: 'kr', label: 'NOK — Norwegian Krone' },
  { code: 'USD', symbol: '$',  label: 'USD — US Dollar' },
  { code: 'EUR', symbol: '€',  label: 'EUR — Euro' },
  { code: 'GBP', symbol: '£',  label: 'GBP — British Pound' },
  { code: 'SEK', symbol: 'kr', label: 'SEK — Swedish Krona' },
  { code: 'DKK', symbol: 'kr', label: 'DKK — Danish Krone' },
  { code: 'PLN', symbol: 'zł', label: 'PLN — Polish Złoty' },
  { code: 'CHF', symbol: 'Fr', label: 'CHF — Swiss Franc' },
]

const detectLang = () => {
  try {
    const stored = localStorage.getItem('hs_lang')
    if (stored) return stored
    const nav = navigator.language || ''
    if (nav.startsWith('no')) return 'no'
    if (nav.startsWith('sv')) return 'sv'
    if (nav.startsWith('da')) return 'da'
    if (nav.startsWith('de')) return 'de'
    if (nav.startsWith('fr')) return 'fr'
    if (nav.startsWith('es')) return 'es'
    if (nav.startsWith('nl')) return 'nl'
    if (nav.startsWith('pl')) return 'pl'
    if (nav.startsWith('ar')) return 'ar'
    return 'en'
  } catch { return 'en' }
}

export const getLang = detectLang
export const getCurrency = () => {
  try { return localStorage.getItem('hs_currency') || LANGUAGES.find(l => l.code === getLang())?.currency || 'USD' } catch { return 'USD' }
}
