import { useState } from 'react'
import Home from './pages/Home.jsx'
import Currency from './pages/Currency.jsx'
import News from './pages/News.jsx'

export default function App() {
  const [tab, setTab] = useState('home')

  return (
    <>
      <div className="header">
        <div className="brand" style={{color:'var(--accent)'}}>Bolivian Economy Tracker</div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab==='home'?'active':''}`} onClick={()=>setTab('home')}>Home</button>
        <button className={`tab ${tab==='currency'?'active':''}`} onClick={()=>setTab('currency')}>Currency</button>
        <button className={`tab ${tab==='news'?'active':''}`} onClick={()=>setTab('news')}>News</button> {/* ← new */}
      </div>

      <div className="container">
        {tab === 'home' ? <Home/>
          : tab === 'currency' ? <Currency/>
          : <News/>} {/* ← render News */}
        <div className="footer">v0.1 — hourly data from Binance P2P (USDT/BOB)</div>
      </div>
    </>
  )
}
