import json
import re
import ssl
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from pypdf import PdfReader

ROOT_DIR = Path("/Users/shubhamsharma/Downloads/Credit Card")
RAW_DIR = ROOT_DIR / "data" / "raw"
PDF_DIR = RAW_DIR / "banks" / "pdfs"
PDF_DIR.mkdir(parents=True, exist_ok=True)


def slugify(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", text).strip("_")[:110]


def select_high_value_pdfs() -> list[tuple[str, str]]:
    banks_file = RAW_DIR / "banks" / "banks_extracted.json"
    data = json.loads(banks_file.read_text(encoding="utf-8"))
    picked = []
    seen = set()
    keywords = ("lounge", "airport", "railway", "mitc", "sosc", "tariff", "most-important", "priority-pass", "tnc")
    for rec in data:
        bank = rec.get("bank_key", "bank")
        for url in rec.get("pdf_links", []):
            ul = url.lower()
            # skip regional-language duplicates of IDFC MITC to keep signal clean
            if any(lang in ul for lang in ("assamese", "bengali", "gujarati", "hindi", "kannada", "marathi", "punjabi", "konkani", "malayalam", "oriya", "tamil", "telugu", "urdu")):
                continue
            if "in.review.visa.com" in ul:
                continue
            if any(k in ul for k in keywords) and url not in seen:
                seen.add(url)
                picked.append((bank, url))
    return picked


def run_pdf_extractor():
    targets = select_high_value_pdfs()
    print(f"[PDFs] Downloading & extracting {len(targets)} official bank/network PDFs...", flush=True)

    extracted = []
    for bank, url in targets:
        fname = slugify(f"{bank}_{Path(urlparse(url).path).name or urlparse(url).query}")
        if not fname.endswith(".pdf"):
            pdf_path = PDF_DIR / f"{fname}.pdf"
        else:
            pdf_path = PDF_DIR / fname
        txt_path = PDF_DIR / f"{fname.replace('.pdf', '')}.txt"
        try:
            req = Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
            with urlopen(req, timeout=25) as resp:
                data = resp.read()
            if not data.startswith(b"%PDF"):
                print(f"[PDFs] Skip non-PDF payload: {url}", flush=True)
                continue
            pdf_path.write_bytes(data)
            reader = PdfReader(str(pdf_path))
            pages_text = []
            for idx, page in enumerate(reader.pages[:40], start=1):
                t = page.extract_text() or ""
                if t.strip():
                    pages_text.append(f"--- Page {idx} ---\n{t.strip()}")
            full_text = "\n\n".join(pages_text)
            txt_path.write_text(full_text, encoding="utf-8")
            extracted.append({
                "bank_key": bank,
                "url": url,
                "num_pages": len(reader.pages),
                "text_length": len(full_text),
                "txt_file": str(txt_path),
                "category": "lounge_list" if any(k in url.lower() for k in ("lounge", "airport", "railway", "priority")) else "mitc_fees",
            })
            print(f"[PDFs] OK {bank}: {pdf_path.name} ({len(reader.pages)} pages, {len(full_text)} chars)", flush=True)
        except Exception as e:
            print(f"[PDFs] Warn {bank} ({url}): {e}", flush=True)

    out_json = PDF_DIR / "pdfs_extracted.json"
    out_json.write_text(json.dumps(extracted, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[PDFs] Saved {len(extracted)} extracted PDF records to {out_json}", flush=True)


if __name__ == "__main__":
    run_pdf_extractor()
