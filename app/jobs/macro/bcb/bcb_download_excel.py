import requests
import re
from pathlib import Path
from io import BytesIO
from PyPDF2 import PdfReader

INDEX_PDF_URL = "https://www.bcb.gob.bo/webdocs/publicacionesbcb/2025/11/25/%C3%8Dndice%20Boletin%20Mensual%20Septiembre%202025.pdf"
BASE_URL = "https://www.bcb.gob.bo/webdocs/publicacionesbcb/2025/11/25/"
DOWNLOAD_DIR = Path("data/macro/bcb_excels")

def extract_excel_links_from_pdf(pdf_bytes: bytes):
    reader = PdfReader(BytesIO(pdf_bytes))
    urls = []
    for page in reader.pages:
        if "/Annots" in page:
            for annot in page["/Annots"]:
                obj = annot.get_object()
                if "/A" in obj and "/URI" in obj["/A"]:
                    uri = obj["/A"]["/URI"]
                    if isinstance(uri, bytes):
                        uri = uri.decode("utf-8", errors="ignore")
                    if uri.lower().endswith((".xls", ".xlsx")):
                        urls.append(uri)
        text = page.extract_text() or ""
        urls += re.findall(r"https?://\S+?\.(?:xls|xlsx)", text, flags=re.IGNORECASE)
    return sorted(set(urls))

def main():
    print("📄 Downloading index PDF …")
    resp = requests.get(INDEX_PDF_URL, timeout=30)
    resp.raise_for_status()

    print("🔗 Extracting Excel links from PDF …")
    links = extract_excel_links_from_pdf(resp.content)
    print(f"Found {len(links)} Excel link(s)")

    for link in links:
        if not link.startswith("http"):
            link = BASE_URL + link.lstrip("./")
        fname = link.split("/")[-1]
        dest = DOWNLOAD_DIR / fname
        DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

        try:
            r = requests.get(link, timeout=30)
            r.raise_for_status()
            dest.write_bytes(r.content)
            print(f"Downloaded {fname}")
        except Exception as e:
            print(f"Failed {fname}: {e}")

    print("\n🎉 Done! All Excel files saved to:", DOWNLOAD_DIR.resolve())

if __name__ == "__main__":
    main()
