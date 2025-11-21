import { NavLink, Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Currency from './pages/Currency.jsx'
import News from './pages/News.jsx'
import Macro from './pages/Macro.jsx'

const NAV = [
  { path: '/',         label: 'Overview' },
  { path: '/currency', label: 'Currency' },
  { path: '/macro',    label: 'Macro' },
  { path: '/news',     label: 'News' },
]

export default function App() {
  return (
    <div className="layout-top">
      <header className="topbar desktop-only">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            Bolivian Economy Tracker
          </NavLink>

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
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

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
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="container main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/currency" element={<Currency />} />
          <Route path="/macro" element={<Macro />} />
          <Route path="/news" element={<News />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      <footer className="footer">
        Bolivian Economy Tracker ·{' '}
        <span style={{ color: 'var(--muted)' }}>v1.0</span>
      </footer>
    </div>
  )
}
