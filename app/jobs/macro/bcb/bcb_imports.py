import re
import math
from pathlib import Path
from functools import reduce

import pandas as pd


SRC_XLSX = Path("data/macro/bcb_excels/24.xlsx") 
OUT_CSV  = Path("data/macro/clean/imports.csv")
OUT_CSV.parent.mkdir(parents=True, exist_ok=True)


MONTH_MAP = {
    "ENE": 1, "FEB": 2, "MAR": 3, "ABR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AGO": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DIC": 12,
}

def _squash_spaces(s: str) -> str:
    """
    Collapse whitespace; if it's just letters separated by spaces (e.g. 'T O T A L'),
    remove the spaces completely.
    """
    s = re.sub(r"\s+", " ", s.strip())
    if re.fullmatch(r"(?:[A-Za-zÁÉÍÓÚÜÑ]\s+)+[A-Za-zÁÉÍÓÚÜÑ]", s):
        s = s.replace(" ", "")
    return s

def _norm_month(x):
    if not isinstance(x, str):
        return None
    s = x.strip().upper()
    s = re.sub(r"\s*\(.*?\)", "", s)
    return s if s in MONTH_MAP else None

def looks_like_year(cell) -> bool:
    if cell is None:
        return False
    if isinstance(cell, float) and math.isnan(cell):
        return False
    if isinstance(cell, str) and cell.strip() == "":
        return False
    if isinstance(cell, (int, float)):
        try:
            y = int(round(float(cell)))
        except Exception:
            return False
        return 1900 <= y <= 2099
    if isinstance(cell, str):
        return bool(re.search(r"(19|20)\d{2}", cell.strip()))
    return False

def extract_year(cell) -> int | None:
    """Pull a 4-digit year out of the cell if possible."""
    if isinstance(cell, (int, float)) and not (isinstance(cell, float) and math.isnan(cell)):
        try:
            y = int(round(float(cell)))
            if 1900 <= y <= 2099:
                return y
        except Exception:
            return None
    m = re.search(r"(19|20)\d{2}", str(cell))
    return int(m.group(0)) if m else None

def parse_value_series(
    df: pd.DataFrame,
    start_row_1idx: int,
    year_col_idx: int,
    month_col_idx: int,
    value_col_idx: int,
) -> pd.DataFrame:
    """
    Generic parser: find a 'year' row in year_col_idx, then consume following
    month rows (month_col_idx) and extract values from value_col_idx.
    """
    i = start_row_1idx - 1
    n = len(df)
    out: list[dict] = []

    while i < n:
        while i < n and not looks_like_year(df.iat[i, year_col_idx]):
            i += 1
        if i >= n:
            break

        year = extract_year(df.iat[i, year_col_idx])
        if year is None:
            i += 1
            continue

        months_rows: list[tuple[int, int]] = []
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
            i += 1
            continue

        for ridx, mnum in months_rows:
            val = pd.to_numeric(df.iat[ridx, value_col_idx], errors="coerce")
            out.append({"year": year, "month": mnum, "value": val})

        i = j

    return pd.DataFrame.from_records(out)


def run():
    raw = pd.read_excel(SRC_XLSX, header=None, dtype=object)

    titles: dict[int, str] = {
        2:  "BienesConsumo_NoDuradero",
        3:  "BienesConsumo_Duradero",
        4:  "BienesConsumo_Total",

        5:  "MateriasPrimas_CombustiblesYLubricantes",
        6:  "MateriasPrimas_ParaAgricultura",
        7:  "MateriasPrimas_ParaIndustria",
        8:  "MateriasPrimas_MaterialesConstruccion",
        9:  "MateriasPrimas_PartesAccesoriosEquipoTransporte",

        10: "BienesCapital_Total",
        11: "BienesCapital_ParaAgricultura",
        12: "BienesCapital_ParaIndustria",
        13: "BienesCapital_EquipoTransporte",
        14: "BienesCapital_TotalAmpliado",

        15: "Diversos_Total",

        16: "TotalImportaciones_CIF",
        17: "TotalImportaciones_FOB",
        18: "Importaciones_ParaTransformacion",
        19: "ImportacionesTemporales_VehiculosYAeronaves",
        20: "TotalImportaciones_CIF2",
        21: "TotalImportaciones_FOBAjustado_MillonesUSD",
    }

    parse_cols = sorted(titles.keys())
    series_dfs: list[pd.DataFrame] = []

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

        name = titles[cidx]
        dfc[name] = dfc["value"]
        dfc = dfc[["year", "month", name]]
        series_dfs.append(dfc)

    if not series_dfs:
        raise RuntimeError("No valid series extracted for imports")

    merged = reduce(
        lambda l, r: pd.merge(l, r, on=["year", "month"], how="outer"),
        series_dfs,
    )

    merged = merged.dropna(subset=["year", "month"], how="any").copy()
    merged["year"] = merged["year"].astype(int)
    merged["month"] = merged["month"].astype(int)
    merged["date"] = pd.to_datetime(
        merged["year"].astype(str) + "-" + merged["month"].astype(str) + "-01"
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
