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
ROWS  = 20
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
        "countries": COUNTRIES,
        "proMerchantAds": False,
        "shieldMerchantAds": False,
        "filterType": "all",
        "publisherType": None,
        "additionalKycVerifyFilter": 0,
        "classifies": ["mass", "profession"],
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
        # Some variants have nested 'data' or 'records'
        for key in ("data", "records", "advertises", "list"):
            if key in obj:
                prices.extend(extract_prices_from_data_obj(obj[key]))
    return prices

def fetch_side(trade_type: str) -> List[float]:
    payload = build_payload(trade_type)
    for url in ENDPOINTS:
        j = try_post(url, payload)
        if not j:
            continue
        data = j.get("data")
        if data is None:
            pass
        prices = extract_prices_from_data_obj(data)
        if prices:
            return prices
        else:
            first_keys = list(j.keys())[:6]
            print(f"[debug] {url} returned 200 but no adv.price found. top_keys={first_keys}")
    raise RuntimeError(f"No prices found for tradeType={trade_type}. Try a different network/VPN or adjust headers.")

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
