import { NavLink, Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Currency from './pages/Currency.jsx'
import News from './pages/News.jsx'
import Macro from './pages/Macro.jsx'
import { useI18n } from './i18n.jsx'

const NAV = [
  { path: '/',         key: 'nav.overview' },
  { path: '/currency', key: 'nav.currency' },
  { path: '/macro',    key: 'nav.macro' },
  { path: '/news',     key: 'nav.news' },
]

export default function App() {
  const { t, lang, setLang } = useI18n()

  const toggleLang = () => {
    setLang(lang === 'en' ? 'es' : 'en')
  }

  return (
    <div className="layout-top">

      {/* DESKTOP TOP BAR */}
      <header className="topbar desktop-only">
        <div className="topbar-inner">

          <nav className="topnav" aria-label="Main navigation">
            {NAV.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  'topnav-link' + (isActive ? ' active' : '')
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>

          {/* Desktop language toggle */}
          <button
            type="button"
            onClick={toggleLang}
            className="lang-toggle"
            aria-label={lang === 'en' ? 'Cambiar a español' : 'Switch to English'}
          >
            {lang === 'en' ? 'ES' : 'EN'}
          </button>

        </div>
      </header>

      {/* MOBILE BOTTOM BAR — restored to original layout */}
      <nav className="bottombar mobile-only" aria-label="Bottom navigation">
        <div className="bottombar-inner">
          {NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                'bottombar-link' + (isActive ? ' active' : '')
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="container main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/currency" element={<Currency />} />
          <Route path="/macro" element={<Macro />} />
          <Route path="/news" element={<News />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        Bolivian Economy Tracker ·{' '}
        <span style={{ color: 'var(--muted)' }}>v1.0</span>
      </footer>

    </div>
  )
}
