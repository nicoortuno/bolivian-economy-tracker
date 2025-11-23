import re
from pathlib import Path
from functools import reduce
import pandas as pd
from pandas.tseries.offsets import MonthEnd

SRC_XLSX = Path("data/macro/bcb_excels/23.xlsx")
OUT_CSV  = Path("data/macro/clean/exports.csv")
OUT_CSV.parent.mkdir(parents=True, exist_ok=True)

MONTH_MAP = {
    "ENE": 1, "FEB": 2, "MAR": 3, "ABR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AGO": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DIC": 12,
}


def _squash_spaces(s: str) -> str:
    """Collapse whitespace and collapse spaced-out letters."""
    s = re.sub(r"\s+", " ", s.strip())
    if re.fullmatch(r"(?:[A-Za-zÁÉÍÓÚÜÑ]\s+)+[A-Za-zÁÉÍÓÚÜÑ]", s):
        s = s.replace(" ", "")
    return s


def _norm_month(x):
    """Normalize 'ENE', 'FEB', etc."""
    if not isinstance(x, str):
        return None
    s = x.strip().upper()
    s = re.sub(r"\s*\(.*?\)", "", s)
    return s if s in MONTH_MAP else None


def looks_like_year(cell) -> bool:
    """Identify if a cell looks like a year."""
    if cell is None:
        return False
    if isinstance(cell, float) and pd.isna(cell):
        return False
    if isinstance(cell, str) and cell.strip() == "":
        return False
    if isinstance(cell, (int, float)):
        try:
            y = int(round(float(cell)))
            return 1900 <= y <= 2099
        except Exception:
            return False
    if isinstance(cell, str):
        return bool(re.search(r"(19|20)\d{2}", cell.strip()))
    return False


def extract_year(cell) -> int | None:
    """Extract 4-digit year from a cell."""
    if isinstance(cell, (int, float)) and not pd.isna(cell):
        try:
            y = int(round(float(cell)))
            if 1900 <= y <= 2099:
                return y
        except Exception:
            return None

    m = re.search(r"(19|20)\d{2}", str(cell))
    return int(m.group(0)) if m else None


def merged_title_from_rows(df: pd.DataFrame,
                           col_idx: int,
                           row_start_1idx: int,
                           row_end_1idx: int) -> str:
    """Build a column title by merging multiple header rows."""
    r0 = row_start_1idx - 1
    r1 = row_end_1idx
    parts = []
    for v in df.iloc[r0:r1, col_idx].tolist():
        if pd.isna(v):
            continue
        s = _squash_spaces(str(v))
        if s:
            parts.append(s)

    title = " ".join(parts).replace("\n", " ").strip()
    title = re.sub(r"[()]", "", title)
    title = re.sub(r"\s+", " ", title).strip()
    return title or f"col_{col_idx}"


def parse_value_series(df: pd.DataFrame,
                       start_row_1idx: int,
                       year_col_idx: int,
                       month_col_idx: int,
                       value_col_idx: int) -> pd.DataFrame:
    """Parse a time series from the messy BCB Excel structure."""
    n = len(df)
    i = start_row_1idx - 1
    out = []

    while i < n:
        while i < n and not looks_like_year(df.iat[i, year_col_idx]):
            i += 1
        if i >= n:
            break

        year = extract_year(df.iat[i, year_col_idx])
        if year is None:
            i += 1
            continue

        months_rows = []
        j = i + 1

        while j < n:
            if looks_like_year(df.iat[j, year_col_idx]) and months_rows:
                break

            mlabel = _norm_month(df.iat[j, month_col_idx])
            if mlabel is None:
                j += 1
                continue

            months_rows.append((j, MONTH_MAP[mlabel]))

            if mlabel == "DIC":
                j += 1
                break

            if len(months_rows) > 12:
                break

            j += 1

        if not months_rows:
            i = j
            continue

        for ridx, mnum in months_rows:
            val = pd.to_numeric(df.iat[ridx, value_col_idx], errors="coerce")
            out.append({"year": year, "month": mnum, "value": val})

        i = j

    return pd.DataFrame.from_records(out)


def run():
    raw = pd.read_excel(SRC_XLSX, header=None, dtype=object)

    titles = {}

    for c in range(2, 8):
        titles[c] = merged_title_from_rows(raw, c, 8, 8)

    titles[8] = merged_title_from_rows(raw, 8, 8, 9)

    for c in (9, 10, 11):
        titles[c] = merged_title_from_rows(raw, c, 8, 8)

    for c in range(12, 18):
        titles[c] = merged_title_from_rows(raw, c, 8, 8)

    titles[18] = merged_title_from_rows(raw, 18, 6, 9)

    for c in range(19, 24):
        titles[c] = merged_title_from_rows(raw, c, 6, 7)

    rename_overrides = {
        6:  "Otros Minerales",
        7:  "Total Minerales",
        10: "Otros Hidrocarburos",
        11: "Total Hidrocarburos",
        16: "Otros No Tradicionales",
        17: "Total No Tradicionales",
        18: "Otros Bienes",
        19: "Total Declarado",
        20: "Bienes para Transformacion",
        21: "Fletes y Seguros",
        22: "Compra Venta Neto",
        23: "FOB",
    }
    for c, nice in rename_overrides.items():
        if c in titles:
            titles[c] = nice

    parse_cols = (
        list(range(2, 8)) +
        [8, 9, 10, 11] +
        list(range(12, 18)) +
        [18] +
        list(range(19, 24))
    )

    series_dfs = []

    for cidx in parse_cols:
        dfc = parse_value_series(
            raw,
            start_row_1idx=10,
            year_col_idx=1,
            month_col_idx=1,
            value_col_idx=cidx,
        )

        if dfc.empty:
            continue

        col_name = titles.get(cidx, f"col_{cidx}")
        dfc[col_name] = dfc["value"]
        dfc = dfc[["year", "month", col_name]]
        series_dfs.append(dfc)

    if not series_dfs:
        raise RuntimeError("No valid series extracted for exports")

    merged = reduce(lambda l, r: pd.merge(l, r, on=["year", "month"], how="outer"),
                    series_dfs)

    merged = merged.dropna(subset=["year", "month"])
    merged["year"] = merged["year"].astype(int)
    merged["month"] = merged["month"].astype(int)

    merged["date"] = (
        pd.to_datetime(dict(year=merged["year"], month=merged["month"], day=1))
        + MonthEnd(0)
    )

    value_cols = [c for c in merged.columns if c not in {"date", "year", "month"}]

    merged = (
        merged[["date", "year", "month"] + value_cols]
        .sort_values("date")
        .reset_index(drop=True)
    )

    merged = merged.loc[:, ~merged.columns.str.startswith("Unnamed")]
    merged = merged.dropna(axis=1, how="all")

    merged.to_csv(OUT_CSV, index=False)
    print(f"[OK] Wrote {OUT_CSV} with {len(merged)} rows and {len(value_cols)} series.")
    print("Columns included:")
    for c in merged.columns:
        if c not in ("date", "year", "month"):
            print(" -", c)


if __name__ == "__main__":
    run()
