#!/usr/bin/env python3
"""
Builds data/master/merchant_mcc_directory.json from the community SBI Cashback
merchant & statement descriptor spreadsheet (both tabs: 'NEW' gid=835884080 and 'Sheet1' gid=0),
matches every 0% / 1% descriptor to its SBI Cashback MCC exemption category,
assigns spend segments & SpendCategoryKey mappings, and fetches verified brand logos.
"""

from __future__ import annotations

import concurrent.futures
import csv
import json
import os
import re
import struct
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
RAW_NEW = DATA / "raw" / "sbi_cashback_sheet_new.csv"
RAW_OLD = DATA / "raw" / "sbi_cashback_sheet_old.csv"
WEB_LOGOS = ROOT / "web" / "public" / "brand-logos"
MOB_LOGOS = ROOT / "mobile" / "assets" / "brand-logos"
OUT_MASTER = DATA / "master" / "merchant_mcc_directory.json"
OUT_WEB = ROOT / "web" / "public" / "data" / "merchant-mcc-directory.json"
OUT_MOB_DATA = ROOT / "mobile" / "src" / "data" / "merchant_mcc_directory.json"
OUT_MOB_LOGO_MAP = ROOT / "mobile" / "src" / "lib" / "brandLogos.ts"

# Canonical Brand Registry: (brand_slug, brand_name, domain, primary_segment, default_spend_category)
BRAND_CATALOG: dict[str, tuple[str, str, str, str, str]] = {
    "acko": ("acko", "Acko Insurance", "acko.com", "Insurance & Healthcare", "insurance"),
    "income_tax_tin2": ("income-tax-tin2", "Income Tax / Adv Tax (TIN 2.0)", "incometax.gov.in", "Education & Govt", "education_rent_govt"),
    "agoda": ("agoda", "Agoda", "agoda.com", "Flights & Hotels", "travel_flights_hotels"),
    "aha": ("aha", "Aha OTT", "aha.video", "Entertainment & OTT", "online_shopping_general"),
    "ajio": ("ajio", "AJIO", "ajio.com", "Online Shopping", "amazon_flipkart_myntra"),
    "akbar_travels": ("akbar-travels", "Akbar Travels", "akbartravels.com", "Flights & Hotels", "travel_flights_hotels"),
    "recurring_si": ("standing-instructions-si", "All Standing Instructions (OTT/SI)", "netflix.com", "Entertainment & OTT", "utilities_bills_telecom"),
    "amazon": ("amazon", "Amazon India & Amazon Pay", "amazon.in", "Online Shopping", "amazon_flipkart_myntra"),
    "amazon_intl": ("amazon-global", "Amazon Global (CA / AE)", "amazon.com", "Forex & Cloud/SaaS", "international_forex_net_of_markup"),
    "amway": ("amway", "Amway India", "amway.in", "Online Shopping", "online_shopping_general"),
    "apc_estore": ("apc-estore", "APC Estorewale", "apc.com", "Online Shopping", "online_shopping_general"),
    "apple": ("apple-india", "Apple India Store", "apple.com", "Online Shopping", "online_shopping_general"),
    "asus": ("asus-india", "ASUS India Promo Store", "asus.com", "Online Shopping", "online_shopping_general"),
    "belvish": ("belvish", "Belvish", "belvish.com", "Online Shopping", "online_shopping_general"),
    "bewakoof": ("bewakoof", "Bewakoof", "bewakoof.com", "Online Shopping", "online_shopping_general"),
    "bharatqr": ("bharatqr", "BharatQR Merchants", "npci.org.in", "Groceries & Quick Commerce", "offline_general_other"),
    "bigbasket": ("bigbasket", "BigBasket", "bigbasket.com", "Groceries & Quick Commerce", "groceries_quick_commerce"),
    "bisleri": ("bisleri", "Bisleri@Doorstep", "bisleri.com", "Groceries & Quick Commerce", "groceries_quick_commerce"),
    "blinkit": ("blinkit", "Blinkit", "blinkit.com", "Groceries & Quick Commerce", "groceries_quick_commerce"),
    "blusmart": ("blusmart", "BluSmart Mobility", "blu-smart.com", "Railways & Transit", "travel_flights_hotels"),
    "book_my_hsrp": ("book-my-hsrp", "BookMyHSRP (Rosmerta)", "bookmyhsrp.com", "Utilities & Recharge", "online_shopping_general"),
    "bookmyshow": ("bookmyshow", "BookMyShow", "bookmyshow.com", "Entertainment & OTT", "dining_swiggy_zomato"),
    "bookswagon": ("bookswagon", "Bookswagon", "bookswagon.com", "Online Shopping", "online_shopping_general"),
    "bpcl_ionage": ("bpcl-ionage", "BPCL EV Charging (Ionage)", "bharatpetroleum.in", "Fuel & EV Charging", "fuel"),
    "caratlane": ("caratlane", "CaratLane", "caratlane.com", "Jewellery & Gold", "offline_general_other"),
    "cheapticket": ("cheapticket", "CheapTicket", "cheapticket.in", "Flights & Hotels", "travel_flights_hotels"),
    "cleartrip": ("cleartrip", "Cleartrip", "cleartrip.com", "Flights & Hotels", "travel_flights_hotels"),
    "coupl": ("coupl", "Coupl Prepaid", "coupl.in", "Gift Cards & Wallets", "utilities_bills_telecom"),
    "cred": ("cred", "CRED App & CRED Pay", "cred.club", "Gift Cards & Wallets", "online_shopping_general"),
    "credence_rewards": ("credence-rewards", "Credence Rewards", "credencerewards.com", "Gift Cards & Wallets", "online_shopping_general"),
    "damilano": ("damilano", "Da Milano", "damilano.com", "Online Shopping", "online_shopping_general"),
    "decathlon": ("decathlon", "Decathlon India", "decathlon.in", "Online Shopping", "online_shopping_general"),
    "dmart": ("dmart", "DMart / DMart Ready", "dmart.in", "Groceries & Quick Commerce", "groceries_quick_commerce"),
    "doosra": ("doosra", "Doosra", "doosra.com", "Utilities & Recharge", "online_shopping_general"),
    "easemytrip": ("easemytrip", "EaseMyTrip", "easemytrip.com", "Flights & Hotels", "travel_flights_hotels"),
    "eatsure": ("eatsure", "EatSure", "eatsure.com", "Dining & Food Delivery", "dining_swiggy_zomato"),
    "ethos": ("ethos-watches", "Ethos Watch Boutiques", "ethoswatches.com", "Jewellery & Gold", "offline_general_other"),
    "firstcry": ("firstcry", "FirstCry", "firstcry.com", "Online Shopping", "online_shopping_general"),
    "flipkart": ("flipkart", "Flipkart & Flipkart Health+", "flipkart.com", "Online Shopping", "amazon_flipkart_myntra"),
    "foodbook": ("foodbook", "Foodbook (Compass Group)", "compass-group.co.in", "Dining & Food Delivery", "dining_swiggy_zomato"),
    "freecharge": ("freecharge", "Freecharge", "freecharge.in", "Utilities & Recharge", "utilities_bills_telecom"),
    "freshtohome": ("freshtohome", "FreshToHome / FTH Daily", "freshtohome.com", "Groceries & Quick Commerce", "groceries_quick_commerce"),
    "goa_miles": ("goa-miles", "GoaMiles", "goamiles.com", "Railways & Transit", "travel_flights_hotels"),
    "godaddy": ("godaddy", "GoDaddy India", "godaddy.com", "Forex & Cloud/SaaS", "online_shopping_general"),
    "goibibo": ("goibibo", "Goibibo", "goibibo.com", "Flights & Hotels", "travel_flights_hotels"),
    "google_cloud": ("google-cloud", "Google Cloud", "cloud.google.com", "Forex & Cloud/SaaS", "online_shopping_general"),
    "google_play": ("google-play", "Google Play Store", "play.google.com", "Entertainment & OTT", "online_shopping_general"),
    "grt_jewellers": ("grt-jewellers", "GRT Jewellers", "grtjewels.com", "Jewellery & Gold", "offline_general_other"),
    "gyftr": ("gyftr", "GyFTR (Vouchers)", "gyftr.com", "Gift Cards & Wallets", "utilities_bills_telecom"),
    "happyfares": ("happyfares", "HappyFares", "happyfares.in", "Flights & Hotels", "travel_flights_hotels"),
    "icai": ("icai", "ICAI (Institute of CA)", "icai.org", "Education & Govt", "education_rent_govt"),
    "indiahikes": ("indiahikes", "IndiaHikes", "indiahikes.com", "Flights & Hotels", "travel_flights_hotels"),
    "indigo": ("indigo", "IndiGo Airlines", "goindigo.in", "Flights & Hotels", "travel_flights_hotels"),
    "intermiles": ("intermiles", "InterMiles", "intermiles.com", "Flights & Hotels", "travel_flights_hotels"),
    "irctc": ("irctc", "IRCTC (Train, Air, Tourism & UTS)", "irctc.co.in", "Railways & Transit", "travel_flights_hotels"),
    "jiomart": ("jiomart", "JioMart", "jiomart.com", "Groceries & Quick Commerce", "groceries_quick_commerce"),
    "just_herbs": ("just-herbs", "Just Herbs", "justherbs.in", "Online Shopping", "online_shopping_general"),
    "klook": ("klook", "Klook", "klook.com", "Flights & Hotels", "travel_flights_hotels"),
    "ksrtc": ("ksrtc", "KSRTC Bus", "ksrtc.in", "Railways & Transit", "travel_flights_hotels"),
    "lancome": ("lancome", "Lancôme India", "lancome.in", "Online Shopping", "online_shopping_general"),
    "lee_india": ("lee-india", "Lee India", "lee.in", "Online Shopping", "online_shopping_general"),
    "lenovo": ("lenovo", "Lenovo India", "lenovo.com", "Online Shopping", "online_shopping_general"),
    "lenskart": ("lenskart", "Lenskart", "lenskart.com", "Online Shopping", "online_shopping_general"),
    "lifestyle": ("lifestyle", "Lifestyle Stores", "lifestylestores.com", "Online Shopping", "online_shopping_general"),
    "magicpin": ("magicpin", "Magicpin", "magicpin.in", "Dining & Food Delivery", "dining_swiggy_zomato"),
    "magzter": ("magzter", "Magzter", "magzter.com", "Entertainment & OTT", "international_forex_net_of_markup"),
    "makemytrip": ("makemytrip", "MakeMyTrip", "makemytrip.com", "Flights & Hotels", "travel_flights_hotels"),
    "man_company": ("the-man-company", "The Man Company", "themancompany.com", "Online Shopping", "online_shopping_general"),
    "medplus": ("medplus", "MedPlus Mart", "medplusmart.com", "Insurance & Healthcare", "online_shopping_general"),
    "meesho": ("meesho", "Meesho", "meesho.com", "Online Shopping", "online_shopping_general"),
    "milkbasket": ("milkbasket", "Milkbasket", "milkbasket.com", "Groceries & Quick Commerce", "groceries_quick_commerce"),
    "mobikwik": ("mobikwik", "MobiKwik", "mobikwik.com", "Gift Cards & Wallets", "utilities_bills_telecom"),
    "myjio": ("jio", "Jio / MyJio Recharge", "jio.com", "Utilities & Recharge", "utilities_bills_telecom"),
    "namecheap": ("namecheap", "Namecheap", "namecheap.com", "Forex & Cloud/SaaS", "international_forex_net_of_markup"),
    "netmeds": ("netmeds", "Netmeds", "netmeds.com", "Insurance & Healthcare", "online_shopping_general"),
    "netplus": ("netplus", "Netplus Broadband", "netplus.co.in", "Utilities & Recharge", "utilities_bills_telecom"),
    "nnnow": ("nnnow", "NNNOW (Arvind)", "nnnow.com", "Online Shopping", "online_shopping_general"),
    "nobroker": ("nobroker", "NoBroker", "nobroker.in", "Rent & Real Estate", "education_rent_govt"),
    "nps_trust": ("nps-trust", "NPS Trust (Pension)", "npstrust.org.in", "Education & Govt", "education_rent_govt"),
    "nykaa": ("nykaa", "Nykaa", "nykaa.com", "Online Shopping", "online_shopping_general"),
    "ola": ("ola", "Ola Cabs", "olacabs.com", "Railways & Transit", "travel_flights_hotels"),
    "otipy": ("otipy", "Otipy", "otipy.com", "Groceries & Quick Commerce", "groceries_quick_commerce"),
    "oyo": ("oyo", "OYO Rooms", "oyorooms.com", "Flights & Hotels", "education_rent_govt"),
    "park_plus": ("park-plus", "Park+ (FASTag & Recharge)", "parkplus.io", "Utilities & Recharge", "online_shopping_general"),
    "passport_seva": ("passport-seva", "Passport Seva", "passportindia.gov.in", "Education & Govt", "education_rent_govt"),
    "paypal": ("paypal", "PayPal Services", "paypal.com", "Forex & Cloud/SaaS", "online_shopping_general"),
    "paytm": ("paytm", "Paytm (Utilities, Wallet, GV & FASTag)", "paytm.com", "Gift Cards & Wallets", "utilities_bills_telecom"),
    "payu_edu": ("payu-education", "PayU College & School Portals", "payu.in", "Education & Govt", "education_rent_govt"),
    "payzapp": ("payzapp", "HDFC PayZapp", "hdfcbank.com", "Gift Cards & Wallets", "utilities_bills_telecom"),
    "pharmeasy": ("pharmeasy", "PharmEasy", "pharmeasy.in", "Insurance & Healthcare", "online_shopping_general"),
    "phonepe": ("phonepe", "PhonePe", "phonepe.com", "Utilities & Recharge", "utilities_bills_telecom"),
    "porter": ("porter", "Porter Logistics", "porter.in", "Railways & Transit", "utilities_bills_telecom"),
    "puma": ("puma", "PUMA India", "in.puma.com", "Online Shopping", "online_shopping_general"),
    "purplle": ("purplle", "Purplle", "purplle.com", "Online Shopping", "online_shopping_general"),
    "pvr": ("pvr-inox", "PVR INOX Cinemas", "pvrcinemas.com", "Entertainment & OTT", "dining_swiggy_zomato"),
    "redbus": ("redbus", "redBus", "redbus.in", "Railways & Transit", "travel_flights_hotels"),
    "simpl": ("simpl", "Simpl Pay Later", "getsimpl.com", "Gift Cards & Wallets", "utilities_bills_telecom"),
    "snappay": ("snappay", "SnapPay", "snappay.in", "Gift Cards & Wallets", "utilities_bills_telecom"),
    "starbucks": ("starbucks", "Starbucks India", "starbucks.in", "Dining & Food Delivery", "dining_swiggy_zomato"),
    "statiq": ("statiq", "Statiq EV Charging", "statiq.in", "Fuel & EV Charging", "online_shopping_general"),
    "statue_of_unity": ("statue-of-unity", "Statue of Unity Tickets", "soutickets.in", "Flights & Hotels", "travel_flights_hotels"),
    "swiggy": ("swiggy", "Swiggy & Swiggy Instamart", "swiggy.com", "Groceries & Quick Commerce", "groceries_quick_commerce"),
    "tanishq": ("tanishq", "Tanishq (Golden Harvest / Titan)", "tanishq.co.in", "Jewellery & Gold", "offline_general_other"),
    "tata_1mg": ("tata-1mg", "Tata 1mg", "1mg.com", "Insurance & Healthcare", "online_shopping_general"),
    "tatacliq": ("tatacliq", "Tata CLiQ & CLiQ Luxury", "tatacliq.com", "Online Shopping", "online_shopping_general"),
    "tataneu": ("tata-neu", "Tata Neu App", "tataneu.com", "Online Shopping", "online_shopping_general"),
    "teamviewer": ("teamviewer", "TeamViewer", "teamviewer.com", "Forex & Cloud/SaaS", "online_shopping_general"),
    "times_prime": ("times-prime", "Times Prime", "timesprime.com", "Entertainment & OTT", "online_shopping_general"),
    "treebo": ("treebo", "Treebo Hotels", "treebo.com", "Flights & Hotels", "travel_flights_hotels"),
    "trekkaro": ("trekkaro", "Trekkaro Adventures", "trekkaro.com", "Flights & Hotels", "travel_flights_hotels"),
    "trenitalia": ("trenitalia", "Trenitalia (Italy Rail)", "trenitalia.com", "Railways & Transit", "international_forex_net_of_markup"),
    "tbz": ("tbz", "Tribhovandas Bhimji Zaveri (TBZ)", "tbztheoriginal.com", "Jewellery & Gold", "offline_general_other"),
    "tripodeal": ("tripodeal", "Tripodeal", "tripodeal.com", "Flights & Hotels", "travel_flights_hotels"),
    "truemeds": ("truemeds", "Truemeds", "truemeds.in", "Insurance & Healthcare", "online_shopping_general"),
    "uber": ("uber", "Uber India", "uber.com", "Railways & Transit", "travel_flights_hotels"),
    "udemy": ("udemy", "Udemy", "udemy.com", "Education & Govt", "education_rent_govt"),
    "univest": ("univest", "Univest", "univest.in", "Online Shopping", "utilities_bills_telecom"),
    "urban_company": ("urban-company", "Urban Company", "urbancompany.com", "Utilities & Recharge", "utilities_bills_telecom"),
    "vistara": ("vistara", "Air India / Vistara", "airindia.com", "Flights & Hotels", "travel_flights_hotels"),
    "woohoo": ("woohoo", "Woohoo (Pine Labs Gift Cards)", "woohoo.in", "Gift Cards & Wallets", "online_shopping_general"),
    "yatra": ("yatra", "Yatra", "yatra.com", "Flights & Hotels", "travel_flights_hotels"),
    "youtube": ("youtube", "YouTube Premium / Subscriptions", "youtube.com", "Entertainment & OTT", "online_shopping_general"),
    "zingoy": ("zingoy", "Zingoy", "zingoy.com", "Gift Cards & Wallets", "online_shopping_general"),
    "zomato": ("zomato", "Zomato", "zomato.com", "Dining & Food Delivery", "dining_swiggy_zomato"),
    "zepto": ("zepto", "Zepto & Zepto Super Saver", "zepto.in", "Groceries & Quick Commerce", "groceries_quick_commerce"),
    "policybazaar": ("policybazaar", "Policybazaar", "policybazaar.com", "Insurance & Healthcare", "insurance"),
}


def resolve_brand_key(merchant_name: str, statement_name: str = "") -> str:
    m = merchant_name.lower().strip()
    s = statement_name.lower().strip()
    if "acko" in m:
        return "acko"
    if "tin2" in s or "adv tax" in m:
        return "income_tax_tin2"
    if "agoda" in m:
        return "agoda"
    if "aha" in m:
        return "aha"
    if "ajio" in m:
        return "ajio"
    if "akbar" in m:
        return "akbar_travels"
    if "all si" in m:
        return "recurring_si"
    if "amazon" in m:
        if "canada" in m or ".ae" in m or "dubai" in m:
            return "amazon_intl"
        return "amazon"
    if "amway" in m:
        return "amway"
    if "apc" in m:
        return "apc_estore"
    if "apple.com" in m:
        return "apple"
    if "asus" in m:
        return "asus"
    if "belvish" in m:
        return "belvish"
    if "bewakoof" in m:
        return "bewakoof"
    if "bharatqr" in m:
        return "bharatqr"
    if "big basket" in m or "bigbasket" in m:
        return "bigbasket"
    if "bisleri" in m:
        return "bisleri"
    if "blinkit" in m:
        return "blinkit"
    if "blusmart" in m:
        return "blusmart"
    if "hsrp" in m:
        return "book_my_hsrp"
    if "bookmyshow" in m:
        return "bookmyshow"
    if "bookswagon" in m:
        return "bookswagon"
    if "bpcl" in m:
        return "bpcl_ionage"
    if "caratlane" in m:
        return "caratlane"
    if "cheapticket" in m:
        return "cheapticket"
    if "cleartrip" in m:
        return "cleartrip"
    if "coupl" in m:
        return "coupl"
    if "credence" in m:
        return "credence_rewards"
    if "cred" in m:
        return "cred"
    if "damilano" in m:
        return "damilano"
    if "decathlon" in m:
        return "decathlon"
    if "dmart" in m:
        return "dmart"
    if "doosra" in m:
        return "doosra"
    if "easemytrip" in m:
        return "easemytrip"
    if "eatsure" in m:
        return "eatsure"
    if "ethos" in m:
        return "ethos"
    if "firstcry" in m:
        return "firstcry"
    if "flipkart" in m:
        return "flipkart"
    if "foodbook" in m:
        return "foodbook"
    if "freecharge" in m:
        return "freecharge"
    if "fth" in m or "freshtohome" in m:
        return "freshtohome"
    if "goa miles" in m:
        return "goa_miles"
    if "godaddy" in m:
        return "godaddy"
    if "goibibo" in m:
        return "goibibo"
    if "google cloud" in m:
        return "google_cloud"
    if "google play" in m:
        return "google_play"
    if "grt jewels" in m:
        return "grt_jewellers"
    if "gyftr" in m:
        return "gyftr"
    if "happy fares" in m:
        return "happyfares"
    if "icai" in m:
        return "icai"
    if "indiahikes" in m:
        return "indiahikes"
    if "indigo" in m:
        return "indigo"
    if "intermiles" in m:
        return "intermiles"
    if "irctc" in m:
        return "irctc"
    if "jiomart" in m:
        return "jiomart"
    if "just herbs" in m:
        return "just_herbs"
    if "klook" in m:
        return "klook"
    if "ksrtc" in m:
        return "ksrtc"
    if "lancome" in m:
        return "lancome"
    if "lee shirts" in m:
        return "lee_india"
    if "lenovo" in m:
        return "lenovo"
    if "lenskart" in m:
        return "lenskart"
    if "lifestyle" in m:
        return "lifestyle"
    if "magicpin" in m:
        return "magicpin"
    if "magzter" in m:
        return "magzter"
    if "makemytrip" in m:
        return "makemytrip"
    if "man company" in m:
        return "man_company"
    if "medplus" in m:
        return "medplus"
    if "meesho" in m:
        return "meesho"
    if "milk basket" in m:
        return "milkbasket"
    if "mobikwik" in m:
        return "mobikwik"
    if "my jio" in m or "myjio" in m:
        return "myjio"
    if "namecheap" in m:
        return "namecheap"
    if "netmeds" in m:
        return "netmeds"
    if "netplus" in m:
        return "netplus"
    if "nnnow" in m:
        return "nnnow"
    if "nobroker" in m:
        return "nobroker"
    if "nps" in m:
        return "nps_trust"
    if "nykaa" in m:
        return "nykaa"
    if m == "ola":
        return "ola"
    if "otipy" in m:
        return "otipy"
    if m == "oyo":
        return "oyo"
    if "park+" in m:
        return "park_plus"
    if "passport seva" in m:
        return "passport_seva"
    if "paypal" in m:
        return "paypal"
    if "paytm" in m or "gv's on paytm" in m:
        return "paytm"
    if "payu college" in m or "college fee" in s:
        return "payu_edu"
    if "payzapp" in m:
        return "payzapp"
    if "pharmeasy" in m:
        return "pharmeasy"
    if "phonepe" in m:
        return "phonepe"
    if "porter" in m:
        return "porter"
    if "puma" in m:
        return "puma"
    if "purplle" in m:
        return "purplle"
    if "pvr" in m:
        return "pvr"
    if "redbus" in m:
        return "redbus"
    if "simpl" in m:
        return "simpl"
    if "snappay" in m:
        return "snappay"
    if "starbucks" in m:
        return "starbucks"
    if "statiq" in m:
        return "statiq"
    if "statue of unity" in m:
        return "statue_of_unity"
    if "swiggy" in m:
        return "swiggy"
    if "tanishq" in m:
        return "tanishq"
    if "tata 1mg" in m:
        return "tata_1mg"
    if "tataneu" in m or "tata neu" in m:
        return "tataneu"
    if "tatacliq" in m:
        return "tatacliq"
    if "teamviewer" in m:
        return "teamviewer"
    if "times prime" in m:
        return "times_prime"
    if "treebo" in m:
        return "treebo"
    if "trekkaro" in m:
        return "trekkaro"
    if "trenitalia" in m:
        return "trenitalia"
    if "tribhovandas" in m:
        return "tbz"
    if "tripodeal" in m:
        return "tripodeal"
    if "truemeds" in m:
        return "truemeds"
    if "uber" in m:
        return "uber"
    if "udemy" in m:
        return "udemy"
    if "univest" in m:
        return "univest"
    if "urban company" in m:
        return "urban_company"
    if "vistara" in m:
        return "vistara"
    if "woohoo" in m:
        return "woohoo"
    if "yatra" in m:
        return "yatra"
    if "youtube" in m:
        return "youtube"
    if "zingoy" in m:
        return "zingoy"
    if "zomato" in m:
        return "zomato"
    return "ryze"


def parse_rate(raw: str) -> tuple[float | None, str]:
    txt = (raw or "").strip()
    m = re.search(r"(\d+(?:\.\d+)?)\s*%", txt)
    if m:
        pct = float(m.group(1))
        if pct >= 5.0:
            return 5.0, "5%"
        if pct >= 1.0:
            return 1.0, "1%"
        return 0.0, "0% Exempt"
    return None, "Unverified"


def classify_sbi_exemption(
    brand_key: str,
    platform_label: str,
    statement_name: str,
    comment: str,
    rate: float | None,
    default_cat: str,
) -> tuple[str | None, str | None, str, str | None]:
    """
    Returns (exemption_category, probable_mcc, effective_spend_category, payment_page_tip)
    by matching 0%/1% descriptors with SBI Cashback Card MCC exemptions.
    """
    combined = f"{platform_label} {statement_name} {comment}".lower()

    if rate == 5.0:
        if "paypal" in combined:
            return None, "5999", "online_shopping_general", "5% verified for PayPal digital/service transactions."
        if brand_key == "grt_jewellers":
            return (
                None,
                "5944 (Bypassed via Amazon Pay GC)",
                "amazon_flipkart_myntra",
                "Direct jewellery POS gives 0%, but buying GRT Gift Cards via Amazon Pay ('AMAZON PAY INDIA PRIVATE') yields 5%!",
            )
        if brand_key == "paytm" and "amazon gv" in combined:
            return (
                None,
                "5947 / ONE97 Gift Voucher",
                "amazon_flipkart_myntra",
                "Check payment descriptor carefully: 'ONE97 COMMUNICATIONS LIMITED' yielded 5%, while 'PAYTM NOIDA IN' wallet load gives 0%.",
            )
        if brand_key == "amazon" and "bharat qr" in combined:
            return None, "5999", "amazon_flipkart_myntra", "Amazon COD via BharatQR ('Amazon Seller Services') earns 5%."
        if brand_key == "amazon" and ("gv" in combined or "prime" in combined or "digital gold" in combined):
            return (
                None,
                "5999 / Amazon Pay Private",
                "amazon_flipkart_myntra",
                "Safe 5% when OTP/statement shows 'AMAZON PAY INDIA PRIVATE' or 'amazon banglore...'. Watch out: 'WWW AMAZON IN GURGAON/BANGALORE' bills as Utility 0%!",
            )
        if brand_key == "trekkaro":
            return (
                None,
                "5999",
                "travel_flights_hotels",
                "Landing page says Trekkaro Adventures; OTP page shows 'PAYTM APP QR CODE' — 5% cashback confirmed.",
            )
        if brand_key == "makemytrip":
            return None, "4722", "travel_flights_hotels", "Statement 'MAKEMYTRIP INDIA PVT L' reliably earns 5%."
        if brand_key == "goibibo":
            return None, "4722", "travel_flights_hotels", "Statement 'IBIBO GROUP PRIVATE LI' reliably earns 5%."
        if brand_key == "cleartrip":
            return None, "7011 (Hotel)", "travel_flights_hotels", "Hotel bookings billed under 'Cleartrip Private Limi' earn 5% (whereas Flight Paytm gateway bills as Railway MCC 0%)."
        if brand_key == "yatra":
            return None, "4511 (Flights)", "travel_flights_hotels", "Flight bookings showing 'WWW YATRA COM' / 'YATRA GURUGRAM IN' earn 5% (whereas 'Yatra Online Pvt Ltd' triggered MCC 4112 Railways 0%)."
        if brand_key == "irctc" and ("air" in combined or "tourism" in combined):
            return None, "4511 / 4722", "travel_flights_hotels", "IRCTC Air & IRCTC Tourism earn 5%, unlike Rail tickets ('IRCTC BANGALORE IN') which hit Railway MCC 4112 (0%)."
        return None, None, default_cat, comment or None

    if rate == 1.0:
        if "billdesk" in combined or "amazon flight" in combined:
            return (
                "Travel / Utility Gateway (1% Offline/Base Rate)",
                "4722 / 4900",
                "offline_general_other",
                "Amazon Flights routed via 'MakeMyTrip BillDesk Mumbai' earned only 1% instead of 5%.",
            )
        if brand_key == "youtube" or "cybs si" in combined:
            return (
                "Recurring Standing Instruction (SI / Mandate)",
                "5815 / 5968",
                "utilities_bills_telecom",
                "Recurring e-mandate ('CYBS SI') earns 0%–1% on SBI Cashback; pay manually via direct card OTP instead of auto-SI for 5%.",
            )
        return (
            "1% Base / Aggregator Gateway",
            "4900 / 6012",
            "utilities_bills_telecom",
            comment or "Billed at 1% base rate instead of 5% accelerated online rate.",
        )

    if rate is None:
        if brand_key == "myjio":
            return "Utilities & Telecom Exemption (Needs Re-check)", "4814 / 4900", "utilities_bills_telecom", "Utility/Telecom MCC is officially excluded on SBI Cashback — use Airtel Axis / Tata Neu / Amazon Pay ICICI."
        return None, None, default_cat, comment or "Community update required — verify small test transaction or use an uncapped rewards card."

    # rate == 0.0 -> Match exact SBI Cashback Exemption Category!
    if "insurance" in combined or brand_key in ("acko", "policybazaar"):
        return (
            "Insurance Premiums (Exempt)",
            "6300 / 5960",
            "insurance",
            "Billed under Insurance MCC 6300. SBI Cashback gives 0% — switch to Amazon Pay ICICI (2%), HDFC Infinia/DCBM (via SmartBuy/PayZapp), or Tata Neu Infinity.",
        )
    if "rail" in combined or "4112" in combined or "train" in combined or brand_key == "trenitalia":
        return (
            "Railways & Train Bookings (Exempt)",
            "4112",
            "travel_flights_hotels",
            "Gateway reports Railway MCC 4112! Avoid SBI Cashback here — use IRCTC SBI Premier, HDFC Regalia Gold/Infinia (SmartBuy), or general miles cards.",
        )
    if (
        "utility" in combined
        or "broadband" in combined
        or "myjio" in combined
        or "netplus" in combined
        or "urban" in combined
        or "amazon canada" in combined
        or "bill junction" in combined
        or "fx mart" in combined
        or "amzn mktp ca" in combined
        or statement_name.lower().strip() in ("amazonin gurgaon in", "amazon in bangalore", "www amazon in gurgaon in", "www amazon in bangalore in")
        or ("paytm payments utility" in combined)
    ):
        if brand_key in ("porter", "univest"):
            return (
                "Utility / Payment Aggregator MCC (FX Mart)",
                "4900 / 6540",
                "utilities_bills_telecom",
                "Payment gateway 'FX Mart Pvt Ltd' (PhonePe utility arm) triggers SBI Cashback Utility exemption (0%).",
            )
        if brand_key == "urban_company":
            return (
                "Home Services / Utility MCC (Exempt)",
                "4900 / 7299",
                "utilities_bills_telecom",
                "'WWW URBANCLAP IN' is classified under SBI excluded Utility/Service MCCs (0%). Use HDFC Millennia/Swiggy (if eligible) or Amazon Pay ICICI (1–2%).",
            )
        return (
            "Utilities, Telecom & Add-Money MCC (Exempt)",
            "4900 / 4814",
            "utilities_bills_telecom",
            "Descriptor 'WWW AMAZON IN GURGAON/BANGALORE', 'Paytm Utility', 'MYJIO', or 'NETSAFEBSP' hits Utility MCC 4900 (0% on SBI Cashback). Use Airtel Axis (10%), Ace, or Tata Neu Infinity (5%).",
        )
    if "meesho" in combined and "phonepe" in combined:
        return (
            "Aggregator / Utility Gateway Override (PhonePe)",
            "4900 / 7399",
            "utilities_bills_telecom",
            "TRAP: Meesho checkout routed via 'WWW PHONEPE COM' bills under PhonePe Utility/Aggregator MCC -> 0% on SBI Cashback! Pick direct card / Razorpay / PayU instead.",
        )
    if "tin2" in combined or "tax" in combined or "passport" in combined or brand_key in ("icai", "nps_trust"):
        return (
            "Government, Tax & Regulatory Payments (Exempt)",
            "9311 / 9399",
            "education_rent_govt",
            "Government & Tax MCCs (9311/9399) give 0% on SBI Cashback. Use HDFC BizBlack / Amex Milestone / SBI Octane-free milestone cards that count Govt spends.",
        )
    if "college" in combined or "school" in combined or brand_key == "udemy":
        return (
            "Education & Courses (Exempt)",
            "8299 / 8220",
            "education_rent_govt",
            "Education MCC (8299/8220) is excluded on SBI Cashback (0%). Pay via Amazon Pay GV (if supported) or milestone cards like Amex Plat Travel / HDFC BizBlack.",
        )
    if "oravel" in combined or "oyo" in combined or "rental" in combined or brand_key == "nobroker":
        return (
            "Rent & Property Management MCC (Exempt + Fee!)",
            "6513",
            "education_rent_govt",
            "CRITICAL: OYO ('Oravel Stays') & NoBroker bill under Rental MCC 6513! SBI Cashback gives 0% AND charges ₹199+GST rent surcharge.",
        )
    if brand_key in ("tanishq", "caratlane", "tbz", "ethos"):
        return (
            "Jewellery, Gold & Luxury Watches (Exempt)",
            "5944",
            "offline_general_other",
            "Jewellery & Watch MCC 5944 earns 0% on SBI Cashback. Use Tata Neu Infinity (5% on Tanishq/CaratLane via Tata Neu) or milestone cards (Amex Plat Travel / Axis Atlas).",
        )
    if "gyftr" in combined or "wallet" in combined or brand_key in ("mobikwik", "payzapp", "coupl") or ("gv" in combined and brand_key == "paytm") or ("foodbook" in combined):
        return (
            "Gift Card Portal / Wallet Load / Quasi-Cash (Exempt)",
            "6540 / 5947 / 6012",
            "utilities_bills_telecom",
            "Wallet loads ('Mobikwik', 'PayZapp', 'Paytm Noida') & GyFTR portals are excluded on SBI Cashback (0%). Buy vouchers on Maximize/Amazon Pay Private ('AMAZON PAY INDIA PRIVATE') instead.",
        )
    if brand_key == "simpl" or "repayment" in combined:
        return (
            "BNPL / Financial Repayment (Exempt)",
            "6012",
            "education_rent_govt",
            "BNPL & loan repayments ('ONE SIGMA TECHNOLOGIES') map to MCC 6012 Financial Institutions — 0% on cashback cards.",
        )
    if "all si" in combined or "cybs si" in combined:
        return (
            "Recurring Standing Instruction / e-Mandate (Exempt)",
            "5968",
            "utilities_bills_telecom",
            "SI mandates on Netflix/YouTube/Hotstar earn 0% on SBI Cashback. Switch to manual card payment each cycle.",
        )
    if brand_key == "godaddy":
        return (
            "SaaS / Utility Merchant Override",
            "4816 / 5968",
            "online_shopping_general",
            "Mixed: 'GODADDY INDIA DOMAINS AND HOSTING SERVICES PVT LTD' earned 5%, whereas 'Godaddy India Domains GURGAON IN' returned 0%.",
        )
    if brand_key == "bookswagon":
        return (
            "Merchant / Education MCC Exclusion",
            "5942 / 8299",
            "online_shopping_general",
            "Bookswagon is flagged 0% on SBI Cashback (likely classified under Education/Excluded Book MCC).",
        )
    if brand_key == "magzter":
        return (
            "International DCC / Recurring Newsstand (Exempt + FX)",
            "5994 / DCC",
            "international_forex_net_of_markup",
            "Billed in USD/DCC overseas (+3.5% FX markup) and excluded from 5% cashback; use a 0% forex card like Scapia or AU Ixigo.",
        )
    return (
        "Excluded Online MCC (0%)",
        "Excluded",
        "offline_general_other",
        comment or "Returned 0% in community audit — use a general-purpose rewards card.",
    )


def verify_and_download_logo(slug: str, domain: str) -> str | None:
    WEB_LOGOS.mkdir(parents=True, exist_ok=True)
    MOB_LOGOS.mkdir(parents=True, exist_ok=True)
    web_out = WEB_LOGOS / f"{slug}.png"
    mob_out = MOB_LOGOS / f"{slug}.png"
    if web_out.exists() and web_out.stat().st_size > 400 and mob_out.exists():
        return f"brand-logos/{slug}.png"

    urls = [
        f"https://www.google.com/s2/favicons?domain={domain}&sz=128",
        f"https://icon.horse/icon/{domain}",
    ]
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    for url in urls:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=8) as resp:
                raw = resp.read()
                if len(raw) < 350:
                    continue
                # Validate PNG dimensions >= 32px or JPEG/WebP
                if raw[:8] == b"\x89PNG\r\n\x1a\n" and len(raw) >= 24:
                    w, h = struct.unpack(">II", raw[16:24])
                    if w < 24 or h < 24:
                        continue
                web_out.write_bytes(raw)
                mob_out.write_bytes(raw)
                return f"brand-logos/{slug}.png"
        except Exception:
            continue
    return None


def main() -> int:
    variants_by_brand: dict[str, list[dict[str, Any]]] = {}

    def add_row(
        brand_key: str,
        platform_label: str,
        statement_name: str,
        rate_raw: str,
        comment: str,
        last_tried: str,
        source_sheet: str,
    ) -> None:
        if brand_key not in BRAND_CATALOG:
            return
        slug, brand_name, domain, primary_segment, default_cat = BRAND_CATALOG[brand_key]
        rate, status_label = parse_rate(rate_raw)
        exempt_cat, mcc, eff_cat, tip = classify_sbi_exemption(
            brand_key, platform_label, statement_name, comment, rate, default_cat
        )
        arr = variants_by_brand.setdefault(brand_key, [])
        vid = f"{slug}_{len(arr) + 1}"
        # Avoid exact duplicates across Sheet1 & NEW
        norm_stmt = re.sub(r"\s+", " ", statement_name.strip())
        for ex in arr:
            if (
                ex["statement_descriptor"].lower() == norm_stmt.lower()
                and ex["sbi_cashback_status"] == status_label
                and ex["platform_label"].lower() == platform_label.lower()
            ):
                if tip and not ex.get("payment_page_tip"):
                    ex["payment_page_tip"] = tip
                return
        arr.append(
            {
                "variant_id": vid,
                "platform_label": platform_label.strip() or brand_name,
                "statement_descriptor": norm_stmt or "Merchant Direct / App Gateway",
                "sbi_cashback_rate_pct": rate,
                "sbi_cashback_status": status_label,
                "sbi_exemption_category": exempt_cat,
                "probable_mcc": mcc,
                "effective_spend_category": eff_cat,
                "payment_page_tip": tip,
                "comment": comment.strip() or None,
                "last_tried_date": last_tried.strip() or None,
                "source_sheet": source_sheet,
            }
        )

    # Parse NEW (gid=835884080)
    with RAW_NEW.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            if i <= 1 or not any(c.strip() for c in row):
                continue
            row = (row + [""] * 6)[:6]
            m_name, stmt_name, cb_raw, _contrib, comment, tried = row
            if m_name.strip().lower() == "ryze gums":
                continue
            bkey = resolve_brand_key(m_name, stmt_name)
            add_row(bkey, m_name, stmt_name, cb_raw, comment, tried, "NEW")

    # Parse Sheet1 (gid=0) carrying forward merged platform col B where empty
    last_group = ""
    with RAW_OLD.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            if i == 0 or not any(c.strip() for c in row):
                continue
            row = (row + [""] * 7)[:7]
            _sno, grp, sub_platform, biller, sbi_cb, _contrib, extra_note = row
            if grp.strip():
                last_group = grp.strip()
            combined_name = f"{last_group} {sub_platform}".strip() if sub_platform.strip() else last_group
            if not combined_name or (not biller.strip() and not sbi_cb.strip()):
                continue
            # Keep especially valuable rows from Sheet1 (Amazon MarketPlace 0%, Urban Company 0%, Simpl 0%, NetMeds, Tata 1mg, DMart, FTH Daily, Gyftr, MakeMyTrip, Redbus, Paytm tags)
            bkey = resolve_brand_key(sub_platform or last_group, biller)
            add_row(
                bkey,
                sub_platform.strip() or combined_name,
                biller.replace("\n", " "),
                sbi_cb,
                extra_note,
                "",
                "Sheet1",
            )

    # Add curated verified entries for Zepto & Policybazaar
    add_row(
        "zepto",
        "Zepto / Zepto Super Saver (incl. Amazon Pay GC Trick)",
        "ZEPTO MARKETPLACE PRIVATE",
        "5%",
        "Zepto bills under Online Grocery/Merchant MCC — earns 10% on HSBC Live+ & 5% on SBI Cashback; buying Amazon Pay GV on Zepto via HSBC Live+ passes 10% toward utility/insurance!",
        "2026-11",
        "Community",
    )
    add_row(
        "policybazaar",
        "Policybazaar Insurance Premiums",
        "POLICYBAZAAR INSURANCE BR",
        "0%",
        "Insurance MCC 6300 is 0% on SBI Cashback; use Amazon Pay Balance (10% via HSBC Live+ Zepto GV hack) or Amazon Pay ICICI / Tata Neu Infinity.",
        "2026-11",
        "Community",
    )

    # Fetch brand logos concurrently
    brand_keys = sorted(variants_by_brand.keys(), key=lambda k: BRAND_CATALOG[k][1].lower())
    logo_map: dict[str, str | None] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        futs = {
            pool.submit(verify_and_download_logo, BRAND_CATALOG[k][0], BRAND_CATALOG[k][2]): k
            for k in brand_keys
        }
        for fut in concurrent.futures.as_completed(futs):
            k = futs[fut]
            try:
                logo_map[k] = fut.result()
            except Exception:
                logo_map[k] = None

    brands_out: list[dict[str, Any]] = []
    for k in brand_keys:
        slug, brand_name, domain, primary_segment, default_cat = BRAND_CATALOG[k]
        vlist = variants_by_brand[k]
        statuses = {v["sbi_cashback_status"] for v in vlist}
        has_five = "5%" in statuses
        has_zero = "0% Exempt" in statuses
        has_one = "1%" in statuses

        if has_five and (has_zero or has_one):
            overall_status = "Mixed — Check Statement Name"
            has_trap = True
        elif has_five:
            overall_status = "5% Safe"
            has_trap = False
        elif has_zero or has_one:
            overall_status = "0% Exempt"
            has_trap = True
        else:
            overall_status = "Check Status"
            has_trap = False

        exempt_reasons = [
            v["sbi_exemption_category"]
            for v in vlist
            if v.get("sbi_exemption_category")
        ]
        sbi_exemption_reason = exempt_reasons[0] if exempt_reasons else None

        tips = [v["payment_page_tip"] for v in vlist if v.get("payment_page_tip")]
        if has_trap and has_five:
            watchout = tips[0] if tips else "Payment gateway descriptor decides 5% vs 0%! Verify statement merchant name before confirming payment."
        elif has_zero:
            watchout = tips[0] if tips else f"Falls under SBI Cashback exemption ({sbi_exemption_reason or 'Excluded MCC'}). Switch to your top category card."
        elif has_five:
            watchout = tips[0] if tips else "Verified 5% online eligible on SBI Cashback Card up to ₹2,000/cycle online cap."
        else:
            watchout = "Community verification incomplete — test with a small spend or pay via a general rewards card."

        # Choose primary effective spend category dynamically if all rows are exempt in another category
        eff_cats = [v["effective_spend_category"] for v in vlist]
        resolved_default_cat = eff_cats[0] if all(v["sbi_cashback_rate_pct"] == 0.0 for v in vlist) else default_cat

        brands_out.append(
            {
                "brand_slug": slug,
                "brand_name": brand_name,
                "website": f"https://{domain}",
                "domain": domain,
                "logo_path": logo_map.get(k),
                "primary_segment": primary_segment,
                "default_spend_category": resolved_default_cat,
                "overall_sbi_status": overall_status,
                "sbi_exemption_reason": sbi_exemption_reason,
                "has_descriptor_trap": has_trap,
                "payment_watchout": watchout,
                "variants": vlist,
            }
        )

    payload = {
        "schema_version": "2026.11-merchants-v1",
        "source_sheet_url": "https://docs.google.com/spreadsheets/d/1lPaRsXh4E4IZ1iddB90egKqseQuE2A_gIgHvs7DSGNc/edit?gid=835884080",
        "total_brands": len(brands_out),
        "total_descriptors": sum(len(b["variants"]) for b in brands_out),
        "segments": sorted({b["primary_segment"] for b in brands_out}),
        "brands": brands_out,
    }

    OUT_MASTER.parent.mkdir(parents=True, exist_ok=True)
    OUT_WEB.parent.mkdir(parents=True, exist_ok=True)
    OUT_MOB_DATA.parent.mkdir(parents=True, exist_ok=True)

    OUT_MASTER.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    compact_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    OUT_WEB.write_text(compact_json)
    OUT_MOB_DATA.write_text(compact_json)

    # Generate static React Native require() map for offline-safe local brand logos on iOS
    lines = [
        "import type { ImageSourcePropType } from 'react-native';",
        "",
        "export const BRAND_LOGOS: Record<string, ImageSourcePropType> = {",
    ]
    for b in brands_out:
        if b["logo_path"]:
            fname = b["logo_path"].split("/")[-1]
            lines.append(f"  '{b['brand_slug']}': require('../../assets/brand-logos/{fname}'),")
    lines.append("};")
    lines.append("")
    OUT_MOB_LOGO_MAP.write_text("\n".join(lines))

    logos_ok = sum(1 for b in brands_out if b["logo_path"])
    print(
        f"Built merchant_mcc_directory.json: {len(brands_out)} brands, "
        f"{payload['total_descriptors']} billing descriptors, {logos_ok}/{len(brands_out)} verified internet logos!"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
