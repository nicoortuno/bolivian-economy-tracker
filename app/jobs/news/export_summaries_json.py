# #!/usr/bin/env python3
# """
# Merge latest news with per-article summaries (and optional tags/sentiment)
# and export a small JSON your static site can fetch.

# Input:
#   data/curated/news/news_latest.parquet
#   data/curated/news/news_summaries.parquet
#   (optional) data/curated/news/news_tags.parquet
# Output:
#   public/api/news_latest.json   (PUTS FILE WHERE THE SITE CAN SERVE IT)
# """
# from __future__ import annotations
# from pathlib import Path
# from datetime import timezone
# import json
# import pandas as pd

# LATEST_PARQUET   = Path("data/curated/news/news_latest.parquet")
# SUMMARIES_PARQUET= Path("data/curated/news/news_summaries.parquet")
# TAGS_PARQUET     = Path("data/curated/news/news_tags.parquet") 
# OUT_JSON         = Path("app/ui/public/api/news_latest.json")

# def to_lapaz(ts: pd.Timestamp | None) -> str | None:
#     if ts is None or pd.isna(ts):
#         return None
#     if ts.tzinfo is None:
#         ts = ts.tz_localize("UTC")
#     return ts.tz_convert("America/La_Paz").isoformat()

# def main():
#     if not LATEST_PARQUET.exists() or not SUMMARIES_PARQUET.exists():
#         print("[export] missing inputs")
#         return

#     base = pd.read_parquet(LATEST_PARQUET).drop_duplicates("url_hash", keep="last")
#     sums = pd.read_parquet(SUMMARIES_PARQUET)
#     df = base.merge(sums, on="url_hash", how="left")

#     if TAGS_PARQUET.exists():
#         tags = pd.read_parquet(TAGS_PARQUET)[["url_hash","tags","sentiment"]]
#         df = df.merge(tags, on="url_hash", how="left")
#     else:
#         df["tags"] = None
#         df["sentiment"] = None

#     df = df.sort_values(
#         ["published_at","fetched_at","ingested_at"],
#         ascending=[False, False, False]
#     )

#     def row_to_obj(r):
#         pub = r.get("published_at")
#         fet = r.get("fetched_at")
#         return {
#             "source": r.get("source"),
#             "title": r.get("title"),
#             "url": r.get("url"),
#             "summary": r.get("summary"),
#             "tags": (list(r["tags"]) if isinstance(r.get("tags"), (list, tuple)) else r.get("tags")),
#             "sentiment": r.get("sentiment"),
#             "published_at_utc": (None if pd.isna(pub) else pub.isoformat()),
#             "published_at_bo": to_lapaz(pub) if pd.notna(pub) else None,
#             "fetched_at_utc": (None if pd.isna(fet) else fet.isoformat()),
#             "day": r.get("day"),
#         }

#     payload = {
#         "generated_at_utc": pd.Timestamp.now(tz=timezone.utc).isoformat(),
#         "count": int(len(df)),
#         "items": [row_to_obj(r) for _, r in df.iterrows() if isinstance(r.get("summary"), str) and r["summary"].strip()],
#     }

#     OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
#     OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
#     print(f"[export] wrote {OUT_JSON} items={len(payload['items'])}")

# if __name__ == "__main__":
#     main()

#!/usr/bin/env python3
"""
DEBUG VERSION — prints intermediate data so we can see why items=0.
"""

from __future__ import annotations
from pathlib import Path
from datetime import timezone
import json
import pandas as pd

LATEST_PARQUET   = Path("data/curated/news/news_latest.parquet")
SUMMARIES_PARQUET= Path("data/curated/news/news_summaries.parquet")
TAGS_PARQUET     = Path("data/curated/news/news_tags.parquet") 
OUT_JSON         = Path("app/ui/public/api/news_latest.json")

def to_lapaz(ts: pd.Timestamp | None) -> str | None:
    if ts is None or pd.isna(ts):
        return None
    if ts.tzinfo is None:
        ts = ts.tz_localize("UTC")
    return ts.tz_convert("America/La_Paz").isoformat()

def main():
    print("==== DEBUG: Starting export ====")

    if not LATEST_PARQUET.exists():
        print("[export] ERROR: latest parquet missing")
        return
    if not SUMMARIES_PARQUET.exists():
        print("[export] ERROR: summaries parquet missing")
        return

    base = pd.read_parquet(LATEST_PARQUET).drop_duplicates("url_hash", keep="last")
    sums = pd.read_parquet(SUMMARIES_PARQUET)

    print("\n--- DEBUG: Base news ---")
    print("Rows in latest:", len(base))
    print("Columns:", base.columns.tolist())
    print(base.head(3))

    print("\n--- DEBUG: Summaries ---")
    print("Rows in summaries:", len(sums))
    print("Columns:", sums.columns.tolist())
    print(sums.head(3))

    # Check if url_hash values match
    print("\n--- DEBUG: url_hash intersection ---")
    intersection = set(base["url_hash"]) & set(sums["url_hash"])
    print("Matching url_hash count:", len(intersection))

    # Merge
    df = base.merge(sums, on="url_hash", how="left")

    print("\n--- DEBUG: After merge ---")
    print("Rows:", len(df))
    print(df[["url_hash", "title", "summary"]].head(10))

    # Count non-empty summaries
    valid_summaries = df["summary"].apply(lambda x: isinstance(x, str) and x.strip() != "")
    print("\n--- DEBUG: Summary stats ---")
    print("Valid summaries:", valid_summaries.sum())
    print("Invalid summaries:", (~valid_summaries).sum())

    # Tag handling
    if TAGS_PARQUET.exists():
        tags = pd.read_parquet(TAGS_PARQUET)[["url_hash","tags","sentiment"]]
        df = df.merge(tags, on="url_hash", how="left")
    else:
        df["tags"] = None
        df["sentiment"] = None

    def row_to_obj(r):
        pub = r.get("published_at")
        fet = r.get("fetched_at")
        return {
            "source": r.get("source"),
            "title": r.get("title"),
            "url": r.get("url"),
            "summary": r.get("summary"),
            "tags": (list(r["tags"]) if isinstance(r.get("tags"), (list, tuple)) else r.get("tags")),
            "sentiment": r.get("sentiment"),
            "published_at_utc": (None if pd.isna(pub) else pub.isoformat()),
            "published_at_bo": to_lapaz(pub) if pd.notna(pub) else None,
            "fetched_at_utc": (None if pd.isna(fet) else fet.isoformat()),
            "day": r.get("day"),
        }

    payload = {
        "generated_at_utc": pd.Timestamp.now(tz=timezone.utc).isoformat(),
        "count": int(len(df)),
        "items": [
            row_to_obj(r)
            for _, r in df.iterrows()
            if isinstance(r.get("summary"), str) and r["summary"].strip()
        ],
    }

    print("\n--- DEBUG: Final export stats ---")
    print("Items going into JSON:", len(payload["items"]))

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[export] wrote {OUT_JSON}")

if __name__ == "__main__":
    main()

