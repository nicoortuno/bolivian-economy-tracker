import { useState } from 'react'
import Home from './pages/Home.jsx'
import Currency from './pages/Currency.jsx'

export default function App() {
  const [tab, setTab] = useState('home')

  return (
    <>
      <div className="header">
        <div className="brand">Bolivian Economy Tracker</div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab==='home'?'active':''}`} onClick={()=>setTab('home')}>Home</button>
        <button className={`tab ${tab==='currency'?'active':''}`} onClick={()=>setTab('currency')}>Currency</button>
      </div>

      <div className="container">
        {tab === 'home' ? <Home/> : <Currency/>}
        <div className="footer">v0.1 — hourly data from Binance P2P (USDT/BOB)</div>
      </div>
    </>
  )
}
