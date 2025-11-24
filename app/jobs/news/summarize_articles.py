#!/usr/bin/env python3
from pathlib import Path
import pandas as pd
from openai import OpenAI

client = OpenAI()

LATEST = Path("data/curated/news/news_latest.parquet")
OUT    = Path("data/curated/news/news_summaries.parquet")

def summarize_text(txt: str) -> str | None:
    if not isinstance(txt, str):
        return None

    txt = txt.strip()
    if len(txt) < 200:
        return None

    try:
        response = client.responses.create(
            model="gpt-5-nano",
            reasoning={"effort": "low"},
            instructions="Escribe un resumen en 1-2 oraciones, en español.",
            input=txt,
        )

        out = response.output_text

        print(out)

        if not out:
            print("[summaries] WARNING: model returned empty output")
            return None
        summary = out.strip()
    except Exception as e:
        print(f"[summaries] error summarizing article: {e}")
        return None

    return summary or None


def main():
    if not LATEST.exists():
        print("[summaries] latest parquet not found")
        return

    df = pd.read_parquet(LATEST).drop_duplicates("url_hash", keep="last")

    done: set[str] = set()
    if OUT.exists():
        prev = pd.read_parquet(OUT)
        done = set(prev["url_hash"])

    todo = df[~df["url_hash"].isin(done)].copy()

    if todo.empty and OUT.exists():
        print("[summaries] nothing new")
        return

    if todo.empty:
        df.assign(summary=None).to_parquet(OUT, index=False)
        print("[summaries] wrote empty baseline file")
        return

    print(f"[summaries] summarizing {len(todo)} new articles...")
    todo["summary"] = todo["text"].map(summarize_text)

    new_summaries = todo[["url_hash", "summary"]]

    if OUT.exists():
        prev = pd.read_parquet(OUT)
        out = pd.concat(
            [prev, new_summaries],
            ignore_index=True,
        ).drop_duplicates("url_hash", keep="last")
    else:
        out = new_summaries

    out.to_parquet(OUT, index=False)
    print(f"[summaries] wrote {OUT}, rows={len(out)}")


if __name__ == "__main__":
    main()
