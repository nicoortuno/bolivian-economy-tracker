import { useState } from 'react'
import Home from './pages/Home.jsx'
import Currency from './pages/Currency.jsx'
import News from './pages/News.jsx'
import Macro from './pages/Macro.jsx'

const NAV = [
  { key: 'home', label: 'Home' },
  { key: 'currency', label: 'Currency' },
  { key: 'news', label: 'News' },
  { key: 'macro', label: 'Macro' },
]

export default function App() {
  const [tab, setTab] = useState('home')

  const onNav = (key) => {
    setTab(key)
    window.scrollTo(0, 0)
  }

  return (
    <div className="layout-top">
      <header className="topbar desktop-only">
        <div className="topbar-inner">
          <a
            href="#"
            className="brand"
            onClick={(e) => {
              e.preventDefault()
              onNav('home')
            }}
          >
            Bolivian Economy Tracker
          </a>

          <nav className="topnav" aria-label="Main navigation">
            {NAV.map((item) => {
              const active = tab === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`topnav-link ${active ? 'active' : ''}`}
                  onClick={() => onNav(item.key)}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <nav className="bottombar mobile-only" aria-label="Bottom navigation">
        <div className="bottombar-inner">
          {NAV.map((item) => {
            const active = tab === item.key
            return (
              <button
                key={item.key}
                type="button"
                className={`bottombar-link ${active ? 'active' : ''}`}
                onClick={() => onNav(item.key)}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>

      <main className="container main-content">
        {tab === 'home' && <Home />}
        {tab === 'currency' && <Currency />}
        {tab === 'macro' && <Macro />}
        {tab === 'news' && <News />}
      </main>

      <footer className="footer">
        Bolivian Economy Tracker · <span style={{ color: 'var(--muted)' }}>v1.0</span>
      </footer>
    </div>
  )
}
