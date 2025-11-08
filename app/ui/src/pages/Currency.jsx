import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, TimeScale
} from 'chart.js'

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend)

const CSV_URL = '/data/bob_p2p_history.csv'

export default function Currency() {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState(null)

  useEffect(() => {
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      dynamicTyping: true,
      complete: (res) => setRows(res.data.filter(Boolean)),
      error: (e) => setErr(e?.message || 'Failed to load CSV'),
      skipEmptyLines: true
    })
  }, [])

  const latest = rows.length ? rows[rows.length - 1] : null

  const chartData = useMemo(() => {
    const labels = rows.map(r => r.timestamp)
    const mid = rows.map(r => r.mid)
    return {
      labels,
      datasets: [
        { label: 'Mid (BOB per USDT)', data: mid, tension: 0.2, borderWidth: 2, pointRadius: 0 }
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
    <>
      <div className="card">
        <h2>Currency — Binance P2P (USDT/BOB)</h2>
        {err && <p style={{color:'crimson'}}>{err}</p>}
        {!latest && !err && <p>Loading…</p>}

        {latest && (
          <>
            <div className="grid">
              <div className="kpi">
                <div className="label">Timestamp</div>
                <div className="value mono">{latest.timestamp}</div>
              </div>
              <div className="kpi">
                <div className="label">Mid</div>
                <div className="value">{latest.mid}</div>
              </div>
              <div className="kpi">
                <div className="label">Buy / Sell (median)</div>
                <div className="value">{latest.buy_median} / {latest.sell_median}</div>
              </div>
            </div>

            <div className="card">
              <Line data={chartData} options={chartOptions} />
            </div>
          </>
        )}
      </div>
    </>
  )
}
