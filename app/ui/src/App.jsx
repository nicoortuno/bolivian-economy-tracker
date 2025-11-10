import { useState } from 'react'
import Home from './pages/Home.jsx'
import Currency from './pages/Currency.jsx'
import News from './pages/News.jsx'

export default function App() {
  const [tab, setTab] = useState('home')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="header">
        <div className="brand">Bolivian Economy Tracker</div>
      </header>

      <div className="tabs">
        <button className={`tab ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>Home</button>
        <button className={`tab ${tab === 'currency' ? 'active' : ''}`} onClick={() => setTab('currency')}>Currency</button>
        <button className={`tab ${tab === 'news' ? 'active' : ''}`} onClick={() => setTab('news')}>News</button>
      </div>

      <main className="container" style={{ flex: 1 }}>
        {tab === 'home' && <Home />}
        {tab === 'currency' && <Currency />}
        {tab === 'news' && <News />}
      </main>

      <footer className="footer">
        Bolivian Economy Tracker · <span style={{ color: 'var(--muted)' }}>v1.0</span>
      </footer>
    </div>
  )
}
