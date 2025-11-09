#!/usr/bin/env python3
"""
Fetch El Deber Economía articles and write:
  data/raw/news/eldeber/<YYYY-MM-DD>/<hash>.json
"""

import re, json, time, hashlib, argparse, datetime as dt
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from dateutil import parser as dtparse
import unicodedata
import zoneinfo


USER_AGENT = "BolivianEconomyTrackerBot/1.0 (+https://www.bolivianeconomytracker.com)"
HEADERS = {"User-Agent": USER_AGENT}
REQ_KW = dict(timeout=30)
SITEMAP_URL = "https://eldeber.com.bo/sitemap-news.xml"

RAW_BASE = Path("data/raw/news/eldeber")
ARTICLE_RE = re.compile(r"^https?://eldeber\.com\.bo/economia/[^/]+_\d+/?$", re.I)

_ES_MONTHS = {
    "enero":1, "febrero":2, "marzo":3, "abril":4, "mayo":5, "junio":6,
    "julio":7, "agosto":8, "septiembre":9, "setiembre":9, "octubre":10,
    "noviembre":11, "diciembre":12,
}
_ES_WEEKDAYS = {"lunes","martes","miercoles","miércoles","jueves","viernes","sabado","sábado","domingo"}

_ES_DT_RE = re.compile(
    r"(?:(?P<wday>[A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s*,\s*)?"
    r"(?P<day>\d{1,2})\s+de\s+(?P<month>[A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s+de\s+(?P<year>\d{4})"
    r"(?:\s*(?:a\s+las\s+)?(?P<hour>\d{1,2}):(?P<minute>\d{2}))?",
    re.IGNORECASE
)

def _parse_spanish_datetime(text: str) -> str | None:
    """
    Parse Spanish date strings like:
      'Sábado, 08 de noviembre de 2025 a las 19:33'
    Return ISO8601 (UTC naive) string, or None.
    """
    if not text:
        return None
    m = _ES_DT_RE.search(text)
    if not m:
        return None

    day = int(m.group("day"))
    month_name = unicodedata.normalize("NFKD", m.group("month")).encode("ascii","ignore").decode("ascii").lower()
    month = _ES_MONTHS.get(month_name)
    if not month:
        return None
    year = int(m.group("year"))
    hour = int(m.group("hour") or 0)
    minute = int(m.group("minute") or 0)

    try:
        tz = zoneinfo.ZoneInfo("America/La_Paz")
    except Exception:
        tz = dt.timezone(dt.timedelta(hours=-4))

    dt_local = dt.datetime(year, month, day, hour, minute, tzinfo=tz)
    return dt_local.isoformat() 

def sha16(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]

def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def fetch(url: str) -> requests.Response:
    r = requests.get(url, headers=HEADERS, allow_redirects=True, **REQ_KW)
    if not r.encoding or r.encoding.lower() == "iso-8859-1":
        try:
            r.encoding = r.apparent_encoding
        except Exception:
            pass
    return r

def _norm(s: str) -> str:
    s2 = unicodedata.normalize("NFKD", s).encode("ascii","ignore").decode("ascii")
    return re.sub(r"\s+", " ", s2).strip().lower()

def parse_sitemap_xml(xml_text: str):
    soup = BeautifulSoup(xml_text, "xml")
    for url in soup.find_all("url"):
        loc = url.loc.get_text(strip=True) if url.loc else None
        lastmod = url.lastmod.get_text(strip=True) if url.lastmod else None
        if loc:
            yield {"url": loc, "lastmod": lastmod}

def iter_economia_article_urls():
    r = fetch(SITEMAP_URL); r.raise_for_status()
    for item in parse_sitemap_xml(r.text):
        u = item["url"]
        if ARTICLE_RE.match(u):
            yield u, item.get("lastmod")

def extract_article(url: str):
    if not ARTICLE_RE.match(url):
        return None
    r = fetch(url)
    if r.status_code != 200 or not r.text:
        return None
    soup = BeautifulSoup(r.text, "html.parser")

    title = None
    ogt = soup.find("meta", property="og:title")
    if ogt and ogt.get("content"):
        title = ogt["content"].strip()
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(" ", strip=True)
    if not title and soup.title:
        title = soup.title.get_text(" ", strip=True)
    if title:
        title = re.sub(r"\s*\|\s*EL\s*DEBER.*$", "", title, flags=re.I).strip()

    published_at: str | None = None

    for sel, attr in [
        ('meta[property="article:published_time"]', "content"),
        ('meta[name="pubdate"]', "content"),
        ('meta[name="date"]', "content"),
        ("time", "datetime"),
    ]:
        tag = soup.select_one(sel)
        if tag and tag.get(attr):
            try:
                published_at = dtparse.parse(tag.get(attr).strip()).astimezone(dt.timezone.utc).isoformat()
                break
            except Exception:
                pass

    if not published_at:
        candidates = []
        for sel in [
            "header", ".articulo__header", ".articulo__meta", ".articulo__fecha",
            ".nota__fecha", ".notapage__container", "article"
        ]:
            for node in soup.select(sel):
                txt = node.get_text(" ", strip=True)
                if txt:
                    candidates.append(txt)
        candidates.append(soup.get_text(" ", strip=True))

        for txt in candidates:
            if re.search(r"(publicado|actualizado|fecha|sabado|sábado|domingo|lunes|martes|miercoles|miércoles|jueves|viernes)", txt, re.I):
                iso = _parse_spanish_datetime(txt)
                if iso:
                    published_at = iso
                    break

    article = soup.select_one("div.notapage__container article.articulo") \
              or soup.select_one("article.articulo") \
              or soup.find("article")
    if not article:
        return None

    for sel in [
        "aside", ".link-nota-propia", ".mas-leidas", ".ultimas-noticias",
        ".tags", ".container-spot", ".ads", "[id*='ad-']", "[class*='ad-']",
        "nav", "footer", "header"
    ]:
        for n in article.select(sel):
            try: n.decompose()
            except Exception: pass

    body = article.select_one("main.articulo__cuerpo") or article
    BAD_ANCESTOR = {"link-nota-propia","mas-leidas","ultimas-noticias","tags","container-spot","ads","advertising"}

    def has_bad_ancestor(node):
        cur, hops = node.parent, 0
        while cur is not None and hops < 12:
            if cur.name in ("aside","nav","footer","header"): return True
            clz = cur.get("class", []) if hasattr(cur, "get") else []
            if any(c in BAD_ANCESTOR for c in clz): return True
            cur = cur.parent; hops += 1
        return False

    raw = []
    for p in body.find_all("p"):
        t = p.get_text(" ", strip=True)
        if t and len(t) >= 20 and not has_bad_ancestor(p): raw.append(t)

    BAD_PREFIX = ("¿quiere recibir notificaciones","quiere recibir notificaciones","clasificados","mustang cloud","copyright")
    paras = [t for t in raw if not _norm(t).startswith(BAD_PREFIX)]

    def looks_like_headline(s: str) -> bool:
        ns = _norm(s); return (len(ns) <= 80 and "." not in ns)

    trimmed, short_streak = [], 0
    for t in paras:
        if looks_like_headline(t): short_streak += 1
        else: short_streak = 0
        if short_streak >= 2: break
        trimmed.append(t)

    text = "\n\n".join(trimmed[:40])
    if not title and not text: return None

    return {
        "source": "El Deber",
        "section": "Economía",
        "url": url,
        "title": title,
        "published_at": published_at,                      
        "fetched_at": dt.datetime.utcnow().isoformat() + "Z",
        "text": text,
    }

def _day_from_iso(s: str | None) -> str | None:
    if not s: return None
    try:
        return dtparse.parse(s).date().isoformat()
    except Exception:
        return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=30)
    ap.add_argument("--since-hours", type=int, default=72)
    ap.add_argument("--sleep-ms", type=int, default=800)
    args = ap.parse_args()

    cutoff = None
    if args.since_hours and args.since_hours > 0:
        cutoff = dt.datetime.utcnow() - dt.timedelta(hours=args.since_hours)

    picked = []
    for url, lastmod in iter_economia_article_urls():
        if cutoff and lastmod:
            try:
                lm = dtparse.parse(lastmod)
                if lm.tzinfo is None: lm = lm.replace(tzinfo=dt.timezone.utc)
                if lm < cutoff.replace(tzinfo=lm.tzinfo): continue
            except Exception:
                pass
        picked.append(url)
        if len(picked) >= args.limit: break

    saved = 0
    for url in picked:
        h = sha16(url)
        art = extract_article(url)
        if not art or (not art.get("title") and not art.get("text")): continue

        day = _day_from_iso(art.get("published_at")) \
           or _day_from_iso(art.get("fetched_at")) \
           or dt.datetime.utcnow().date().isoformat()

        out_dir = RAW_BASE / day
        ensure_dir(out_dir)
        (out_dir / f"{h}.json").write_text(json.dumps(art, ensure_ascii=False, indent=2))
        saved += 1
        time.sleep(args.sleep_ms / 1000.0)

    print(f"[eldeber] saved={saved} into {RAW_BASE}")

if __name__ == "__main__":
    main()
