export default function MetricHelp({ onClose }) {
    return (
      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h3 style={{margin:0}}>What these metrics mean</h3>
          <button className="pill" onClick={onClose}>Close</button>
        </div>
        <ul style={{marginTop:12, lineHeight:1.5}}>
          <li><b>Mid (BOB/USDT)</b>: midpoint between the <i>best bid</i> and <i>best ask</i> quotes (tradable mid).</li>
          <li><b>Best Bid / Best Ask</b>: highest price buyers will pay / lowest price sellers will accept.</li>
          <li><b>Spread % (best)</b>: (Best Ask − Best Bid) ÷ Mid. A lower value = tighter market & lower immediate trading cost.</li>
          <li><b>Effective Spread %</b>: (Buy Median − Sell Median) ÷ Mid. Approximates the cost to cross where <i>typical</i> quotes cluster (more realistic in fragmented books).</li>
          <li><b>Median Gap</b>: Buy Median − Sell Median. Large gap = disagreement about fair value.</li>
          <li><b>Depth Imbalance</b>: (Buy Count − Sell Count) ÷ (Buy Count + Sell Count). +1 = only buyers; −1 = only sellers; 0 = balanced.</li>
          <li><b>Δ Mid (1h)</b>: Hour-over-hour mid change (absolute and %).</li>
          <li><b>Rolling Vol</b>: Std-dev of mid over 24h / 7d (hourly data). Higher = more unstable FX.</li>
        </ul>
        <p style={{color:'var(--muted)', marginTop:8}}>
          Note: “Buy” = you buy USDT with BOB (seller quotes). “Sell” = you sell USDT for BOB (buyer quotes).
        </p>
      </div>
    )
  }