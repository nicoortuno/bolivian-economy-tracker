import csv, json, sys, time, re
from datetime import datetime, date
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.bcb.gob.bo/?q=indicadores_inflacion"
PAGE_URL = "https://www.bcb.gob.bo/?q=indicadores_inflacion&page={page}"
OUT_DIR = Path("data/macro")
CSV_PATH = OUT_DIR / "bcb_inflation_history.csv"
LATEST_JSON = OUT_DIR / "bcb_inflation_latest.json"

BACKFILL_START = date(2008, 1, 1)  
MAX_PAGES = 100

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; BET/1.0; +https://github.com/nicoortuno/bolivian-economy-tracker)"
}

MONTHS_ES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12
}

def _norm_num(s):
    if s is None: return None
    s = s.strip()
    if s == "": return None
    if s.endswith("%"):
        s2 = s[:-1].strip().replace(".", "").replace(",", ".")
        try: return float(s2) / 100.0
        except ValueError: return None
    s2 = s.replace(".", "").replace(",", ".")
    try: return float(s2)
    except ValueError: return None

def _parse_date(label):
    t = (label or "").strip().lower()
    m = re.match(r"([a-záéíóúñ]+)\s+(\d{4})", t, re.IGNORECASE)
    if m:
        mon_name, year = m.group(1), int(m.group(2))
        mon = MONTHS_ES.get(mon_name)
        if mon: return f"{year:04d}-{mon:02d}-01"
    m = re.match(r"(\d{1,2})/(\d{4})", t)
    if m:
        mon, year = int(m.group(1)), int(m.group(2))
        return f"{year:04d}-{mon:02d}-01"
    try:
        dt = datetime.fromisoformat(t[:10])
        return f"{dt.year:04d}-{dt.month:02d}-01"
    except Exception:
        return None

def fetch(url, retries=3, backoff=1.5):
    last = None
    for i in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=30)
            r.raise_for_status()
            if not r.encoding or r.encoding.lower() == 'iso-8859-1':
                r.encoding = r.apparent_encoding or 'utf-8'
            return r.text
        except Exception as e:
            last = e
            time.sleep(backoff ** (i+1))
    raise last

def _header_roles(table):
    ths = table.find_all("th")
    roles = []
    if ths:
        for th in ths:
            t = th.get_text(" ", strip=True).lower()
            if "fecha" in t or "mes" in t: roles.append("fecha")
            elif "ipc" in t and "2016" in t: roles.append("ipc2016")
            elif "ipc" in t and "2007" in t: roles.append("ipc2007")
            elif "mensual" in t: roles.append("mensual")
            elif "acumulad" in t: roles.append("acumulada")
            elif "anual" in t or "interanual" in t: roles.append("anual")
            else: roles.append("")
    return roles

def parse_table(html):
    soup = BeautifulSoup(html, "html.parser")
    candidates = []
    for tbl in soup.find_all("table"):
        headers = [th.get_text(" ", strip=True).lower() for th in tbl.find_all("th")]
        joined = " | ".join(headers)
        bodytxt = tbl.get_text(" ", strip=True).lower()
        if ("ipc" in joined and ("mensual" in joined or "anual" in joined)) or ("ipc" in bodytxt and "mensual" in bodytxt and "anual" in bodytxt):
            candidates.append(tbl)
    if not candidates:
        return {}
    table = candidates[0]
    roles = _header_roles(table)

    out = {}
    for tr in table.find_all("tr"):
        tds = tr.find_all(["td", "th"])
        cells = [c.get_text(" ", strip=True) for c in tds]
        if not cells: continue
        first = cells[0].lower()
        if any(h in first for h in ["fecha", "mes"]): 
            continue

        if not roles or len(roles) < len(cells):
            roles = ["fecha"] + [""] * (len(cells) - 1)

        dkey = _parse_date(cells[0])
        if not dkey: continue

        rec = {
            "date": dkey,
            "ipc_base2016": None,
            "ipc_base2007": None,
            "infl_mom": None,
            "infl_ytd": None,
            "infl_yoy": None,
        }

        for idx, raw in enumerate(cells):
            role = roles[idx] if idx < len(roles) else ""
            if idx > 0 and role == "":
                if "%" in raw:
                    if rec["infl_mom"] is None: role = "mensual"
                    elif rec["infl_ytd"] is None: role = "acumulada"
                    else: role = "anual"
                else:
                    role = "ipc2016" if rec["ipc_base2016"] is None else ("ipc2007" if rec["ipc_base2007"] is None else "")

            if role == "ipc2016": rec["ipc_base2016"] = _norm_num(raw)
            elif role == "ipc2007": rec["ipc_base2007"] = _norm_num(raw)
            elif role == "mensual": rec["infl_mom"] = _norm_num(raw)
            elif role == "acumulada": rec["infl_ytd"] = _norm_num(raw)
            elif role == "anual": rec["infl_yoy"] = _norm_num(raw)

        if any(rec[k] is not None for k in ["ipc_base2016","ipc_base2007","infl_mom","infl_ytd","infl_yoy"]):
            out[dkey] = rec
    return out

def fetch_all_pages():
    merged = {}
    for p in range(0, MAX_PAGES):
        url = BASE_URL if p == 0 else PAGE_URL.format(page=p)
        html = fetch(url)
        chunk = parse_table(html)
        if not chunk:
            break
        merged.update(chunk)
    return merged

def read_existing(path):
    if not path.exists(): return {}
    out = {}
    with path.open("r", newline="", encoding="utf-8") as f:
        rd = csv.DictReader(f)
        for r in rd:
            out[r["date"]] = r
    return out

def month_iter(d0: date, d1: date):
    y, m = d0.year, d0.month
    while (y < d1.year) or (y == d1.year and m <= d1.month):
        yield date(y, m, 1)
        m += 1
        if m == 13:
            m = 1
            y += 1

def _fmt(x, dec):
    return "" if x is None else f"{x:.{dec}f}"

def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "date",
        "ipc_base2016",
        "ipc_base2007",
        "infl_mom",
        "infl_ytd",
        "infl_yoy",
        "source_url",
        "fetched_at"
    ]
    rows_sorted = sorted(rows, key=lambda r: r["date"])
    with path.open("w", newline="", encoding="utf-8") as f:
        wr = csv.DictWriter(f, fieldnames=fieldnames)
        wr.writeheader()
        for r in rows_sorted:
            wr.writerow(r)

def main():
    fetched_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    parsed_all = fetch_all_pages()
    if not parsed_all:
        raise RuntimeError("No rows parsed from BCB pages")

    latest_key = max(parsed_all.keys())
    latest_dt = datetime.fromisoformat(latest_key).date()

    existing = read_existing(CSV_PATH)
    merged = {**existing}

    for d, r in parsed_all.items():
        prev = merged.get(d, {})
        merged[d] = {
            **prev,
            "date": d,
            "ipc_base2016": _fmt(r["ipc_base2016"], 2) if r["ipc_base2016"] is not None else (prev.get("ipc_base2016") or ""),
            "ipc_base2007": _fmt(r["ipc_base2007"], 2) if r["ipc_base2007"] is not None else (prev.get("ipc_base2007") or ""),
            "infl_mom": _fmt(r["infl_mom"], 6) if r["infl_mom"] is not None else (prev.get("infl_mom") or ""),
            "infl_ytd": _fmt(r["infl_ytd"], 6) if r["infl_ytd"] is not None else (prev.get("infl_ytd") or ""),
            "infl_yoy": _fmt(r["infl_yoy"], 6) if r["infl_yoy"] is not None else (prev.get("infl_yoy") or ""),
            "source_url": BASE_URL,
            "fetched_at": fetched_at
        }

    for dt in month_iter(BACKFILL_START, latest_dt):
        key = f"{dt.year:04d}-{dt.month:02d}-01"
        if key not in merged:
            merged[key] = {
                "date": key,
                "ipc_base2016": "",
                "ipc_base2007": "",
                "infl_mom": "",
                "infl_ytd": "",
                "infl_yoy": "",
                "source_url": BASE_URL,
                "fetched_at": fetched_at
            }

    write_csv(CSV_PATH, list(merged.values()))

    latest_date = max(merged.keys())
    latest = merged[latest_date]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with LATEST_JSON.open("w", encoding="utf-8") as f:
        json.dump(latest, f, ensure_ascii=False, indent=2)

    print(f"[bcb_inflation] wrote {CSV_PATH} ({len(merged)} rows); latest={latest_date}")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[bcb_inflation] ERROR: {e}", file=sys.stderr)
        sys.exit(1)
