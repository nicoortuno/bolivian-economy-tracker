from pathlib import Path
import pandas as pd
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline

LATEST = Path("data/curated/news/news_latest.parquet")
OUT    = Path("data/curated/news/news_summaries.parquet")

MODEL_ID = "csebuetnlp/mT5_multilingual_XLSum"

tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, use_fast=False, legacy=False)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID)

summ = pipeline(
    "summarization",
    model=model,
    tokenizer=tokenizer,
    device_map="auto",
)

def summarize_text(txt: str) -> str | None:
    if not isinstance(txt, str):
        return None
    txt = txt.strip()
    if len(txt) < 200:
        return None

    txt = txt[:2000]
    out = summ(
        txt,
        max_length=140, 
        min_length=40,
        do_sample=False,
        truncation=True,
    )[0]["summary_text"]
    return out.strip()

def main():
    if not LATEST.exists():
        print("[summaries] latest parquet not found")
        return

    df = pd.read_parquet(LATEST).drop_duplicates("url_hash", keep="last")

    done = set()
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

    todo["summary"] = todo["text"].map(summarize_text)

    if OUT.exists():
        prev = pd.read_parquet(OUT)
        out = pd.concat([prev, todo[["url_hash","summary"]]], ignore_index=True)
        out = out.drop_duplicates("url_hash", keep="last")
    else:
        out = todo[["url_hash","summary"]]

    out.to_parquet(OUT, index=False)
    print(f"[summaries] wrote {OUT}, rows={len(out)}")

if __name__ == "__main__":
    main()
