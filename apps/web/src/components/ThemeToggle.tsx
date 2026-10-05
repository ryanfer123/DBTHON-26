import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
function preferred(): Theme {
  try {
    const saved = localStorage.getItem('second-table-theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch { /* Preference storage is optional. */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(preferred)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const color = document.querySelector('meta[name="theme-color"]')
    color?.setAttribute('content', theme === 'dark' ? '#101c18' : '#173d2d')
  }, [theme])
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const change = () => setTheme(preferred())
    const sync = (event: StorageEvent) => { if (event.key === 'second-table-theme') change() }
    media?.addEventListener('change', change)
    window.addEventListener('storage', sync)
    return () => { media?.removeEventListener('change', change); window.removeEventListener('storage', sync) }
  }, [])
  return <button className="theme-toggle" type="button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={theme === 'dark'} onClick={() => {
      const next = theme === 'dark' ? 'light' : 'dark'
      setTheme(next)
      try { localStorage.setItem('second-table-theme', next) } catch { /* Works without persistence. */ }
    }}>
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {theme === 'dark' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></> : <path d="M20.8 13.3A9 9 0 0 1 10.7 3.2 9 9 0 1 0 20.8 13.3Z" />}
    </svg>
  </button>
}
