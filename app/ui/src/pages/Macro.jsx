import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Filler
} from 'chart.js'

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Filler)

const CPI_CSV     = '/data/macro/bcb_inflation_history.csv'
const BM_CSV      = '/data/macro/clean/base_monetaria.csv'
const EXPORTS_CSV = '/data/macro/clean/exports.csv'
const IMPORTS_CSV = '/data/macro/clean/imports.csv'

const asNum = (x) => (x === null || x === undefined || x === '' ? null : Number(x))
const fmt   = (x, d=2) => (x === null || x === undefined || isNaN(x) ? '—' : Number(x).toFixed(d))
const pct   = (x, d=2) => (x === null || x === undefined || isNaN(x) ? '—' : (Number(x)*100).toFixed(d) + '%')

const pick = (row, candidates) => {
  if (!row) return undefined
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


const parseIsoDate = (s) => {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function applyRange(labels, datasets, range) {
  if (!Array.isArray(labels) || !Array.isArray(datasets) || range === 'ALL') {
    return { labels, datasets }
  }

  let lastIdx = labels.length - 1
  while (lastIdx >= 0 && !labels[lastIdx]) lastIdx--
  if (lastIdx < 0) return { labels, datasets }

  const lastDate = parseIsoDate(labels[lastIdx])
  if (!lastDate) return { labels, datasets }

  let startDate
  if (range === 'YTD') {
    startDate = new Date(lastDate.getFullYear(), 0, 1)
  } else if (range === '5Y') {
    startDate = new Date(lastDate.getFullYear() - 5, lastDate.getMonth(), 1)
  } else if (range === '10Y') {
    startDate = new Date(lastDate.getFullYear() - 10, lastDate.getMonth(), 1)
  } else {
    return { labels, datasets }
  }

  const newLabels = []
  const newDataArrays = datasets.map(() => [])

  for (let i = 0; i < labels.length; i++) {
    const d = parseIsoDate(labels[i])
    if (!d) continue
    if (d < startDate) continue

    newLabels.push(labels[i])
    datasets.forEach((ds, idx) => {
      const v = Array.isArray(ds.data) ? ds.data[i] : null
      newDataArrays[idx].push(v)
    })
  }

  const newDatasets = datasets.map((ds, idx) => ({
    ...ds,
    data: newDataArrays[idx]
  }))

  return { labels: newLabels, datasets: newDatasets }
}

const baseOpts = (xtitle, ytitle, isPct=false) => {
  const c = useCss()
  return {
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
        ticks: {
          color: c.muted,
          maxRotation: 0,
          autoSkip: true,
          autoSkipPadding: 12,
          maxTicksLimit: 6,
        },
        grid: { color: c.grid },
        title: { display: true, text: xtitle, color: c.muted, font:{size:12} }
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
  }
}

export default function Macro() {
  const [bm,      setBm]      = useState([])
  const [cpi,     setCpi]     = useState([])
  const [exp,     setExp]     = useState([])
  const [imp,     setImp]     = useState([])
  const [errBm,   setErrBm]   = useState(null)
  const [errCpi,  setErrCpi]  = useState(null)
  const [errExp,  setErrExp]  = useState(null)
  const [errImp,  setErrImp]  = useState(null)

  const [range, setRange] = useState('10Y') 

  const c = useCss()

  const cacheKey   = useMemo(() => Math.floor(Date.now() / (60 * 60 * 1000)), [])
  const CPI_URL    = `${CPI_CSV}?v=${cacheKey}`
  const BM_URL     = `${BM_CSV}?v=${cacheKey}`
  const EXPORTS_URL= `${EXPORTS_CSV}?v=${cacheKey}`
  const IMPORTS_URL= `${IMPORTS_CSV}?v=${cacheKey}`

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

  useEffect(() => {
    Papa.parse(EXPORTS_URL, {
      download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      downloadRequestHeaders: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      complete: (res) => setExp((res.data||[]).filter(r => r?.date)),
      error: (e) => setErrExp(e?.message || 'Failed to load exports CSV')
    })
  }, [EXPORTS_URL])

  useEffect(() => {
    Papa.parse(IMPORTS_URL, {
      download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      downloadRequestHeaders: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      complete: (res) => setImp((res.data||[]).filter(r => r?.date)),
      error: (e) => setErrImp(e?.message || 'Failed to load imports CSV')
    })
  }, [IMPORTS_URL])

  const cpiDates = useMemo(() => cpi.map(r => r.date), [cpi])
  const infl_mom = useMemo(() => cpi.map(r => asNum(r.infl_mom)), [cpi])
  const infl_yoy = useMemo(() => cpi.map(r => asNum(r.infl_yoy)), [cpi])
  const infl_ytd = useMemo(() => cpi.map(r => asNum(r.infl_ytd)), [cpi])
  const ipc2016  = useMemo(() => cpi.map(r => asNum(r.ipc_base2016)), [cpi])
  const ipc2007  = useMemo(() => cpi.map(r => asNum(r.ipc_base2007)), [cpi])
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

  const expDates = useMemo(() => exp.map(r => r.date), [exp])

  const expMinerals      = useMemo(() => exp.map(r => asNum(r['Total Minerales'])), [exp])
  const expHydrocarbons  = useMemo(() => exp.map(r => asNum(r['Total Hidrocarburos'])), [exp])
  const expNonTrad       = useMemo(() => exp.map(r => asNum(r['Total No Tradicionales'])), [exp])
  const expOtherGoods    = useMemo(() => exp.map(r => asNum(r['Otros Bienes'])), [exp])
  const expFOB           = useMemo(() => exp.map(r => asNum(r['FOB'])), [exp])

  const latestExp = exp.at(-1) || null
  const latestExportsFOB = latestExp ? asNum(latestExp['FOB']) : null

  const impDates = useMemo(() => imp.map(r => r.date), [imp])

  const impConsTotal    = useMemo(() => imp.map(r => asNum(r['BienesConsumo_Total'])), [imp])
  const impRawMaterials = useMemo(() => imp.map(r => asNum(r['MateriasPrimas_ParaIndustria'])), [imp])
  const impCapitalGoods = useMemo(() => imp.map(r => asNum(
    r['BienesCapital_TotalAmpliado'] ?? r['BienesCapital_Total']
  )), [imp])
  const impMisc         = useMemo(() => imp.map(r => asNum(r['Diversos_Total'])), [imp])

  const impFOBAdj       = useMemo(() => imp.map(r =>
    asNum(r['TotalImportaciones_FOBAjustado_MillonesUSD'] ?? r['TotalImportaciones_FOB'])
  ), [imp])

  const latestImp = imp.at(-1) || null
  const latestImportsFOBAdj = latestImp
    ? asNum(latestImp['TotalImportaciones_FOBAjustado_MillonesUSD'] ?? latestImp['TotalImportaciones_FOB'])
    : null

  const impByDate = useMemo(() => {
    const m = new Map()
    for (const row of imp) {
      if (row?.date) m.set(row.date, row)
    }
    return m
  }, [imp])

  const tradeDates = useMemo(() => expDates, [expDates])

  const importsForTrade = useMemo(() => {
    return tradeDates.map(d => {
      const r = impByDate.get(d)
      if (!r) return null
      return asNum(r['TotalImportaciones_FOBAjustado_MillonesUSD'] ?? r['TotalImportaciones_FOB'])
    })
  }, [tradeDates, impByDate])

  const tradeBalance = useMemo(() => {
    return tradeDates.map((d, idx) => {
      const x = expFOB[idx]
      const m = importsForTrade[idx]
      if (x == null || m == null) return null
      return x - m
    })
  }, [tradeDates, expFOB, importsForTrade])

  const latestTradeBalance = (latestExportsFOB != null && latestImportsFOBAdj != null)
    ? (latestExportsFOB - latestImportsFOBAdj)
    : null

  const lastDate =
    latestExp?.date ||
    latestImp?.date ||
    latestBM?.date ||
    latestCPI?.date ||
    '—'


  const cpiYoY = (() => {
    const base = {
      labels: cpiDates,
      datasets: [
        { label:'Inflation YoY', data: infl_yoy, borderWidth:2, pointRadius:0, tension:.25, borderColor:c.acc4, fill:false }
      ]
    }
    return applyRange(base.labels, base.datasets, range)
  })()

  const cpiMoM_YTD = (() => {
    const base = {
      labels: cpiDates,
      datasets: [
        { label:'Inflation MoM', data: infl_mom, borderWidth:2, pointRadius:0, tension:.25, borderColor:c.accent, fill:false },
        { label:'Inflation YTD', data: infl_ytd, borderWidth:2, pointRadius:0, tension:.25, borderColor:c.acc3, fill:false }
      ]
    }
    return applyRange(base.labels, base.datasets, range)
  })()

  const ipcBothBases = (() => {
    const base = {
      labels: cpiDates,
      datasets: [
        { label:'CPI (base 2016)', data: ipc2016, borderWidth:2, pointRadius:0, tension:.25, borderColor:c.acc2, backgroundColor:'rgba(35,209,139,0.10)', fill:true },
        { label:'CPI (base 2007)', data: ipc2007, borderWidth:2, pointRadius:0, tension:.25, borderColor:c.muted, fill:false }
      ]
    }
    return applyRange(base.labels, base.datasets, range)
  })()

  const reservesData = (() => {
    const base = {
      labels: bmDates,
      datasets: [
        { label: 'Gross Reserves (RIB)', data: RIB,  borderWidth: 2, pointRadius: 0, tension: .25, borderColor: c.accent, fill:false },
        { label: 'Net Reserves (RIN)',   data: RIN,  borderWidth: 2, pointRadius: 0, tension: .25, borderColor: c.acc2, fill:false },
        { label: 'Short-term External Liab. (OECP)', data: OECP, borderWidth: 2, pointRadius: 0, tension: .25, borderColor: c.acc4, fill:false },
      ]
    }
    return applyRange(base.labels, base.datasets, range)
  })()

  const cnspData = (() => {
    const base = {
      labels: bmDates,
      datasets: [
        { label: 'Net Credit to Public Sector (CNSP)', data: CNSP, borderWidth: 2, pointRadius: 0, tension: .25, borderColor: c.acc3, fill:false },
      ]
    }
    return applyRange(base.labels, base.datasets, range)
  })()

  const bmData = (() => {
    const base = {
      labels: bmDates,
      datasets: [
        { label: 'Monetary Base (BM)', data: BM_TOT, borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.acc3, backgroundColor:'rgba(255,180,84,0.10)', fill:true },
        { label: 'Cash in Public Hands', data: CASH_PUB, borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.accent, fill:false },
      ]
    }
    return applyRange(base.labels, base.datasets, range)
  })()

  const compData = (() => {
    const base = {
      labels: bmDates,
      datasets: [
        { label: 'Local Currency (MN)',  data: MN,  borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.accent, fill:false },
        { label: 'UFV',                  data: UFV, borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.acc2,   fill:false },
        { label: 'Foreign Currency (ME)',data: ME,  borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.acc4,   fill:false },
      ]
    }
    return applyRange(base.labels, base.datasets, range)
  })()

  const totalData = (() => {
    const base = {
      labels: bmDates,
      datasets: [
        { label: 'TOTAL (if present)', data: TOTAL_any, borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.text, fill:false },
      ]
    }
    return applyRange(base.labels, base.datasets, range)
  })()

  const exportsByCategory = (() => {
    const base = {
      labels: expDates,
      datasets: [
        { label: 'Minerals (total)',       data: expMinerals,     borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.accent, fill:false },
        { label: 'Hydrocarbons (total)',   data: expHydrocarbons, borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.acc2,   fill:false },
        { label: 'Non-traditional goods',  data: expNonTrad,      borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.acc3,   fill:false },
        { label: 'Other goods',            data: expOtherGoods,   borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.acc4,   fill:false },
      ]
    }
    return applyRange(base.labels, base.datasets, range)
  })()

  const importsByCategory = (() => {
    const base = {
      labels: impDates,
      datasets: [
        { label: 'Consumption goods (total)', data: impConsTotal,    borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.accent, fill:false },
        { label: 'Raw materials (industry)',  data: impRawMaterials, borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.acc2,   fill:false },
        { label: 'Capital goods (extended)',  data: impCapitalGoods, borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.acc3,   fill:false },
        { label: 'Other / diverse',           data: impMisc,         borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.acc4,   fill:false },
      ]
    }
    return applyRange(base.labels, base.datasets, range)
  })()

  const tradeFlowsData = (() => {
    const base = {
      labels: tradeDates,
      datasets: [
        { label: 'Exports (FOB, millions USD)',  data: expFOB,          borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.accent, fill:false },
        { label: 'Imports (FOB, millions USD)',  data: importsForTrade, borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.acc4,   fill:false },
      ]
    }
    return applyRange(base.labels, base.datasets, range)
  })()

  const tradeBalanceData = (() => {
    const base = {
      labels: tradeDates,
      datasets: [
        { label: 'Trade balance (X − M)', data: tradeBalance, borderWidth: 2, pointRadius: 0, tension:.25, borderColor:c.acc2, backgroundColor:'rgba(35,209,139,0.10)', fill:true },
      ]
    }
    return applyRange(base.labels, base.datasets, range)
  })()

  const canRender = (data) =>
    Array.isArray(data?.labels) &&
    data.labels.length > 0 &&
    Array.isArray(data?.datasets) &&
    data.datasets.some(ds => hasSeries(ds.data))

  const rangeOptions = ['YTD', '5Y', '10Y', 'ALL']

  return (
    <div className="card">
      <div className="help-row" style={{alignItems:'center', gap:8, flexWrap:'wrap'}}>
        <h2 style={{margin:0}}>Macroeconomic Indicators</h2>

        <div style={{marginLeft:'auto', display:'flex', gap:6, flexWrap:'wrap'}}>
          {rangeOptions.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className="pill"
              style={{
                padding:'4px 10px',
                fontSize:'.8rem',
                borderRadius:999,
                border:'1px solid var(--border)',
                background: range === r ? 'var(--accent-2)' : 'transparent',
                color: range === r ? '#000' : 'var(--text)',
                cursor:'pointer'
              }}
            >
              {r === 'ALL' ? 'All' : r}
            </button>
          ))}
        </div>
      </div>

      {errCpi && <p style={{color:'var(--accent-4)'}}>CPI error: {errCpi}</p>}
      {errBm  && <p style={{color:'var(--accent-4)'}}>BM error: {errBm}</p>}
      {errExp && <p style={{color:'var(--accent-4)'}}>Exports error: {errExp}</p>}
      {errImp && <p style={{color:'var(--accent-4)'}}>Imports error: {errImp}</p>}

      {(latestCPI || latestBM || latestExp || latestImp) && (
        <div
          className="kpi-grid"
          style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',
            gap:12,
            marginBottom:12
          }}
        >
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
                <div className="label">Monetary Base (BOB Thousands)</div>
                <div className="value mono">
                  {fmt(pick(latestBM, ['BASE MONETARIA BM','Base Monetaria','BM']))}
                </div>
              </div>
              <div className="kpi">
                <div className="label">Gross Reserves (USD Millions)</div>
                <div className="value mono">
                  {fmt(pick(latestBM, ['Reservas Internacionales Brutas RIB','RIB','Reservas Internacionales Brutas (RIB)']))}
                </div>
              </div>
              <div className="kpi">
                <div className="label">Net Reserves (USD Millions)</div>
                <div className="value mono">
                  {fmt(pick(latestBM, ['Reservas Internacionales Netas RIN = RIB - OECP','RIN','Reservas Internacionales Netas (RIN)']))}
                </div>
              </div>
            </>
          )}

          {latestExp && (
            <>
              <div className="kpi">
                <div className="label">External — Date</div>
                <div className="value mono">{latestExp.date}</div>
              </div>
              <div className="kpi">
                <div className="label">Exports (USD Millions)</div>
                <div className="value mono">{fmt(latestExportsFOB, 2)}</div>
              </div>
              {latestImp && (
                <>
                  <div className="kpi">
                    <div className="label">Imports (USD Millions)</div>
                    <div className="value mono">{fmt(latestImportsFOBAdj, 2)}</div>
                  </div>
                  <div className="kpi">
                    <div className="label">Trade Balance (USD Millions)</div>
                    <div className="value mono">{fmt(latestTradeBalance, 2)}</div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Charts grid: max 2 per row on larger screens, 1 per row on phones */}
      <div className="macro-chart-grid">
        {/* CPI */}
        {canRender(cpiYoY) && (
          <div className="card">
            <h3 style={{margin:'0 0 8px'}}>Inflation — Year over Year</h3>
            <Line data={cpiYoY} options={baseOpts('Date', 'Change (%)', true)} />
          </div>
        )}

        {canRender(cpiMoM_YTD) && (
          <div className="card">
            <h3 style={{margin:'0 0 8px'}}>Inflation — Monthly & Year-to-Date</h3>
            <Line data={cpiMoM_YTD} options={baseOpts('Date', 'Change (%)', true)} />
          </div>
        )}

        {canRender(ipcBothBases) && (
          <div className="card">
            <h3 style={{margin:'0 0 8px'}}>Consumer Price Index (Levels)</h3>
            <Line data={ipcBothBases} options={baseOpts('Date', 'Index level')} />
          </div>
        )}

        {/* Reserves */}
        {canRender(reservesData) && (
          <div className="card">
            <h3 style={{margin:'0 0 8px'}}>International Reserves & Short-term Liabilities</h3>
            <Line data={reservesData} options={baseOpts('Date', 'Millions USD')} />
          </div>
        )}

        {/* CNSP */}
        {canRender(cnspData) && (
          <div className="card">
            <h3 style={{margin:'0 0 8px'}}>Net Credit to Public Sector (CNSP)</h3>
            <Line data={cnspData} options={baseOpts('Date', 'Thousands of Bs')} />
          </div>
        )}

        {/* Base Monetaria & Cash */}
        {canRender(bmData) && (
          <div className="card">
            <h3 style={{margin:'0 0 8px'}}>Monetary Base & Cash in Public Hands</h3>
            <Line data={bmData} options={baseOpts('Date', 'Thousands of Bs')} />
          </div>
        )}

        {/* Currency composition */}
        {canRender(compData) && (
          <div className="card">
            <h3 style={{margin:'0 0 8px'}}>Currency Composition — MN / UFV / ME</h3>
            <Line data={compData} options={baseOpts('Date', 'Thousands of Bs')} />
          </div>
        )}

        {/* TOTAL (if exists) */}
        {canRender(totalData) && (
          <div className="card">
            <h3 style={{margin:'0 0 8px'}}>TOTAL (if present)</h3>
            <Line data={totalData} options={baseOpts('Date', 'Thousands of Bs')} />
          </div>
        )}

        {/* Exports by category */}
        {canRender(exportsByCategory) && (
          <div className="card">
            <h3 style={{margin:'0 0 8px'}}>Exports by Major Category</h3>
            <Line data={exportsByCategory} options={baseOpts('Date', 'Millions USD')} />
          </div>
        )}

        {/* Imports by category */}
        {canRender(importsByCategory) && (
          <div className="card">
            <h3 style={{margin:'0 0 8px'}}>Imports by Major Category</h3>
            <Line data={importsByCategory} options={baseOpts('Date', 'Millions USD')} />
          </div>
        )}

        {/* Exports vs imports */}
        {canRender(tradeFlowsData) && (
          <div className="card">
            <h3 style={{margin:'0 0 8px'}}>Exports vs. Imports</h3>
            <Line data={tradeFlowsData} options={baseOpts('Date', 'Millions USD')} />
          </div>
        )}

        {/* Trade balance */}
        {canRender(tradeBalanceData) && (
          <div className="card">
            <h3 style={{margin:'0 0 8px'}}>Trade Balance (Exports − Imports)</h3>
            <Line data={tradeBalanceData} options={baseOpts('Date', 'Millions USD')} />
          </div>
        )}
      </div>

      {!errBm && !errCpi && !errExp && !errImp &&
        ![
          cpiYoY, cpiMoM_YTD, ipcBothBases,
          reservesData, cnspData, bmData, compData, totalData,
          exportsByCategory, importsByCategory,
          tradeFlowsData, tradeBalanceData
        ].some(canRender) && (
          <p>No data available to render charts.</p>
      )}
    </div>
  )
}
