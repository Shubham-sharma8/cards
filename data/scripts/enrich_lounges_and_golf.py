#!/usr/bin/env python3
"""Enrich Indian Airport Lounges & Golf Courses with verified Google Places ratings,
Maps URLs, and downloaded real photographs (never AI-generated).

Requires GOOGLE_MAPS_MASTER_KEY in environment variables.
"""
import concurrent.futures
import json
import os
import re
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOUNGE_MASTER_PATH = ROOT / "data/master/lounge_access_master.json"
GOLF_MASTER_PATH = ROOT / "data/master/golf_clubs_master.json"
WEB_LOUNGE_PHOTOS = ROOT / "web/public/lounge-photos"
WEB_GOLF_PHOTOS = ROOT / "web/public/golf-photos"

API_KEY = os.environ.get("GOOGLE_MAPS_MASTER_KEY", "").strip()
if not API_KEY:
    raise SystemExit("ERROR: Set GOOGLE_MAPS_MASTER_KEY environment variable before running.")

WEB_LOUNGE_PHOTOS.mkdir(parents=True, exist_ok=True)
WEB_GOLF_PHOTOS.mkdir(parents=True, exist_ok=True)


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


MISSING_AND_FIXED_LOUNGES = [
    # Fix BOM02 to match Visa PDF exactly (Adani Lounge T1B)
    {
        "sr": "52",
        "airport_city_and_lounge": "Chhatrapati Shivaji Maharaj International Airport Mumbai Adani Lounge (T1B)",
        "lounge_code": "BOM02",
        "terminal_type": "Domestic",
        "terminal_and_hours": "T1B Departure, First Floor opposite McDonald's. 24 Hours",
        "airport_code": "BOM",
        "city": "Mumbai",
        "terminal": "Terminal 1B (Domestic)",
        "lounge_name": "Adani Lounge (T1B Domestic)",
        "accepted_networks": ["Visa", "Mastercard", "RuPay", "Diners Club", "Amex"],
    },
    {
        "sr": "53",
        "airport_city_and_lounge": "Chhatrapati Shivaji Maharaj International Airport Mumbai Good Times Bar (T1B)",
        "lounge_code": "BOM03",
        "terminal_type": "Domestic",
        "terminal_and_hours": "Terminal 1B Domestic Departure, near Gate 9 opposite Coco Cart. 24 Hours",
        "airport_code": "BOM",
        "city": "Mumbai",
        "terminal": "Terminal 1B (Domestic)",
        "lounge_name": "Good Times Bar Lounge",
        "accepted_networks": ["Visa", "Mastercard", "RuPay"],
    },
    {
        "sr": "54",
        "airport_city_and_lounge": "Chhatrapati Shivaji Maharaj International Airport Mumbai Travel Club Lounge (T2 Domestic)",
        "lounge_code": "BOM04",
        "terminal_type": "Domestic",
        "terminal_and_hours": "Terminal 2 Domestic Departure, near Gate 44 Post SHA & Starbucks. 24 Hours",
        "airport_code": "BOM",
        "city": "Mumbai",
        "terminal": "Terminal 2 (T2D Domestic)",
        "lounge_name": "Travel Club Lounge (Terminal 2)",
        "accepted_networks": ["Visa", "Mastercard", "RuPay", "Diners Club", "Amex"],
    },
    {
        "sr": "55",
        "airport_city_and_lounge": "Chhatrapati Shivaji Maharaj International Airport Mumbai Adani Silver Lounge (T2 International)",
        "lounge_code": "BOM05",
        "terminal_type": "International",
        "terminal_and_hours": "Terminal 2 International Departure, Adani East Silver near Gate 45 & Duty Free after Immigration. 24 Hours",
        "airport_code": "BOM",
        "city": "Mumbai",
        "terminal": "Terminal 2 (T2I International)",
        "lounge_name": "Adani Silver Lounge (T2 International)",
        "accepted_networks": ["Visa", "Mastercard", "RuPay", "Diners Club", "Priority Pass"],
    },
    {
        "sr": "56",
        "airport_city_and_lounge": "Chhatrapati Shivaji Maharaj International Airport Mumbai Aviserv East Lounge",
        "lounge_code": "BOM07",
        "terminal_type": "Domestic",
        "terminal_and_hours": "Terminal 2 Arrivals Level P-6, near Exit Gate A & Gate C. 24 Hours",
        "airport_code": "BOM",
        "city": "Mumbai",
        "terminal": "Terminal 2 (Arrivals)",
        "lounge_name": "Aviserv East Arrival Lounge",
        "accepted_networks": ["Visa", "Mastercard", "RuPay"],
    },
    {
        "sr": "57",
        "airport_city_and_lounge": "Chhatrapati Shivaji Maharaj International Airport Mumbai Aviserv West Lounge",
        "lounge_code": "BOM08",
        "terminal_type": "Domestic",
        "terminal_and_hours": "Terminal 2 Arrivals Level P-6, near Exit Gate A & Gate C. 24 Hours",
        "airport_code": "BOM",
        "city": "Mumbai",
        "terminal": "Terminal 2 (Arrivals)",
        "lounge_name": "Aviserv West Arrival Lounge",
        "accepted_networks": ["Visa", "Mastercard", "RuPay"],
    },
    {
        "sr": "81",
        "airport_city_and_lounge": "Chhatrapati Shivaji Maharaj International Airport Mumbai Adani Business & Privé Lounge (T2 International)",
        "lounge_code": "BOM_PRIVE_T2I",
        "terminal_type": "International",
        "terminal_and_hours": "Terminal 2 International Departures (First Class / Business / Adani Business Privé Wing). 24 Hours",
        "airport_code": "BOM",
        "city": "Mumbai",
        "terminal": "Terminal 2 (T2I International)",
        "lounge_name": "Adani Business / Privé Lounge (T2 International)",
        "accepted_networks": ["Priority Pass", "Diners Club", "Visa", "Mastercard"],
    },
    {
        "sr": "82",
        "airport_city_and_lounge": "Chhatrapati Shivaji Maharaj International Airport Mumbai Loyalty Lounge (T2 International)",
        "lounge_code": "BOM_LOYALTY_T2I",
        "terminal_type": "International",
        "terminal_and_hours": "Terminal 2 International Departures, Post Security & Immigration. 24 Hours",
        "airport_code": "BOM",
        "city": "Mumbai",
        "terminal": "Terminal 2 (T2I International)",
        "lounge_name": "Loyalty Lounge (Terminal 2)",
        "accepted_networks": ["Priority Pass", "Diners Club", "Visa", "Mastercard"],
    },
    {
        "sr": "83",
        "airport_city_and_lounge": "Chhatrapati Shivaji Maharaj International Airport Mumbai American Express Lounge",
        "lounge_code": "BOM_AMEX_T2",
        "terminal_type": "International",
        "terminal_and_hours": "Terminal 2 International Departures (Amex Platinum Charge / Centurion). 24 Hours",
        "airport_code": "BOM",
        "city": "Mumbai",
        "terminal": "Terminal 2 (T2I International)",
        "lounge_name": "American Express Lounge (Mumbai T2)",
        "accepted_networks": ["Amex"],
    },
    {
        "sr": "84",
        "airport_city_and_lounge": "Rajiv Gandhi International Airport Hyderabad Encalm Privé International Lounge",
        "lounge_code": "HYD_PRIVE_I",
        "terminal_type": "International",
        "terminal_and_hours": "International Departures Airside after Immigration (Super-Premium / Business / Reserve cards). 24 Hours",
        "airport_code": "HYD",
        "city": "Hyderabad",
        "terminal": "International Terminal",
        "lounge_name": "Encalm Privé Lounge (International)",
        "accepted_networks": ["Priority Pass", "Visa", "Mastercard", "Diners Club"],
    },
    {
        "sr": "85",
        "airport_city_and_lounge": "Kempegowda International Airport Bengaluru 080 VIP Privé Lounge",
        "lounge_code": "BLR_PRIVE_T2",
        "terminal_type": "International",
        "terminal_and_hours": "Terminal 2 Departures (Reserve / Infinia / Emeralde Private / Priority Pass select issuers). 24 Hours",
        "airport_code": "BLR",
        "city": "Bengaluru",
        "terminal": "Terminal 2",
        "lounge_name": "080 VIP / Privé Lounge (Terminal 2)",
        "accepted_networks": ["Priority Pass", "Visa", "Mastercard", "Diners Club"],
    },
    {
        "sr": "86",
        "airport_city_and_lounge": "Lokpriya Gopinath Bordoloi International Airport Guwahati The Lounge (First Floor)",
        "lounge_code": "GAU02",
        "terminal_type": "Domestic",
        "terminal_and_hours": "Terminal 1 Domestic Departure, 1st Floor after Security Check. 24 Hours",
        "airport_code": "GAU",
        "city": "Guwahati",
        "terminal": "Terminal 1 (1st Floor)",
        "lounge_name": "The Lounge (1st Floor)",
        "accepted_networks": ["Visa", "Mastercard", "RuPay"],
    },
    {
        "sr": "87",
        "airport_city_and_lounge": "Cochin International Airport Kochi Earth Lounge",
        "lounge_code": "COK_EARTH",
        "terminal_type": "International",
        "terminal_and_hours": "Terminal 3 International Departures, Post Security & Immigration. 24 Hours",
        "airport_code": "COK",
        "city": "Kochi",
        "terminal": "Terminal 3 (T3I)",
        "lounge_name": "Earth Lounge (International T3)",
        "accepted_networks": ["Priority Pass", "Visa", "Mastercard", "Diners Club"],
    },
]

GOLF_CLUBS_LIST = [
    {"city": "Ahmedabad", "club_name": "Glade One Golf Resort & Club", "query": "Glade One Golf Resort Ahmedabad"},
    {"city": "Ahmedabad", "club_name": "Kensville Golf & Country Club", "query": "Kensville Golf & Country Club Ahmedabad"},
    {"city": "Ahmedabad", "club_name": "Gulmohar Greens Golf & Country Club", "query": "Gulmohar Greens Golf & Country Club Ahmedabad"},
    {"city": "Ahmedabad", "club_name": "Kalhaar Blues & Greens Golf Club", "query": "Kalhaar Blues and Greens Golf Club Ahmedabad"},
    {"city": "Bengaluru", "club_name": "Clover Greens Golf Club", "query": "Clover Greens Golf Club Bengaluru"},
    {"city": "Bengaluru", "club_name": "Prestige Augusta Golf Village", "query": "Prestige Augusta Golf Village Bengaluru"},
    {"city": "Bengaluru", "club_name": "Karnataka Golf Association (KGA)", "query": "Karnataka Golf Association Bengaluru"},
    {"city": "Delhi NCR", "club_name": "Classic Golf & Country Club", "query": "Classic Golf & Country Club Gurugram"},
    {"city": "Delhi NCR", "club_name": "Golden Greens Golf & Country Club", "query": "Golden Greens Golf & Country Club Gurugram"},
    {"city": "Delhi NCR", "club_name": "Jaypee Greens Golf & Spa Resort", "query": "Jaypee Greens Golf Course Greater Noida"},
    {"city": "Delhi NCR", "club_name": "Noida Golf Course", "query": "Noida Golf Course Sector 38A Noida"},
    {"city": "Delhi NCR", "club_name": "Qutab Golf Course", "query": "Qutab Golf Course New Delhi"},
    {"city": "Delhi NCR", "club_name": "Hamoni Golf Camp", "query": "Hamoni Golf Camp Gurugram"},
    {"city": "Mumbai", "club_name": "Bombay Presidency Golf Club (BPGC)", "query": "Bombay Presidency Golf Club Chembur Mumbai"},
    {"city": "Mumbai", "club_name": "Nine Aces Golf Greens & Academy", "query": "Nine Aces Golf Greens Mumbai"},
    {"city": "Mumbai", "club_name": "Willingdon Sports Club Golf Course", "query": "Willingdon Sports Club Golf Course Mumbai"},
    {"city": "Pune", "club_name": "Oxford Golf Resort", "query": "Oxford Golf Resort Pune"},
    {"city": "Pune", "club_name": "The Poona Club Golf Course", "query": "Poona Club Golf Course Pune"},
    {"city": "Pune", "club_name": "Aamby Valley Golf Course", "query": "Aamby Valley Golf Club Lonavala"},
    {"city": "Hyderabad", "club_name": "Boulder Hills Golf & Country Club", "query": "Boulder Hills Golf & Country Club Hyderabad"},
    {"city": "Hyderabad", "club_name": "Hyderabad Golf Association (HGA)", "query": "Hyderabad Golf Association Golconda"},
    {"city": "Goa", "club_name": "The LaLiT Golf & Spa Resort Goa", "query": "The Lalit Golf Resort Canacona Goa"},
    {"city": "Jaipur", "club_name": "Rambagh Golf Club", "query": "Rambagh Golf Club Jaipur"},
    {"city": "Kochi", "club_name": "CIAL Golf & Country Club", "query": "CIAL Golf and Country Club Nedumbassery Kochi"},
    {"city": "Kolkata", "club_name": "The Tollygunge Club Golf", "query": "Tollygunge Club Golf Course Kolkata"},
    {"city": "Chennai", "club_name": "Cosmopolitan Club TNGF Golf", "query": "TNGF Cosmo Golf Course Chennai"},
    {"city": "Chandigarh", "club_name": "Chandigarh Golf Club", "query": "Chandigarh Golf Club Sector 6"},
    {"city": "Panchkula", "club_name": "Panchkula Golf Club", "query": "Panchkula Golf Club Sector 3"},
    {"city": "Visakhapatnam", "club_name": "East Point Golf Club", "query": "East Point Golf Club Visakhapatnam"},
    {"city": "Vadodara", "club_name": "Gaekwad Baroda Golf Club", "query": "Gaekwad Baroda Golf Club Vadodara"},
]


def places_search(text_query: str) -> list[dict]:
    req = urllib.request.Request(
        "https://places.googleapis.com/v1/places:searchText",
        data=json.dumps({"textQuery": text_query, "maxResultCount": 5}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.formattedAddress,places.photos",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            return json.loads(resp.read().decode("utf-8")).get("places", [])
    except Exception:
        return []


def score_lounge_candidate(candidate: dict, spot: dict) -> float:
    name = (candidate.get("displayName", {}).get("text") or "").lower()
    addr = (candidate.get("formattedAddress") or "").lower()
    lname = spot["lounge_name"].lower()
    term = spot.get("terminal", "").lower()
    city = spot.get("city", "").lower()
    ttype = spot.get("terminal_type", "").lower()
    score = 0.0

    # Positive signals
    for kw in ["encalm", "adani", "080", "travel club", "primus", "prive", "privé", "loyalty", "aviserv", "centurion", "american express", "elysian", "o'vetra", "paahun", "pearl", "good times", "costa", "carnations", "airr", "mandarin", "uttham", "earth", "kailash", "take off", "zesto", "blackberry", "budweiser"]:
        if kw in lname and kw in name:
            score += 6.0
    if "prive" in lname or "privé" in lname:
        score += 10.0 if ("prive" in name or "privé" in name or "business" in name) else -4.0
    if "silver" in lname and "silver" in name:
        score += 5.0
    if "arrival" in term and "arrival" in name:
        score += 5.0
    if "international" in ttype and "international" in name:
        score += 4.0
    if "domestic" in ttype and "domestic" in name:
        score += 4.0
    for tn in ["t1", "t2", "t3", "t4", "terminal 1", "terminal 2", "terminal 3", "terminal 4", "1b", "1c"]:
        if tn in term and (tn in name or tn in addr):
            score += 4.0
    if city.split("/")[0].strip() in (name + " " + addr):
        score += 2.0
    if "lounge" in name or "bar" in name or "coffee" in name:
        score += 1.5
    if candidate.get("photos"):
        score += 1.0
    if candidate.get("rating"):
        score += 0.5
    return score


def download_and_optimize_photo(photo_name: str, dest_path: Path) -> bool:
    if dest_path.exists() and dest_path.stat().st_size > 4000:
        return True
    url = f"https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=760&key={API_KEY}"
    tmp_path = dest_path.with_suffix(".tmp.jpg")
    try:
        urllib.request.urlretrieve(url, str(tmp_path))
        if tmp_path.exists() and tmp_path.stat().st_size > 2000:
            subprocess.run(
                ["sips", "-Z", "760", "-s", "format", "jpeg", "-s", "formatOptions", "76", str(tmp_path), "--out", str(dest_path)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
            if not dest_path.exists():
                tmp_path.rename(dest_path)
            else:
                tmp_path.unlink(missing_ok=True)
            return dest_path.exists()
    except Exception:
        tmp_path.unlink(missing_ok=True)
    return False


def build_lounge_query(spot: dict) -> str:
    clean_name = re.sub(r"\([^)]*\)", "", spot["lounge_name"]).strip()
    if "prive" in spot["lounge_name"].lower() or "privé" in spot["lounge_name"].lower():
        clean_name = spot["lounge_name"].replace("Privé", "Prive")
    term = spot.get("terminal", "")
    ttype = spot.get("terminal_type", "")
    city = spot.get("city", "")
    return f"{clean_name} {ttype} {term} {city} Airport India"


def enrich_single_lounge(spot: dict) -> dict:
    q = build_lounge_query(spot)
    cands = places_search(q)
    if not cands:
        # Fallback simpler query
        cands = places_search(f"{spot['lounge_name']} {spot['city']} Airport")
    best = max(cands, key=lambda c: score_lounge_candidate(c, spot)) if cands else None
    code_slug = slugify(spot["lounge_code"])
    photo_dest = WEB_LOUNGE_PHOTOS / f"{code_slug}.jpg"
    local_photo = None
    if best and best.get("photos"):
        # Try first 2 photos in case 1 fails
        for ph in best["photos"][:2]:
            if download_and_optimize_photo(ph["name"], photo_dest):
                local_photo = f"/lounge-photos/{code_slug}.jpg"
                break
    elif photo_dest.exists():
        local_photo = f"/lounge-photos/{code_slug}.jpg"

    out = dict(spot)
    if best:
        if best.get("displayName", {}).get("text"):
            out["google_place_name"] = best["displayName"]["text"]
        if best.get("rating") is not None:
            out["google_rating"] = round(float(best["rating"]), 1)
        if best.get("userRatingCount") is not None:
            out["google_review_count"] = int(best["userRatingCount"])
        if best.get("googleMapsUri"):
            out["google_maps_url"] = best["googleMapsUri"]
    if local_photo:
        out["local_photo_path"] = local_photo
    return out


def enrich_single_golf(club: dict) -> dict:
    cands = places_search(club["query"])
    best = cands[0] if cands else None
    slug = slugify(f"{club['city']}-{club['club_name']}")
    photo_dest = WEB_GOLF_PHOTOS / f"{slug}.jpg"
    local_photo = None
    if best and best.get("photos"):
        for ph in best["photos"][:2]:
            if download_and_optimize_photo(ph["name"], photo_dest):
                local_photo = f"/golf-photos/{slug}.jpg"
                break
    elif photo_dest.exists():
        local_photo = f"/golf-photos/{slug}.jpg"

    return {
        "slug": slug,
        "city": club["city"],
        "club_name": club["club_name"],
        "google_place_name": best.get("displayName", {}).get("text") if best else club["club_name"],
        "google_rating": round(float(best["rating"]), 1) if best and best.get("rating") is not None else None,
        "google_review_count": int(best["userRatingCount"]) if best and best.get("userRatingCount") is not None else None,
        "google_maps_url": best.get("googleMapsUri") if best else None,
        "formatted_address": best.get("formattedAddress") if best else None,
        "local_photo_path": local_photo,
    }


def main():
    master = json.loads(LOUNGE_MASTER_PATH.read_text(encoding="utf-8"))
    by_code = {s["lounge_code"]: s for s in master["participating_indian_airport_lounges"]}
    for item in MISSING_AND_FIXED_LOUNGES:
        by_code[item["lounge_code"]] = item
    lounges = list(by_code.values())

    print(f"Enriching {len(lounges)} Indian airport lounges via Google Places API...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        enriched_lounges = list(ex.map(enrich_single_lounge, lounges))

    master["generated_at"] = "2026-11-14"
    master["participating_indian_airport_lounges_count"] = len(enriched_lounges)
    master["participating_indian_airport_lounges"] = enriched_lounges
    LOUNGE_MASTER_PATH.write_text(json.dumps(master, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    rated_l = sum(1 for x in enriched_lounges if x.get("google_rating"))
    photo_l = sum(1 for x in enriched_lounges if x.get("local_photo_path"))
    print(f"Lounges done: {len(enriched_lounges)} total, {rated_l} with Google ratings, {photo_l} with real photos.")

    print(f"Enriching {len(GOLF_CLUBS_LIST)} Indian golf courses via Google Places API...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        enriched_golf = list(ex.map(enrich_single_golf, GOLF_CLUBS_LIST))

    golf_payload = {
        "generated_at": "2026-11-14",
        "clubs_count": len(enriched_golf),
        "clubs": enriched_golf,
    }
    GOLF_MASTER_PATH.write_text(json.dumps(golf_payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    rated_g = sum(1 for x in enriched_golf if x.get("google_rating"))
    photo_g = sum(1 for x in enriched_golf if x.get("local_photo_path"))
    print(f"Golf clubs done: {len(enriched_golf)} total, {rated_g} with Google ratings, {photo_g} with real photos.")


if __name__ == "__main__":
    main()
