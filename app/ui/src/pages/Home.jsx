import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend
} from 'chart.js'

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend)

const RAW_CSV_PATH = '/data/bob_p2p_history.csv'
const FEED_PATH    = '/api/news_latest.json'

const CPI_CSV     = '/data/macro/bcb_inflation_history.csv'
const BM_CSV      = '/data/macro/clean/base_monetaria.csv'
const EXPORTS_CSV = '/data/macro/clean/exports.csv'
const IMPORTS_CSV = '/data/macro/clean/imports.csv'

const asNum = (x) => (x === null || x === undefined || x === '' ? null : Number(x))
const fmt   = (x, d=4) => (x === null || x === undefined || isNaN(x) ? '—' : Number(x).toFixed(d))
const pct   = (x, d=2) => (x === null || x === undefined || isNaN(x) ? '—' : (Number(x)*100).toFixed(d) + '%')

const midFromBA = (r) => {
  const bid = asNum(r?.best_bid)
  const ask = asNum(r?.best_ask)
  return (bid == null || ask == null) ? null : (bid + ask) / 2
}

const pick = (row, candidates) => {
  if (!row) return undefined
  for (const k of candidates) if (k in row) return row[k]
  return undefined
}

function fmtWhen(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  })
}

function parseTsToDate(ts) {
  if (!ts) return null
  const s = String(ts).trim()

  if (/^\d+$/.test(s)) {
    const n = Number(s)
    const d = new Date(n > 1e12 ? n : n * 1000)
    return isNaN(d.getTime()) ? null : d
  }

  let iso = s
  if (s.length === 19 && s.indexOf('T') === -1) {
    iso = s.replace(' ', 'T')
  }

  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

function formatTimeLabel(label) {
  if (!label) return ''

  let d = new Date(label)
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const normalized = label.replace(' ', 'T')
  d = new Date(normalized)
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const parts = label.split(' ')
  const timePart = parts[1] || parts[0] || ''
  return timePart.slice(0, 5)
}


export default function Home() {
  const [rows, setRows] = useState([])
  const [curErr, setCurErr] = useState(null)
  const [news, setNews] = useState([])
  const [newsErr, setNewsErr] = useState(null)
  const [loadingNews, setLoadingNews] = useState(true)

  const [cpi, setCpi]   = useState([])
  const [bm, setBm]     = useState([])
  const [exp, setExp]   = useState([])
  const [imp, setImp]   = useState([])
  const [errCpi, setErrCpi] = useState(null)
  const [errBm,  setErrBm]  = useState(null)
  const [errExp, setErrExp] = useState(null)
  const [errImp, setErrImp] = useState(null)

  const bust = useMemo(() => Math.floor(Date.now() / (60 * 60 * 1000)), [])

  const CSV_URL      = `${RAW_CSV_PATH}?v=${bust}`
  const NEWS_URL     = `${FEED_PATH}?v=${bust}`
  const CPI_URL      = `${CPI_CSV}?v=${bust}`
  const BM_URL       = `${BM_CSV}?v=${bust}`
  const EXPORTS_URL  = `${EXPORTS_CSV}?v=${bust}`
  const IMPORTS_URL  = `${IMPORTS_CSV}?v=${bust}`

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
      error: (e) => setCurErr(e?.message || 'Failed to load currency CSV'),
    })
  }, [CSV_URL])

  async function loadNews() {
    setLoadingNews(true)
    setNewsErr(null)
    try {
      const rsp = await fetch(NEWS_URL, { cache: 'no-store' })
      if (!rsp.ok) throw new Error(`HTTP ${rsp.status}`)
      const data = await rsp.json()
      setNews((data.items || []).slice(0, 6))
    } catch (e) {
      setNewsErr(e?.message || 'Failed to load news')
    } finally {
      setLoadingNews(false)
    }
  }

  useEffect(() => { loadNews() /* eslint-disable-next-line */ }, [])

  useEffect(() => {
    Papa.parse(CPI_URL, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      downloadRequestHeaders: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      complete: (res) => setCpi((res.data || []).filter(r => r?.date)),
      error: (e) => setErrCpi(e?.message || 'Failed to load inflation CSV'),
    })
  }, [CPI_URL])

  useEffect(() => {
    Papa.parse(BM_URL, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      downloadRequestHeaders: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      complete: (res) => setBm((res.data || []).filter(r => r?.date)),
      error: (e) => setErrBm(e?.message || 'Failed to load base_monetaria CSV'),
    })
  }, [BM_URL])

  useEffect(() => {
    Papa.parse(EXPORTS_URL, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      downloadRequestHeaders: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      complete: (res) => setExp((res.data || []).filter(r => r?.date)),
      error: (e) => setErrExp(e?.message || 'Failed to load exports CSV'),
    })
  }, [EXPORTS_URL])

  useEffect(() => {
    Papa.parse(IMPORTS_URL, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      downloadRequestHeaders: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      complete: (res) => setImp((res.data || []).filter(r => r?.date)),
      error: (e) => setErrImp(e?.message || 'Failed to load imports CSV'),
    })
  }, [IMPORTS_URL])

  const latestCPI = cpi.at(-1) || null
  const latestBM  = bm.at(-1)  || null
  const latestExp = exp.at(-1) || null
  const latestImp = imp.at(-1) || null

  const latestInfYoY = latestCPI ? asNum(latestCPI.infl_yoy) : null
  const latestInfMoM = latestCPI ? asNum(latestCPI.infl_mom) : null

  const latestRIN = latestBM
    ? asNum(pick(latestBM, [
        'Reservas Internacionales Netas RIN = RIB - OECP',
        'RIN',
        'Reservas Internacionales Netas (RIN)'
      ]))
    : null

  const latestExportsFOB = latestExp ? asNum(latestExp['FOB']) : null
  const latestImportsFOBAdj = latestImp
    ? asNum(latestImp['TotalImportaciones_FOBAjustado_MillonesUSD'] ?? latestImp['TotalImportaciones_FOB'])
    : null

  const latestTradeBalance =
    (latestExportsFOB != null && latestImportsFOBAdj != null)
      ? latestExportsFOB - latestImportsFOBAdj
      : null

  const lastMacroDate =
    latestExp?.date ||
    latestImp?.date ||
    latestBM?.date ||
    latestCPI?.date ||
    '—'

  const latest = rows.at(-1) || null
  const computedLatestMid = latest ? midFromBA(latest) : null

  const computedMids = rows.map(midFromBA)
  const sparkSlice   = computedMids.slice(-48)
  const sparkRows    = rows.slice(-48)
  const sparkLabels  = sparkRows.map(r => r.ts)

  const validPairs = sparkSlice
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v != null)

  const minPair = validPairs.length ? validPairs.reduce((a, b) => (b.v < a.v ? b : a)) : null
  const maxPair = validPairs.length ? validPairs.reduce((a, b) => (b.v > a.v ? b : a)) : null

  const lastMid  = computedMids.at(-1)
  const prevMid  = computedMids.at(-2)
  const dAbs     = (lastMid != null && prevMid != null) ? (lastMid - prevMid) : null
  const dPct     = (lastMid != null && prevMid != null && prevMid !== 0) ? (lastMid - prevMid) / prevMid : null

  const sparkData = {
    labels: sparkLabels,
    datasets: [
      {
        label: 'Mid = (Bid + Ask)/2',
        data: sparkSlice,
        borderWidth: 2.4,
        pointRadius: 0,
        tension: 0.28,
        borderColor: '#FFD54F',
        backgroundColor: 'rgba(255,213,79,0.12)',
        fill: true,
      }
    ]
  }

  const annotateSpark = {
    id: 'annotateSpark',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart
      const { left, right, top, bottom } = chartArea
      const x = scales.x
      const y = scales.y
      ctx.save()

      try {
        const cssGrid = getComputedStyle(document.documentElement).getPropertyValue('--grid') || '#1c2733'
        ctx.strokeStyle = cssGrid.trim() || '#1c2733'
      } catch {
        ctx.strokeStyle = '#1c2733'
      }
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.6
      const gridLines = 3
      for (let i = 1; i <= gridLines; i++) {
        const gy = top + (i * (bottom - top)) / (gridLines + 1)
        ctx.beginPath()
        ctx.moveTo(left, gy)
        ctx.lineTo(right, gy)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      const labelBg = 'rgba(15, 21, 29, 0.9)'
      const labelText = '#cfe0f0'
      ctx.font = '12px Inter, system-ui, sans-serif'

      function drawDotLabel(pair, placeAbove) {
        if (!pair) return
        const xi = pair.i
        const xv = x.getPixelForValue(x.getLabels()[xi])
        const yv = y.getPixelForValue(pair.v)

        ctx.fillStyle = '#FFD54F'
        ctx.beginPath()
        ctx.arc(xv, yv, 3.5, 0, Math.PI * 2)
        ctx.fill()

        const text = `${fmt(pair.v, 4)}`
        const padX = 6
        const h = 18
        const w = ctx.measureText(text).width + padX * 2
        const bx = Math.min(Math.max(xv - w / 2, left), right - w)
        const by = Math.max(top + 2, placeAbove ? (yv - h - 8) : (yv + 8))

        ctx.fillStyle = labelBg
        ctx.fillRect(bx, by, w, h)
        ctx.strokeStyle = 'rgba(255,213,79,0.35)'
        ctx.strokeRect(bx, by, w, h)

        ctx.fillStyle = labelText
        ctx.fillText(text, bx + padX, by + h - 5)
      }

      drawDotLabel(minPair, true)
      drawDotLabel(maxPair, false)

      const lastIndex = x.getLabels().length - 1
      const lastX = x.getPixelForValue(x.getLabels()[lastIndex])
      const lastY = (lastMid != null) ? y.getPixelForValue(lastMid) : null
      if (lastY != null) {
        ctx.fillStyle = '#FFD54F'
        ctx.beginPath()
        ctx.arc(lastX, lastY, 4.5, 0, Math.PI * 2)
        ctx.fill()

        const text = `${fmt(lastMid, 4)}`
        ctx.font = '13px Inter, system-ui, sans-serif'
        const padX = 8
        const h = 20
        const w = ctx.measureText(text).width + padX * 2
        const bx = Math.min(right - w, lastX + 10)
        const by = Math.max(top + 2, Math.min(bottom - h - 2, lastY - h / 2))

        ctx.fillStyle = labelBg
        ctx.fillRect(bx, by, w, h)
        ctx.strokeStyle = 'rgba(255,213,79,0.45)'
        ctx.strokeRect(bx, by, w, h)
        ctx.fillStyle = labelText
        ctx.fillText(text, bx + padX, by + h - 6)
      }

      ctx.restore()
    }
  }

  const ymin = Math.min(...sparkSlice.filter(v => v != null))
  const ymax = Math.max(...sparkSlice.filter(v => v != null))

  const sparkOptions = {
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx) => ` ${fmt(ctx.parsed.y, 4)} BOB/USDT`,
        },
      },
    },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        display: true,
        ticks: {
          color: '#9fb0c3',
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
          callback: (value) => {
            const label = sparkLabels[value]
            return formatTimeLabel(label)
          },
        },
        grid: { color: 'var(--grid)' },
        title: { display: true, text: 'Time (local)', color: '#9fb0c3', font: { size: 12 } },
      },
      y: {
        display: true,
        ticks: {
          color: '#cfe0f0',
          maxTicksLimit: 6,
          callback: (val) => fmt(val, 2),
        },
        grid: { color: 'var(--grid)' },
        title: { display: true, text: 'BOB / USDT', color: '#9fb0c3', font: { size: 12 } },
        suggestedMin: ymin * 0.995,
        suggestedMax: ymax * 1.005,
      },
    },
  }

  return (
    <div className="card">
      <div className="help-row" style={{ alignItems:'center', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Economic Overview</h2>
      </div>

      {lastMacroDate !== '—' && (
        <p className="tip" style={{ marginTop: 4, marginBottom: 12 }}>
          Latest macro datapoint: <span className="mono">{lastMacroDate}</span>
        </p>
      )}

      {errCpi && <p style={{color:'var(--accent-4)'}}>CPI error: {errCpi}</p>}
      {errBm  && <p style={{color:'var(--accent-4)'}}>BM error: {errBm}</p>}
      {errExp && <p style={{color:'var(--accent-4)'}}>Exports error: {errExp}</p>}
      {errImp && <p style={{color:'var(--accent-4)'}}>Imports error: {errImp}</p>}

      {(latestCPI || latestBM || latestExp || latestImp) && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="help-row" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Key Macro Indicators</h3>
          </div>
          <div className="grid">
            <div className="kpi">
              <div className="label">Inflation YoY</div>
              <div className="value mono">{pct(latestInfYoY, 2)}</div>
            </div>
            <div className="kpi">
              <div className="label">Inflation MoM</div>
              <div className="value mono">{pct(latestInfMoM, 2)}</div>
            </div>
            <div className="kpi">
              <div className="label">Net Reserves (BOB Thousands)</div>
              <div className="value mono">{fmt(latestRIN, 2)}</div>
            </div>
            <div className="kpi">
              <div className="label">Trade Balance (USD Millions)</div>
              <div className="value mono">{fmt(latestTradeBalance, 2)}</div>
            </div>
          </div>
        </div>
      )}

      {/* --- Currency snapshot --- */}
      <div className="card" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="help-row" style={{marginBottom:12}}>
          <h3 style={{margin:0}}>Currency Snapshot — Binance P2P</h3>
          {latest && <span className="tip">Last update: <span className="mono">{latest.ts}</span></span>}
        </div>

        {curErr && <p style={{color:'var(--accent-4)'}}>Error: {curErr}</p>}
        {!curErr && !latest && <p>Loading latest price…</p>}

        {latest && (
          <>
            <div className="grid" style={{ marginBottom: 12 }}>
              <div className="kpi">
                <div className="label">Bid/Ask average</div>
                <div className="value mono">{fmt(computedLatestMid, 4)}</div>
              </div>

              <div className="kpi">
                <div className="label">Best Bid / Best Ask</div>
                <div className="value mono">
                  {fmt(latest.best_bid,4)} / {fmt(latest.best_ask,4)}
                </div>
              </div>

              <div className="kpi">
                <div className="label">Spread %</div>
                <div className="value mono">{pct(latest.spread_pct, 3)}</div>
              </div>

              <div className="kpi">
                <div className="label">Δ Mid</div>
                <div className="value mono">
                  {fmt(dAbs, 4)} ({pct(dPct, 2)})
                </div>
              </div>
            </div>

            <div className="card" style={{ paddingTop: 8, paddingBottom: 8 }}>
              <Line data={sparkData} options={sparkOptions} plugins={[annotateSpark]} />
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="help-row" style={{ alignItems:'center', gap: 8 }}>
          <h3 style={{margin:0}}>Economic News — Latest 6</h3>
          <span className="tip">From El Deber (Economía) summaries</span>
        </div>

        {newsErr && <p style={{color:'var(--accent-4)'}}>Error: {newsErr}</p>}
        {!newsErr && loadingNews && <p>Loading news…</p>}
        {!newsErr && !loadingNews && news.length === 0 && <p>No summaries yet for today.</p>}

        {news.length > 0 && (
          <div className="summary-list">
            {news.map((it, i) => {
              const when = it.published_at_bo || it.published_at_utc || it.fetched_at_utc
              return (
                <article key={i} className="summary-card" style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 12,
                  background: 'var(--card)'
                }}>
                  <h3 style={{ margin: '0 0 6px' }}>
                    <a href={it.url} target="_blank" rel="noopener noreferrer">
                      {it.title || '(sin título)'}
                    </a>
                  </h3>
                  <div className="meta" style={{ fontSize: '.9rem', color: 'var(--muted)', marginBottom: 6 }}>
                    <strong>{it.source || '—'}</strong> · {fmtWhen(when)} {it.published_at_bo ? 'BOT' : ''}
                    {it.sentiment ? ` · ${String(it.sentiment).toUpperCase()}` : ''}
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.45 }}>
                    {it.summary}
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
