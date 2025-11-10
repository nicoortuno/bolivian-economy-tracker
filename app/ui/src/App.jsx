import { useEffect, useState } from 'react'
import Home from './pages/Home.jsx'
import Currency from './pages/Currency.jsx'
import News from './pages/News.jsx'

const NAV = [
  { key: 'home',     label: 'Home' },
  { key: 'currency', label: 'Currency' },
  { key: 'news',     label: 'News' },
]

export default function App() {
  const [tab, setTab] = useState('home')
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('bet.sidebar')
    if (saved === 'closed') setOpen(false)
  }, [])
  useEffect(() => {
    localStorage.setItem('bet.sidebar', open ? 'open' : 'closed')
  }, [open])

  const onNav = (key) => {
    setTab(key)
    if (window.matchMedia('(max-width: 980px)').matches) setOpen(false)
  }

  const goHome = (e) => {
    e.preventDefault()
    onNav('home')
  }

  return (
    <div className={`layout ${open ? 'sb-open' : 'sb-closed'}`}>
      {/* === Sidebar === */}
      <aside className={`sidebar ${open ? 'open' : 'closed'}`} aria-label="Primary navigation">
        <div className="sidebar-header">
          <button
            className="sidebar-toggle"
            aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
          >
            <div className={`burger ${open ? 'open' : ''}`} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item) => {
            const active = tab === item.key
            return (
              <button
                key={item.key}
                className={`nav-link ${active ? 'active' : ''}`}
                onClick={() => onNav(item.key)}
                aria-current={active ? 'page' : undefined}
                title={item.label}
              >
                {open && <span className="nav-label">{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <span className="muted">v1.0</span>
        </div>
      </aside>

      {/* === Main Area === */}
      <div className="main">
        {/* Top Header */}
        <header className="header slim">
          {/* Mobile-only toggle */}
          <button
            className="sidebar-toggle only-mobile"
            aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
          >
            <div className={`burger ${open ? 'open' : ''}`} />
          </button>

          <a href="#" className="brand" onClick={goHome} style={{ color: 'var(--accent)' }}>
            Bolivian Economy Tracker
          </a>
        </header>

        {/* Page content */}
        <main className="container">
          {tab === 'home' && <Home />}
          {tab === 'currency' && <Currency />}
          {tab === 'news' && <News />}
        </main>

        {/* Footer */}
        <footer className="footer">
          Bolivian Economy Tracker · <span style={{ color: 'var(--muted)' }}>v1.0</span>
        </footer>
      </div>

      {/* Mobile overlay */}
      <div
        className={`scrim ${open ? 'show' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />
    </div>
  )
}
