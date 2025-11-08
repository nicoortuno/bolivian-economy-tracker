import requests, statistics, sys, time
import os
import pandas as pd
from typing import List, Optional
from datetime import datetime
import pytz


ENDPOINTS = [
    "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
]

HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Origin": "https://p2p.binance.com",
    "Referer": "https://p2p.binance.com/",
    "User-Agent": "Mozilla/5.0",
    "ClientType": "web",
    "C2CType": "c2c_web",
}

FIAT = "BOB"
ASSET = "USDT"
ROWS = 20    
MAX_PAGES = 50     
PAGE_SLEEP = 0.25 
TRANS_AMOUNT = None
COUNTRIES = ["BO"]
PAY_TYPES: List[str] = []  

def build_payload(trade_type: str) -> dict:
    p = {
        "fiat": FIAT,
        "asset": ASSET,
        "tradeType": trade_type,
        "page": 1,
        "rows": ROWS,
        "payTypes": PAY_TYPES,
        "proMerchantAds": False,
        "shieldMerchantAds": False,
        "filterType": "all",
        "publisherType": None,
        "additionalKycVerifyFilter": 0,
    }
    if TRANS_AMOUNT:
        p["transAmount"] = TRANS_AMOUNT
    return p

def try_post(url: str, payload: dict, timeout: int = 20) -> Optional[dict]:
    r = requests.post(url, headers=HEADERS, json=payload, timeout=timeout)
    if r.status_code != 200:
        print(f"[debug] {url} -> {r.status_code} {r.text[:160]}")
        return None
    try:
        return r.json()
    except Exception as e:
        print(f"[debug] {url} -> invalid JSON: {e}")
        return None

def extract_prices_from_data_obj(obj) -> List[float]:
    """Return a list of floats found at adv.price in a list/dict returned under 'data'."""
    prices: List[float] = []
    if isinstance(obj, list):
        for it in obj:
            try:
                adv = it.get("adv", {})
                if "price" in adv:
                    prices.append(float(adv["price"]))
            except Exception:
                continue
    elif isinstance(obj, dict):
        for key in ("data", "records", "advertises", "list"):
            if key in obj:
                prices.extend(extract_prices_from_data_obj(obj[key]))
    return prices

def fetch_side(trade_type: str) -> List[float]:
    """
    Fetch ALL visible offers for the given side by paging through results.
    trade_type: "BUY" (you buy USDT with BOB) or "SELL" (you sell USDT for BOB).
    Returns a flat list of adv.price floats across all pages.
    """
    page = 1
    all_prices: List[float] = []
    while page <= MAX_PAGES:
        payload = build_payload(trade_type)
        payload["page"] = page
        payload["rows"] = ROWS

        page_prices: List[float] = []
        got_any = False

        last_err = None
        for url in ENDPOINTS:
            j = try_post(url, payload)
            if not j:
                continue

            data = j.get("data")
            if data is None:
                pass

            prices = extract_prices_from_data_obj(data)
            if prices:
                got_any = True
                page_prices = prices
                break
            else:
                top_keys = list(j.keys())[:6]
                print(f"[debug] page {page} -> 200 but no adv.price found. keys={top_keys}")

        if not got_any:
            break

        all_prices.extend(page_prices)

        if len(page_prices) < ROWS:
            break

        page += 1
        time.sleep(PAGE_SLEEP)

    if not all_prices:
        raise RuntimeError(
            f"No prices found for tradeType={trade_type} across pages 1..{page-1}. "
            "Try adjusting headers, VPN, or payload filters (payTypes/countries)."
        )

    return all_prices

def median(xs: List[float]) -> Optional[float]:
    return statistics.median(xs) if xs else None

def main():
    eastern = pytz.timezone("America/New_York")
    started = datetime.now(eastern).strftime("%Y-%m-%d %H:%M:%S %Z")
    buy_prices  = fetch_side("BUY") 
    sell_prices = fetch_side("SELL")

    buy_med  = median(buy_prices)
    sell_med = median(sell_prices)
    mid = round((buy_med + sell_med) / 2, 4) if (buy_med and sell_med) else None

    out = {
        "ts": started,
        "buy_page_BOB_per_USDT": {
            "count": len(buy_prices),
            "min": min(buy_prices),
            "median": buy_med,
            "max": max(buy_prices),
        },
        "sell_page_BOB_per_USDT": {
            "count": len(sell_prices),
            "min": min(sell_prices),
            "median": sell_med,
            "max": max(sell_prices),
        },
        "mid_BOB_per_USDT": mid
    }

    CSV_PATH = "data/bob_p2p_history.csv"
    os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)

    COLS = [
        "ts",
        "buy_count", "buy_min", "buy_median", "buy_max",
        "sell_count", "sell_min", "sell_median", "sell_max",
        "mid_BOB_per_USDT",
    ]

    new_row = {
        "ts": started,
        "buy_count": len(buy_prices),
        "buy_min": min(buy_prices),
        "buy_median": buy_med,
        "buy_max": max(buy_prices),
        "sell_count": len(sell_prices),
        "sell_min": min(sell_prices),
        "sell_median": sell_med,
        "sell_max": max(sell_prices),
        "mid_BOB_per_USDT": mid,
    }

    file_has_data = os.path.exists(CSV_PATH) and os.path.getsize(CSV_PATH) > 0
    if file_has_data:
        try:
            df = pd.read_csv(CSV_PATH)
        except Exception:
            df = pd.DataFrame(columns=COLS)
    else:
        df = pd.DataFrame(columns=COLS)

    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
    df.to_csv(CSV_PATH, index=False)
    print(f"[logger] Appended new row to {CSV_PATH}")

    print(out)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR:", e)
        sys.exit(1)
