import { useEffect, useMemo, useState } from "react";

const FEED_PATH = "/api/news_latest.json";

function fmtWhen(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

export default function News() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const bust = useMemo(() => Math.floor(Date.now() / (60 * 60 * 1000)), []);
  const url = `${FEED_PATH}?v=${bust}`;

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const rsp = await fetch(url, { cache: "no-store" });
      if (!rsp.ok) throw new Error(`HTTP ${rsp.status}`);
      const data = await rsp.json();
      setItems((data.items || []).slice(0, 30)); 
    } catch (e) {
      setErr(e.message || "Failed to load summaries");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="card">
      <div className="help-row" style={{alignItems:"center", gap: 8}}>
        <h2 style={{margin:0}}>Economic News</h2>
      </div>

      {err && <p style={{ color: "var(--accent-4)" }}>Error: {err}</p>}
      {!err && loading && <p>Loading summaries…</p>}
      {!err && !loading && items.length === 0 && (
        <p>No summaries yet for today.</p>
      )}

<div className="summary-list">
        {items.map((it, i) => {
          const when = it.published_at_bo || it.published_at_utc || it.fetched_at_utc;
          return (
            <article key={i} className="summary-card" style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 12,
              background: "var(--card)"
            }}>
              <h3 style={{ margin: "0 0 6px" }}>
                <a href={it.url} target="_blank" rel="noopener noreferrer">
                  {it.title || "(sin título)"}
                </a>
              </h3>
              <div className="meta" style={{ fontSize: ".9rem", color: "var(--muted)", marginBottom: 6 }}>
                <strong>{it.source || "—"}</strong> · {fmtWhen(when)} {it.published_at_bo ? "BOT" : ""}
                {it.sentiment ? ` · ${String(it.sentiment).toUpperCase()}` : ""}
              </div>
              <p style={{ margin: 0, lineHeight: 1.45 }}>{it.summary}</p>

              {Array.isArray(it.tags) && it.tags.length > 0 && (
                <div className="tags" style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {it.tags.map((t, j) => (
                    <span key={j} className="tag" style={{
                      fontSize: ".75rem",
                      padding: "2px 6px",
                      borderRadius: 999,
                      background: "var(--chip)"
                    }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}