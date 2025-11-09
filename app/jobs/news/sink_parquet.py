"""
Turn raw JSON articles into curated Parquet partitions and a rolling 'latest' table.

Input:
  data/raw/news/<source>/<YYYY-MM-DD>/<hash>.json

Output:
  data/curated/news/day=<YYYY-MM-DD>/news.parquet   (deduped per day)
  data/curated/news/news_latest.parquet             (rolling N days)

Usage:
  python app/jobs/news/sink_parquet.py --sources eldeber --days 14
  python app/jobs/news/sink_parquet.py --sources eldeber pagina_siete --days 30 --reingest
"""

from __future__ import annotations

import argparse
import glob
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List

import pandas as pd
from filelock import FileLock

RAW_DIR     = Path("data/raw/news")           
CURATED_DIR = Path("data/curated/news")   
LATEST_PATH = Path("data/curated/news/news_latest.parquet")

BASE_SCHEMA = [
    "source", "section", "url", "url_hash", "title", "text",
    "published_at", "fetched_at", "day", "ingested_at",
]


def _coerce_dt(x) -> Optional[pd.Timestamp]:
    """
    Parse to timezone-aware Timestamp when possible.
    - If the string carries an offset (e.g., '-04:00'), it stays tz-aware.
    - If naive, leave as NaT (we don't guess); fetched_at usually has 'Z'.
    """
    if not x:
        return None
    try:
        ts = pd.to_datetime(x, utc=False)
        return ts
    except Exception:
        return None


def _atomic_write_parquet(df: pd.DataFrame, out_path: Path, lock_path: Optional[Path] = None) -> None:
    """
    Write df to out_path atomically:
      1) write temp file
      2) replace target
    Guarded by a file lock (cron-safe).
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = out_path.with_suffix(".tmp.parquet")
    lock = FileLock(str(lock_path or out_path.with_suffix(".lock")), timeout=60)
    with lock:
        df.to_parquet(tmp_path, index=False)
        tmp_path.replace(out_path)


def _discover_days(source: str) -> List[str]:
    """Find all YYYY-MM-DD directories under data/raw/news/<source>/."""
    base = RAW_DIR / source
    if not base.exists():
        return []
    days = []
    for p in base.iterdir():
        if p.is_dir() and len(p.name) == 10 and p.name[4] == "-" and p.name[7] == "-":
            days.append(p.name)
    return sorted(days)


def _derive_day(pub: Optional[pd.Timestamp], fet: Optional[pd.Timestamp], fallback_day: str) -> str:
    """
    Prefer Bolivia-local publication calendar date, else fetched (UTC), else fallback.
    """
    if isinstance(pub, pd.Timestamp) and not pd.isna(pub):
        try:
            if pub.tzinfo is not None:
                return pub.tz_convert("America/La_Paz").date().isoformat()
            else:
                return pub.date().isoformat()
        except Exception:
            try:
                return pub.date().isoformat()
            except Exception:
                pass

    if isinstance(fet, pd.Timestamp) and not pd.isna(fet):
        try:
            if fet.tzinfo is not None:
                return fet.tz_convert("UTC").date().isoformat()
            return fet.date().isoformat()
        except Exception:
            pass

    return fallback_day


def _ingest_day_for_source(source: str, day: str) -> Optional[Path]:
    """
    Read raw JSON for one (source, day), write/update curated partition.
    Dedupe by url_hash keeping the latest by fetched/ingested time.
    """
    raw_day_dir = RAW_DIR / source / day
    if not raw_day_dir.exists():
        return None

    rows = []
    for fp in glob.glob(str(raw_day_dir / "*.json")):
        obj = json.loads(Path(fp).read_text(encoding="utf-8"))
        pub = _coerce_dt(obj.get("published_at"))
        fet = _coerce_dt(obj.get("fetched_at"))

        url = obj["url"]
        url_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]

        derived_day = _derive_day(pub, fet, day)

        rows.append({
            "source": obj.get("source", source),
            "section": obj.get("section"),
            "url": url,
            "url_hash": url_hash,
            "title": obj.get("title"),
            "text": obj.get("text"),
            "published_at": pub,
            "fetched_at": fet,
            "day": derived_day,
            "ingested_at": pd.Timestamp(datetime.now(timezone.utc)),
        })

    if not rows:
        return None

    df_new = pd.DataFrame(rows, columns=BASE_SCHEMA)

    part_dir = CURATED_DIR / f"day={day}"
    out_path = part_dir / "news.parquet"

    if out_path.exists():
        df_old = pd.read_parquet(out_path)
        df = pd.concat([df_old, df_new], ignore_index=True)
    else:
        df = df_new

    df.sort_values(["url_hash", "fetched_at", "ingested_at"], inplace=True, kind="mergesort")
    df = df.drop_duplicates(subset=["url_hash"], keep="last")

    df = df[BASE_SCHEMA]

    _atomic_write_parquet(df, out_path)
    return out_path


def build_latest(lookback_days: int = 14) -> Optional[Path]:
    """
    Merge the last N day partitions into a rolling 'latest' parquet, deduped again.
    """
    CURATED_DIR.mkdir(parents=True, exist_ok=True)
    parts = sorted(CURATED_DIR.glob("day=*"), reverse=True)[:lookback_days]

    dfs = []
    for part in parts:
        f = part / "news.parquet"
        if f.exists():
            dfs.append(pd.read_parquet(f))

    if not dfs:
        return None

    df = pd.concat(dfs, ignore_index=True)

    df.sort_values(["url_hash", "fetched_at", "ingested_at"], inplace=True, kind="mergesort")
    df = df.drop_duplicates(subset=["url_hash"], keep="last")

    df.sort_values(
        ["published_at", "fetched_at", "ingested_at"],
        ascending=[False, False, False],
        inplace=True,
        kind="mergesort",
    )

    _atomic_write_parquet(df, LATEST_PATH)
    return LATEST_PATH


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", nargs="+", default=["eldeber"], help="Raw sources under data/raw/news")
    ap.add_argument("--days", type=int, default=14, help="How many most-recent day partitions to include in 'latest'")
    ap.add_argument("--reingest", action="store_true",
                    help="Re-ingest ALL discovered days for each source (otherwise only today or latest fallback).")
    args = ap.parse_args()

    if args.reingest:
        target_days = set()
        for src in args.sources:
            target_days.update(_discover_days(src))
        if not target_days:
            print("[curated] no raw days discovered; nothing to ingest")
    else:
        today = datetime.utcnow().date().isoformat()
        target_days = {today}
        need_fallback = any(not (RAW_DIR / src / today).exists() for src in args.sources)
        if need_fallback:
            latest = []
            for src in args.sources:
                days = _discover_days(src)
                if days:
                    latest.append(days[-1])
            if latest:
                target_days = {max(latest)}

    wrote_any = False
    for day in sorted(target_days):
        for src in args.sources:
            p = _ingest_day_for_source(src, day)
            if p:
                wrote_any = True
                print(f"[curated] wrote {p}")

    latest = build_latest(args.days)
    if latest:
        print(f"[latest] wrote {latest}")
    else:
        print("[latest] nothing to write")


if __name__ == "__main__":
    main()
