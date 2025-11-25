from pathlib import Path
import pandas as pd
from openai import OpenAI

client = OpenAI()

LATEST = Path("data/curated/news/news_latest.parquet")
OUT    = Path("data/curated/news/news_summaries.parquet")


def summarize_es(txt: str) -> str | None:
    if not isinstance(txt, str):
        return None

    txt = txt.strip()
    if len(txt) < 200:
        return None

    try:
        response = client.responses.create(
            model="gpt-5-nano",
            reasoning={"effort": "low"},
            instructions="Escribe un resumen conciso de 1–2 oraciones en español.",
            input=txt,
        )

        out = response.output_text
        if not out:
            print("[summaries] WARNING: empty ES summary")
            return None

        summary = out.strip()
        print("[ES]", summary)

        return summary or None

    except Exception as e:
        print(f"[summaries] error summarizing (ES): {e}")
        return None


def translate_to_en(txt_es: str) -> str | None:
    if not isinstance(txt_es, str) or not txt_es.strip():
        return None

    try:
        response = client.responses.create(
            model="gpt-5-nano",
            reasoning={"effort": "low"},
            instructions="Translate the following Spanish summary into natural, fluent English suitable for news readers.",
            input=txt_es,
        )

        out = response.output_text
        if not out:
            print("[summaries] WARNING: empty EN translation")
            return None

        summary_en = out.strip()
        print("[EN]", summary_en)

        return summary_en or None

    except Exception as e:
        print(f"[summaries] error translating (EN): {e}")
        return None


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
        df.assign(summary_es=None, summary_en=None).to_parquet(OUT, index=False)
        print("[summaries] wrote empty baseline file")
        return

    print(f"[summaries] summarizing {len(todo)} new articles...")

    todo["summary_es"] = todo["text"].map(summarize_es)
    todo["summary_en"] = todo["summary_es"].map(translate_to_en)

    new_summaries = todo[["url_hash", "summary_es", "summary_en"]]

    if OUT.exists():
        prev = pd.read_parquet(OUT)
        out = pd.concat([prev, new_summaries], ignore_index=True) \
              .drop_duplicates("url_hash", keep="last")
    else:
        out = new_summaries

    out.to_parquet(OUT, index=False)
    print(f"[summaries] wrote {OUT}, rows={len(out)}")


if __name__ == "__main__":
    main()
