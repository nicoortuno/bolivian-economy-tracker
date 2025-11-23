import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend
} from 'chart.js'
import MetricHelp from '../components/MetricHelp.jsx'

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend)

const RAW_CSV_PATH = '/data/bob_p2p_history.csv'

const asNum = (x) => (x === null || x === undefined || x === '' ? null : Number(x))
const fmt   = (x, d=4) => (x === null || x === undefined || isNaN(x) ? '—' : Number(x).toFixed(d))
const pct   = (x, d=2) => (x === null || x === undefined || isNaN(x) ? '—' : (Number(x)*100).toFixed(d) + '%')

function parseTs(ts) {
  if (!ts) return null
  if (ts instanceof Date) return isNaN(ts.getTime()) ? null : ts

  let d = new Date(ts)
  if (!isNaN(d.getTime())) return d

  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(ts))
  if (m) {
    const [, y, mo, da, h, mi, s = '0'] = m
    d = new Date(
      Number(y),
      Number(mo) - 1,
      Number(da),
      Number(h),
      Number(mi),
      Number(s)
    )
    if (!isNaN(d.getTime())) return d
  }

  return null
}

export default function Currency() {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState(null)
  const [range, setRange] = useState('1D')
  const [showHelp, setShowHelp] = useState(false)

  const cacheKey = useMemo(() => Math.floor(Date.now() / (60 * 60 * 1000)), [])
  const CSV_URL = `${RAW_CSV_PATH}?v=${cacheKey}`

  useEffect(() => {
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      downloadRequestHeaders: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      complete: (res) => {
        const parsed = (res.data || []).filter(r => r && r.ts)
        setRows(parsed)
      },
      error: (e) => setErr(e?.message || 'Failed to load CSV'),
    })
  }, [CSV_URL])

  const filtered = useMemo(() => {
    if (!rows.length) return []

    const lastRow = rows[rows.length - 1]
    const lastDate = parseTs(lastRow?.ts)
    if (!lastDate) return []

    const now = lastDate.getTime()

    let cutoffHours = 24
    if (range === '1W') cutoffHours = 24 * 7
    if (range === '1M') cutoffHours = 24 * 30

    const cutoff = now - cutoffHours * 3600 * 1000

    return rows.filter(r => {
      const d = parseTs(r.ts)
      return d && d.getTime() >= cutoff
    })
  }, [rows, range])

  const labels = filtered.map(r => r.ts)
  const latest = filtered.length ? filtered[filtered.length - 1] : null

  const series = useMemo(() => {
    const mid  = filtered.map(r => asNum(r.mid_BOB_per_USDT))
    const bid  = filtered.map(r => asNum(r.best_bid))
    const ask  = filtered.map(r => asNum(r.best_ask))

    const spreadBest = filtered.map(r => asNum(r.spread_pct))
    const effSpread  = filtered.map(r => asNum(r.effective_spread_pct))
    const marketW    = filtered.map(r => asNum(r.market_width_pct))

    const buyC   = filtered.map(r => asNum(r.buy_count))
    const sellC  = filtered.map(r => asNum(r.sell_count))
    const imb    = filtered.map(r => asNum(r.depth_imbalance))

    const vol24 = filtered.map(r => asNum(r.rolling_24h_vol))
    const vol7d = filtered.map(r => asNum(r.rolling_7d_vol))

    return { mid, bid, ask, spreadBest, effSpread, marketW, buyC, sellC, imb, vol24, vol7d }
  }, [filtered])

  function tickLabel(value) {
    const label = labels[value]
    if (!label) return ''

    const d = parseTs(label)
    if (!d) return ''

    if (range === '1D') {
      return String(d.getHours()).padStart(2, '0')
    }
    return String(d.getDate())
  }

  const baseOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: { display: true, labels: { color: '#cfe0f0' } },
      tooltip: { mode: 'index', intersect: false }
    },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        ticks: {
          color:'#9fb0c3',
          maxRotation:0,
          autoSkip:true,
          maxTicksLimit: 6,
          callback: tickLabel,
        },
        grid:{ color:'var(--grid)' }
      },
      y: {
        ticks: { color:'#cfe0f0' },
        grid:{ color:'var(--grid)' },
        beginAtZero:false
      }
    }
  }), [labels, range])

  const priceChart = {
    labels,
    datasets: [
      {
        label: 'Mid (BOB/USDT)',
        data: series.mid,
        borderWidth: 2.2,
        pointRadius: 0,
        tension: 0.25,
        borderColor: '#FFD54F',
        backgroundColor: 'rgba(255, 213, 79, 0.25)',
      },
      {
        label: 'Best Bid',
        data: series.bid,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.25,
        borderDash: [5, 4],
        borderColor: '#4FC3F7'
      },
      {
        label: 'Best Ask',
        data: series.ask,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.25,
        borderDash: [5, 4],
        borderColor: '#F48FB1'
      }
    ]
  }

  const spreadsChart = {
    labels,
    datasets: [
      {
        label: 'Spread % (best)',
        data: series.spreadBest.map(v => v * 100),
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        borderColor: '#4FC3F7',
        backgroundColor: 'rgba(79,195,247,0.2)',
      },
      {
        label: 'Effective Spread %',
        data: series.effSpread.map(v => v * 100),
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        borderColor: '#F48FB1',
        backgroundColor: 'rgba(244,143,177,0.2)',
      },
      ...(series.marketW.some(v => v != null)
        ? [{
            label: 'Market Width %',
            data: series.marketW.map(v => v * 100),
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
            borderColor: '#FFD54F',
            backgroundColor: 'rgba(255,213,79,0.2)',
            borderDash: [6, 4]
          }]
        : [])
    ]
  }

  const liquidityChart = {
    labels,
    datasets: [
      { label: 'Buy Count', data: series.buyC, borderWidth: 2, pointRadius: 0, tension: 0.25, borderColor: '#7aa2ff' },
      { label: 'Sell Count', data: series.sellC, borderWidth: 2, pointRadius: 0, tension: 0.25, borderColor: '#ff92b0' },
      { label: 'Depth Imbalance', data: series.imb, borderWidth: 1.5, pointRadius: 0, tension: 0.25, borderColor: 'var(--accent-4)', yAxisID: 'y1' },
    ]
  }

  const liquidityOptions = {
    ...baseOptions,
    scales: {
      ...baseOptions.scales,
      y:  { ...baseOptions.scales.y, title:{ display:true, text:'Counts', color:'#9fb0c3' } },
      y1: { type:'linear', position:'right', grid:{ drawOnChartArea:false }, ticks:{ color:'#ff87a4' }, title:{ display:true, text:'Imbalance', color:'#ff87a4' }, min:-1, max:1 }
    }
  }

  const volChart = {
    labels,
    datasets: [
      { label: 'Rolling 24h Vol', data: series.vol24, borderWidth: 2, pointRadius: 0, tension: 0.25, borderColor: '#f7d774' },
      { label: 'Rolling 7d Vol', data: series.vol7d, borderWidth: 2, pointRadius: 0, tension: 0.25, borderColor: '#e7a1ff' },
    ]
  }

  return (
    <div className="card">
      <div className="help-row" style={{ alignItems:'center' }}>
        <h2 style={{margin:0}}>Currency (USDT ⇄ BOB)</h2>
      </div>

      <div
        className="currency-range-row"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          gap: 8,
          margin: '12px 0'
        }}
      >
        {['1D','1W','1M'].map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              padding:'6px 12px',
              borderRadius:8,
              border:'1px solid var(--border)',
              background: range === r ? 'var(--accent)' : 'var(--panel)',
              color: range === r ? '#000' : 'var(--text)',
              cursor:'pointer'
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {err && <p style={{color:'var(--accent-4)'}}>Error: {err}</p>}
      {!err && rows.length === 0 && <p>Loading data…</p>}

      {latest && (
        <>
          {/* KPIs */}
          <div className="grid" style={{marginBottom:12}}>
            <div className="kpi">
              <div className="label">Timestamp</div>
              <div className="value mono">{latest.ts}</div>
            </div>
            <div className="kpi">
              <div className="label">Mid</div>
              <div className="value mono">{fmt(latest.mid_BOB_per_USDT, 4)}</div>
            </div>
            <div className="kpi">
              <div className="label">Best Bid / Best Ask</div>
              <div className="value mono">
                {fmt(latest.best_bid,4)} / {fmt(latest.best_ask,4)}
              </div>
            </div>
            <div className="kpi">
              <div className="label">Spread % (best)</div>
              <div className="value mono">{pct(latest.spread_pct, 3)}</div>
            </div>
            <div className="kpi">
              <div className="label">Effective Spread %</div>
              <div className="value mono">{pct(latest.effective_spread_pct, 2)}</div>
            </div>
            <div className="kpi">
              <div className="label">Depth Imbalance</div>
              <div className="value mono">{fmt(latest.depth_imbalance, 3)}</div>
            </div>
            <div className="kpi">
              <div className="label">Median Gap</div>
              <div className="value mono">{fmt(latest.median_gap, 3)}</div>
            </div>
            <div className="kpi">
              <div className="label">Δ Mid (1h)</div>
              <div className="value mono">
                {fmt(latest.mid_change_abs, 4)} ({pct(latest.mid_change_pct, 2)})
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="card"><Line data={priceChart} options={baseOptions} /></div>
          <div className="card"><Line data={spreadsChart} options={baseOptions} /></div>
          <div className="card"><Line data={liquidityChart} options={liquidityOptions} /></div>
          <div className="card"><Line data={volChart} options={baseOptions} /></div>
        </>
      )}
    </div>
  )
}
