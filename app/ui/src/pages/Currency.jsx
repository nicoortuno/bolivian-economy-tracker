import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend
} from 'chart.js'

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend)

const CSV_URL = '/data/bob_p2p_history.csv'

const asNum = (x) => (x === null || x === undefined || x === '' ? null : Number(x))
const fmt = (x, d=4) => (x === null || x === undefined ? '—' : Number(x).toFixed(d))
const pct = (x, d=2) => (x === null || x === undefined ? '—' : (Number(x)*100).toFixed(d) + '%')

export default function Currency() {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState(null)

  useEffect(() => {
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (res) => {
        const clean = (res.data || []).filter(r => r && r.ts)
        setRows(clean)
      },
      error: (e) => setErr(e?.message || 'Failed to load CSV'),
    })
  }, [])

  const latest = rows.length ? rows[rows.length - 1] : null

  const chartData = useMemo(() => {
    if (!rows.length) return { labels: [], datasets: [] }

    const labels = rows.map(r => r.ts)

    const mid = rows.map(r => asNum(r.mid_BOB_per_USDT))
    const bid = rows.map(r => asNum(r.best_bid))
    const ask = rows.map(r => asNum(r.best_ask))

    return {
      labels,
      datasets: [
        { label: 'Mid (BOB/USDT)', data: mid, borderWidth: 2, pointRadius: 0, tension: 0.2 },
        { label: 'Best Bid', data: bid, borderWidth: 1, pointRadius: 0, borderDash: [4,3], tension: 0.2 },
        { label: 'Best Ask', data: ask, borderWidth: 1, pointRadius: 0, borderDash: [4,3], tension: 0.2 },
      ]
    }
  }, [rows])

  const chartOptions = {
    responsive: true,
    plugins: { legend: { display: true }, tooltip: { mode: 'index', intersect: false } },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      y: { beginAtZero: false }
    }
  }

  return (
    <div className="card">
      <h2>Currency — Binance P2P (USDT ⇄ BOB)</h2>
      {err && <p style={{color:'crimson'}}>{err}</p>}
      {!latest && !err && <p>Loading…</p>}

      {latest && (
        <>
          <div className="grid">
            <div className="kpi">
              <div className="label">Timestamp</div>
              <div className="value mono">{latest.ts}</div>
            </div>

            <div className="kpi">
              <div className="label">Mid</div>
              <div className="value">{fmt(latest.mid_BOB_per_USDT, 4)}</div>
            </div>

            <div className="kpi">
              <div className="label">Best Bid / Best Ask</div>
              <div className="value">{fmt(latest.best_bid, 4)} / {fmt(latest.best_ask, 4)}</div>
            </div>

            <div className="kpi">
              <div className="label">Spread % (best)</div>
              <div className="value">{pct(latest.spread_pct, 3)}</div>
            </div>

            <div className="kpi">
              <div className="label">Effective Spread %</div>
              <div className="value">{pct(latest.effective_spread_pct, 2)}</div>
            </div>

            <div className="kpi">
              <div className="label">Depth Imbalance</div>
              <div className="value">{fmt(latest.depth_imbalance, 3)}</div>
            </div>

            <div className="kpi">
              <div className="label">Median Gap</div>
              <div className="value">{fmt(latest.median_gap, 3)}</div>
            </div>

            <div className="kpi">
              <div className="label">Δ Mid (1h)</div>
              <div className="value">
                {fmt(latest.mid_change_abs, 4)} ({pct(latest.mid_change_pct, 2)})
              </div>
            </div>
          </div>

          <div className="card">
            <Line data={chartData} options={chartOptions} />
          </div>
        </>
      )}
    </div>
  )
}

