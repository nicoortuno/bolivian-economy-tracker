import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Filler
} from 'chart.js'

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Filler)

const CPI_CSV = '/data/macro/bcb_inflation_history.csv'
const BM_CSV  = '/data/macro/clean/base_monetaria.csv'

const asNum = (x) => (x === null || x === undefined || x === '' ? null : Number(x))
const fmt   = (x, d=2) => (x === null || x === undefined || isNaN(x) ? '—' : Number(x).toFixed(d))
const pct   = (x, d=2) => (x === null || x === undefined || isNaN(x) ? '—' : (Number(x)*100).toFixed(d) + '%')

const pick = (row, candidates) => {
  for (const k of candidates) if (k in row) return row[k]
  return undefined
}
const hasSeries = (arr) => Array.isArray(arr) && arr.some(v => v !== null && v !== undefined && !Number.isNaN(v))

const useCss = () => {
  try {
    const css = getComputedStyle(document.documentElement)
    return {
      text:   (css.getPropertyValue('--text')||'#e8edf3').trim(),
      muted:  (css.getPropertyValue('--muted')||'#9fb0c3').trim(),
      accent: (css.getPropertyValue('--accent')||'#5dd0ff').trim(),
      acc2:   (css.getPropertyValue('--accent-2')||'#23d18b').trim(),
      acc3:   (css.getPropertyValue('--accent-3')||'#ffb454').trim(),
      acc4:   (css.getPropertyValue('--accent-4')||'#ff5c8a').trim(),
      grid:   (css.getPropertyValue('--grid')||'#1c2733').trim(),
    }
  } catch {
    return { text:'#e8edf3', muted:'#9fb0c3', accent:'#5dd0ff', acc2:'#23d18b', acc3:'#ffb454', acc4:'#ff5c8a', grid:'#1c2733' }
  }
}

export default function Macro() {
  const [bm, setBm] = useState([])
  const [cpi, setCpi] = useState([])
  const [errBm, setErrBm] = useState(null)
  const [errCpi, setErrCpi] = useState(null)

  const c = useCss()

  const cacheKey = useMemo(() => Math.floor(Date.now() / (60 * 60 * 1000)), [])
  const CPI_URL = `${CPI_CSV}?v=${cacheKey}`
  const BM_URL  = `${BM_CSV}?v=${cacheKey}`

  useEffect(() => {
    Papa.parse(CPI_URL, {
      download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      downloadRequestHeaders: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      complete: (res) => setCpi((res.data||[]).filter(r => r?.date)),
      error: (e) => setErrCpi(e?.message || 'Failed to load inflation CSV')
    })
  }, [CPI_URL])

  useEffect(() => {
    Papa.parse(BM_URL, {
      download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      downloadRequestHeaders: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      complete: (res) => setBm((res.data||[]).filter(r => r?.date)),
      error: (e) => setErrBm(e?.message || 'Failed to load base_monetaria CSV')
    })
  }, [BM_URL])

  const cpiDates = useMemo(() => cpi.map(r => r.date), [cpi])

  const infl_mom = useMemo(() => cpi.map(r => asNum(r.infl_mom)), [cpi])
  const infl_yoy = useMemo(() => cpi.map(r => asNum(r.infl_yoy)), [cpi])
  const infl_ytd = useMemo(() => cpi.map(r => asNum(r.infl_ytd)), [cpi])

  const ipc2016 = useMemo(() => cpi.map(r => asNum(r.ipc_base2016)), [cpi])
  const ipc2007 = useMemo(() => cpi.map(r => asNum(r.ipc_base2007)), [cpi])
  const ipcMixed = useMemo(
    () => cpi.map(r => {
      const v2016 = r?.ipc_base2016
      const v2007 = r?.ipc_base2007
      return asNum(v2016 ?? v2007 ?? null)
    }),
    [cpi]
  )

  const latestCPI = cpi.at(-1) || null
  const latestIPC = latestCPI
    ? (asNum(latestCPI.ipc_base2016) ?? asNum(latestCPI.ipc_base2007) ?? null)
    : null

  const bmDates = useMemo(() => bm.map(r => r.date), [bm])

  const RIN  = useMemo(() => bm.map(r => asNum(pick(r, [
    'Reservas Internacionales Netas RIN = RIB - OECP', 'RIN', 'Reservas Internacionales Netas (RIN)'
  ]))), [bm])

  const RIB  = useMemo(() => bm.map(r => asNum(pick(r, [
    'Reservas Internacionales Brutas RIB', 'RIB', 'Reservas Internacionales Brutas (RIB)'
  ]))), [bm])

  const OECP = useMemo(() => bm.map(r => asNum(pick(r, [
    'Obligaciones con el exterior a corto plazo OECP', 'OECP', 'Obligaciones con el exterior a corto plazo (OECP)'
  ]))), [bm])

  const CNSP = useMemo(() => bm.map(r => asNum(pick(r, [
    'Crédito Neto al Sector Público CNSP', 'CNSP', 'Crédito Neto al Sector Público'
  ]))), [bm])

  const BM_TOT = useMemo(() => bm.map(r => asNum(pick(r, ['BASE MONETARIA BM','Base Monetaria','BM']))), [bm])

  const CASH_PUB = useMemo(() => bm.map(r => asNum(pick(r, [
    'Billetes y Mo- nedas en Poder del Público C',
    'Billetes y Monedas en Poder del Público C',
    'Billetes y Monedas en Poder del Público',
    'Billetes y monedas en poder del público'
  ]))), [bm])

  const MN   = useMemo(() => bm.map(r => asNum(pick(r, ['MN','Moneda Nacional (MN)','Moneda Nacional']))), [bm])
  const UFV  = useMemo(() => bm.map(r => asNum(pick(r, ['UFV']))), [bm])
  const ME   = useMemo(() => bm.map(r => asNum(pick(r, ['ME','Moneda Extranjera (ME)','Moneda Extranjera']))), [bm])
  const TOTAL_any = useMemo(() => bm.map(r => asNum(pick(r, ['TOTAL','Total']))), [bm])

  const latestBM = bm.at(-1) || null

  const lastDate = latestBM?.date || latestCPI?.date || '—'

const baseOpts = (xtitle, ytitle, isPct=false) => ({
    responsive: true,
    maintainAspectRatio: true,  
    aspectRatio: 2,            
    plugins: {
      legend: { display: true, labels: { color: c.muted }},
      tooltip: {
        mode: 'index', intersect: false,
        callbacks: {
          label: (ctx) => {
            const y = ctx.parsed.y;
            return ` ${ctx.dataset.label}: ${isPct ? (y==null?'—':(y*100).toFixed(2)+'%') : fmt(y, 2)}`;
          }
        }
      }
    },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        ticks: { color: c.muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        grid: { color: c.grid }, title: { display: true, text: xtitle, color: c.muted, font:{size:12} }
      },
      y: {
        ticks: {
          color: c.text,
          callback: (v)=> isPct ? `${(v*100).toFixed(1)}%` : fmt(v,2),
          maxTicksLimit: 6
        },
        grid: { color: c.grid },
        title: { display: true, text: ytitle, color: c.muted, font:{size:12} }
      }
    }
  });
  

  const cpiYoY = {
    labels: cpiDates,
    datasets: [
      { label:'Inflation YoY', data: infl_yoy, borderWidth:2, pointRadius:0, tension:.25, borderColor:c.acc4, fill:false }
    ]
  }
  const cpiMoM_YTD = {
    labels: cpiDates,
    datasets: [
      { label:'Inflation MoM', data: infl_mom, borderWidth:2, pointRadius:0, tension:.25, borderColor:c.accent, fill:false },
      { label:'Inflation YTD', data: infl_ytd, borderWidth:2, pointRadius:0, tension:.25, borderColor:c.acc3, fill:false }
    ]
  }
  const ipcBothBases = {
    labels: cpiDates,
    datasets: [
      { label:'CPI (base 2016)', data: ipc2016, borderWidth:2, pointRadius:0, tension:.25, borderColor:c.acc2, backgroundColor:'rgba(35,209,139,0.10)', fill:true },
      { label:'CPI (base 2007)', data: ipc2007, borderWidth:2, pointRadius:0, tension:.25, borderColor:c.muted, fill:false }
    ]
  }
  const reservesData = {
    labels: bmDates,
    datasets: [
      { label: 'Gross Reserves (RIB)', data: RIB,  borderWidth: 2, pointRadius: 0, tension: .25, borderColor: c.accent, fill:false },
      { label: 'Net Reserves (RIN)',   data: RIN,  borderWidth: 2, pointRadius: 0, tension: .25, borderColor: c.acc2, fill:false },
      { label: 'Short-term External Liab. (OECP)', data: OECP, borderWidth: 2, pointRadius: 0, tension: .25, borderColor: c.acc4, fill:false },
    ]
  }
  const cnspData = {
    labels: bmDates,
    datasets: [
      { label: 'Net Credit to Public Sector (CNSP)', data: CNSP, borderWidth: 2, pointRadius: 0, tension: .25, borderColor: c.acc3, fill:false },
    ]
  }
  const bmData = {
    labels: bmDates,
    datasets: [
      { label: 'Monetary Base (BM)', data: BM_TOT, borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.acc3, backgroundColor:'rgba(255,180,84,0.10)', fill:true },
      { label: 'Cash in Public Hands', data: CASH_PUB, borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.accent, fill:false },
    ]
  }
  const compData = {
    labels: bmDates,
    datasets: [
      { label: 'Local Currency (MN)',  data: MN,  borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.accent, fill:false },
      { label: 'UFV',                  data: UFV, borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.acc2,   fill:false },
      { label: 'Foreign Currency (ME)',data: ME,  borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.acc4,   fill:false },
    ]
  }
  const totalData = {
    labels: bmDates,
    datasets: [
      { label: 'TOTAL (if present)', data: TOTAL_any, borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.text, fill:false },
    ]
  }

  const canRender = (data) =>
    Array.isArray(data?.labels) &&
    data.labels.length > 0 &&
    Array.isArray(data?.datasets) &&
    data.datasets.some(ds => hasSeries(ds.data))

  return (
    <div className="card">
      <div className="help-row" style={{alignItems:'center', gap:8}}>
        <h2 style={{margin:0}}>Macro Dashboard</h2>
        <span className="tip">Latest date across series: <span className="mono">{lastDate}</span></span>
      </div>

      {errCpi && <p style={{color:'var(--accent-4)'}}>CPI error: {errCpi}</p>}
      {errBm  && <p style={{color:'var(--accent-4)'}}>BM error: {errBm}</p>}

      {(latestCPI || latestBM) && (
        <div className="grid" style={{marginBottom:12}}>
          {latestCPI && (
            <>
              <div className="kpi">
                <div className="label">CPI — Date</div>
                <div className="value mono">{latestCPI.date}</div>
              </div>
              <div className="kpi">
                <div className="label">Inflation YoY</div>
                <div className="value mono">{pct(latestCPI.infl_yoy, 2)}</div>
              </div>
              <div className="kpi">
                <div className="label">Inflation MoM</div>
                <div className="value mono">{pct(latestCPI.infl_mom, 2)}</div>
              </div>
              <div className="kpi">
                <div className="label">Inflation YTD</div>
                <div className="value mono">{pct(latestCPI.infl_ytd, 2)}</div>
              </div>
              <div className="kpi">
                <div className="label">CPI Level</div>
                <div className="value mono">{fmt(latestIPC, 2)}</div>
                <div className="sub">{asNum(latestCPI.ipc_base2016)!=null ? 'Base 2016' : (asNum(latestCPI.ipc_base2007)!=null ? 'Base 2007' : '')}</div>
              </div>
            </>
          )}

          {latestBM && (
            <>
              <div className="kpi">
                <div className="label">BM — Date</div>
                <div className="value mono">{latestBM.date}</div>
              </div>
              <div className="kpi">
                <div className="label">Monetary Base (BM)</div>
                <div className="value mono">{fmt(pick(latestBM, ['BASE MONETARIA BM','Base Monetaria','BM']))}</div>
              </div>
              <div className="kpi">
                <div className="label">Gross Reserves (RIB)</div>
                <div className="value mono">{fmt(pick(latestBM, ['Reservas Internacionales Brutas RIB','RIB','Reservas Internacionales Brutas (RIB)']))}</div>
              </div>
              <div className="kpi">
                <div className="label">Net Reserves (RIN)</div>
                <div className="value mono">{fmt(pick(latestBM, ['Reservas Internacionales Netas RIN = RIB - OECP','RIN','Reservas Internacionales Netas (RIN)']))}</div>
              </div>
              <div className="kpi">
                <div className="label">Short-term Ext. Liab. (OECP)</div>
                <div className="value mono">{fmt(pick(latestBM, ['Obligaciones con el exterior a corto plazo OECP','OECP','Obligaciones con el exterior a corto plazo (OECP)']))}</div>
              </div>
            </>
          )}
        </div>
      )}


      {/* CPI */}
      {canRender(cpiYoY) && (
        <div className="card">
          <div className="help-row" style={{marginBottom:8}}>
            <h3 style={{margin:0}}>Inflation — Year over Year</h3>
            <span className="tip">12-month rate</span>
          </div>
          <Line data={cpiYoY} options={baseOpts('Date', 'Change (%)', true)} />
        </div>
      )}

      {canRender(cpiMoM_YTD) && (
        <div className="card">
          <div className="help-row" style={{marginBottom:8}}>
            <h3 style={{margin:0}}>Inflation — Monthly & Year-to-Date</h3>
            <span className="tip">Monthly change and cumulative year</span>
          </div>
          <Line data={cpiMoM_YTD} options={baseOpts('Date', 'Change (%)', true)} />
        </div>
      )}

      {canRender(ipcBothBases) && (
        <div className="card">
          <div className="help-row" style={{marginBottom:8}}>
            <h3 style={{margin:0}}>Consumer Price Index (Levels)</h3>
            <span className="tip">Base 2016 (post-2016) and Base 2007 (pre-2016)</span>
          </div>
          <Line data={ipcBothBases} options={baseOpts('Date', 'Index level')} />
        </div>
      )}

      {/* Reserves */}
      {canRender(reservesData) && (
        <div className="card">
          <div className="help-row" style={{marginBottom:8}}>
            <h3 style={{margin:0}}>International Reserves & Short-term Liabilities</h3>
            <span className="tip">RIB, RIN, OECP</span>
          </div>
          <Line data={reservesData} options={baseOpts('Date', 'Millions (source units)')} />
        </div>
      )}

      {/* CNSP */}
      {canRender(cnspData) && (
        <div className="card">
          <div className="help-row" style={{marginBottom:8}}>
            <h3 style={{margin:0}}>Net Credit to Public Sector (CNSP)</h3>
            <span className="tip">Time series</span>
          </div>
          <Line data={cnspData} options={baseOpts('Date', 'Millions (source units)')} />
        </div>
      )}

      {/* Base Monetaria & Cash */}
      {canRender(bmData) && (
        <div className="card">
          <div className="help-row" style={{marginBottom:8}}>
            <h3 style={{margin:0}}>Monetary Base & Cash in Public Hands</h3>
            <span className="tip">BM total vs. cash held by the public</span>
          </div>
          <Line data={bmData} options={baseOpts('Date', 'Millions (source units)')} />
        </div>
      )}

      {/* Currency composition */}
      {canRender(compData) && (
        <div className="card">
          <div className="help-row" style={{marginBottom:8}}>
            <h3 style={{margin:0}}>Currency Composition — MN / UFV / ME</h3>
            <span className="tip">Breakout by currency type</span>
          </div>
          <Line data={compData} options={baseOpts('Date', 'Millions (source units)')} />
        </div>
      )}

      {/* TOTAL (if exists) */}
      {canRender(totalData) && (
        <div className="card">
          <div className="help-row" style={{marginBottom:8}}>
            <h3 style={{margin:0}}>TOTAL (if present)</h3>
            <span className="tip">Direct “TOTAL” column</span>
          </div>
          <Line data={totalData} options={baseOpts('Date', 'Millions (source units)')} />
        </div>
      )}

      {/* Empty state if nothing rendered and no errors */}
      {!errBm && !errCpi &&
        ![
          cpiYoY, cpiMoM_YTD, ipcBothBases, reservesData, cnspData, bmData, compData, totalData
        ].some(canRender) && (
          <p>No data available to render charts.</p>
      )}
    </div>
  )
}
