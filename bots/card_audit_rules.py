"""
AI-Audited Reward Rates, Monthly Reward Caps, Golf Privileges & Market Rating Calibration
for Indian Credit Cards across 13 verticals.
"""

from __future__ import annotations

import re
from typing import Any

# Benchmark effective return % + real monthly reward cap (in INR reward value/month, None = uncapped)
CURATED_CALC_OVERRIDES: dict[str, dict[str, Any]] = {
    "sbi_cashback_sbi_card": {
        "rates": {
            "online_shopping_general": 5.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 5.0,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 0.87,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "online_shopping_general": 5000,
            "amazon_flipkart_myntra": 5000,
            "dining_swiggy_zomato": 5000,
            "groceries_quick_commerce": 5000,
            "travel_flights_hotels": 5000,
            "offline_general_other": 5000,
        },
        "capping": [
            "5% cashback across almost all online merchants (1% offline) with Rs. 5,000/month combined statement credit cap across online + offline spends.",
            "Excludes utility bills, rent, education, insurance, wallet load, jewelry, fuel, railway tickets, and gift cards.",
        ],
    },
    "hsbc_bank_live_plus_credit_card": {
        "rates": {
            "online_shopping_general": 10.0,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 10.0,
            "groceries_quick_commerce": 10.0,
            "travel_flights_hotels": 1.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 10.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -2.35,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {
            "online_shopping_general": 1200,
            "dining_swiggy_zomato": 1200,
            "groceries_quick_commerce": 1200,
            "utilities_bills_telecom": 1200,
        },
        "capping": [
            "10% cashback across dining, food delivery, groceries (D-Mart/supermarkets/Blinkit/Zepto/Swiggy/Zomato), eligible shopping (excl. Amazon & Flipkart; Myntra promo till Oct 31, 2026) & utility bill payments — combined cap Rs. 1,200/month (up to Rs. 12,000 monthly spend).",
            "1.5% UNLIMITED cashback on Amazon, Flipkart, travel & general offline/online retail spends (excluded: fuel, rent, wallet, jewelry, insurance, hospitals, local transport, tax).",
        ],
    },
    "hdfc_bank_phonepe_ultimo_credit_card": {
        "rates": {
            "online_shopping_general": 5.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 5.0,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 10.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 10.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "utilities_bills_telecom": 1000,
            "travel_flights_hotels": 1000,
            "online_shopping_general": 500,
            "amazon_flipkart_myntra": 500,
            "dining_swiggy_zomato": 500,
            "groceries_quick_commerce": 500,
            "upi_scan_and_pay": 500,
        },
        "capping": [
            "10% reward points (Rs.1/pt) on utilities, recharges, movies & travel on PhonePe (capped Rs. 1,000/month).",
            "5% on Amazon, Flipkart, Myntra, Ajio, Swiggy, Zomato & Uber (capped Rs. 500/month) + 1% on Scan & Pay RuPay UPI (capped Rs. 500/month).",
        ],
    },
    "hdfc_bank_phonepe_uno_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 2.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 2.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {
            "utilities_bills_telecom": 500,
            "travel_flights_hotels": 500,
            "amazon_flipkart_myntra": 500,
            "upi_scan_and_pay": 500,
        },
        "capping": [
            "2% on PhonePe utilities, recharges, travel & movies (cap Rs. 500/month); 1% on major online brands (cap Rs. 500/month); 1% on Scan & Pay UPI (cap Rs. 500/month).",
        ],
    },
    "sbi_bank_phonepe_select_black_credit_card": {
        "rates": {
            "online_shopping_general": 5.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 5.0,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 10.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 10.0,
            "fuel": 0.0,
            "insurance": 10.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "utilities_bills_telecom": 1500,
            "travel_flights_hotels": 1500,
            "insurance": 500,
            "online_shopping_general": 1000,
            "amazon_flipkart_myntra": 1000,
            "dining_swiggy_zomato": 1000,
            "groceries_quick_commerce": 1000,
            "upi_scan_and_pay": 2000,
            "offline_general_other": 2000,
        },
        "capping": [
            "10% on PhonePe utilities & travel (cap 1,500 RP/month) + 10% on insurance via PhonePe (cap 500 RP/month); 5% on eligible online spends (cap 1,000 RP/month); 1% UPI & offline (cap 2,000 RP/month).",
        ],
    },
    "sbi_bank_phonepe_purple_credit_card": {
        "rates": {
            "online_shopping_general": 2.0,
            "amazon_flipkart_myntra": 2.0,
            "dining_swiggy_zomato": 2.0,
            "groceries_quick_commerce": 2.0,
            "travel_flights_hotels": 3.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 3.0,
            "fuel": 0.0,
            "insurance": 3.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "utilities_bills_telecom": 750,
            "travel_flights_hotels": 750,
            "insurance": 250,
            "online_shopping_general": 750,
            "upi_scan_and_pay": 1000,
        },
        "capping": [
            "3% on PhonePe utilities/travel (cap 750 RP/mo) & PhonePe insurance (cap 250 RP/mo); 2% on eligible online spends (cap 750 RP/mo); 1% other/UPI (cap 1,000 RP/mo).",
        ],
    },
    "hdfc_bank_swiggy_credit_card": {
        "rates": {
            "online_shopping_general": 5.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 10.0,
            "groceries_quick_commerce": 10.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "dining_swiggy_zomato": 1500,
            "groceries_quick_commerce": 1500,
            "online_shopping_general": 1500,
            "amazon_flipkart_myntra": 1500,
            "offline_general_other": 500,
        },
        "capping": [
            "10% direct cashback on Swiggy Food/Instamart/Dineout capped at Rs. 1,500/billing cycle; 5% across Amazon/Flipkart/Myntra/apparel/dept online MCCs capped at Rs. 1,500/cycle; 1% other capped at Rs. 500/cycle.",
        ],
    },
    "hdfc_bank_swiggy_blck_hdfc_credit_card": {
        "rates": {
            "online_shopping_general": 5.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 10.0,
            "groceries_quick_commerce": 10.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "dining_swiggy_zomato": 2000,
            "groceries_quick_commerce": 2000,
            "online_shopping_general": 1500,
            "amazon_flipkart_myntra": 1500,
        },
        "capping": [
            "10% on Swiggy ecosystem + Swiggy BLCK VIP perks; 5% on major online MCCs capped monthly.",
        ],
    },
    "axis_bank_airtel_axis_bank_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 10.0,
            "groceries_quick_commerce": 10.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 25.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "utilities_bills_telecom": 500,
            "dining_swiggy_zomato": 200,
            "groceries_quick_commerce": 200,
        },
        "capping": [
            "April 12, 2026 Devaluation: 25% Airtel (cap Rs. 250/mo) & 10% Utility via Airtel Thanks (cap Rs. 250/mo) unlock ONLY in proportion to monthly 1% base retail spend (Rs. 25k/mo base spend needed for full Rs. 500 cap; Rs. 0 base spend = Rs. 0 utility cashback). 10% on Zomato, Blinkit & District Movies (min order Rs. 499, Rs. 200/partner cap; Swiggy & BigBasket removed); 0 domestic lounges.",
        ],
    },
    "icici_amazon_pay_icici_bank_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 2.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 2.0,
            "fuel": 0.0,
            "insurance": 1.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "UNLIMITED 5% Amazon Pay cashback for Prime members on Amazon.in (3% non-Prime); 2% on Amazon Pay bills/recharges/flights/100+ partners; 1% uncapped on general online, dining, groceries & offline.",
        ],
    },
    "hdfc_bank_millennia_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 5.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 1.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 1000,
            "dining_swiggy_zomato": 1000,
        },
        "capping": [
            "5% CashPoints strictly on Amazon, Flipkart, Myntra, Swiggy, Zomato, BookMyShow, Tata CLiQ, Uber, SonyLIV & Cult.fit (shared ₹1,000/month cap = ₹20k spend); 1% on offline dining & general spends.",
        ],
        "category_caveats": {
            "amazon_flipkart_myntra": "5% on Amazon, Flipkart, Myntra, Tata CLiQ & SonyLIV (shared ₹1,000/mo CashPoints cap across all 5% merchants).",
            "dining_swiggy_zomato": "5% applies strictly on Swiggy & Zomato (plus Uber/Cult.fit); direct offline restaurants earn 1%.",
        },
    },
    "axis_bank_flipkart_axis_bank_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 4.0,
            "groceries_quick_commerce": 1.5,
            "travel_flights_hotels": 4.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -2.63,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 2667,
            "dining_swiggy_zomato": 1333,
            "travel_flights_hotels": 1333,
        },
        "capping": [
            "7.5% on Myntra (max Rs. 4,000/qtr) & 5% on Flipkart/Cleartrip (max Rs. 4,000/qtr each); 4% on Swiggy/PVR/Uber (max Rs. 4,000/qtr); 1% base.",
        ],
    },
    "axis_bank_ace_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 4.0,
            "groceries_quick_commerce": 1.5,
            "travel_flights_hotels": 1.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 5.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -2.63,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {
            "utilities_bills_telecom": 500,
            "dining_swiggy_zomato": 500,
        },
        "capping": [
            "5% on GPay bill payments/recharges & 4% on Swiggy/Zomato/Ola combined capped at Rs. 500/month; 1.5% uncapped base cashback offline & general online.",
        ],
    },
    "hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 1.5,
            "utilities_bills_telecom": 5.0,
            "fuel": 0.0,
            "insurance": 5.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -0.86,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {
            "upi_scan_and_pay": 500,
            "utilities_bills_telecom": 2000,
            "insurance": 2000,
        },
        "capping": [
            "5% NeuCoins (+5% NeuPass = 10% total on Tata Neu app) on BigBasket, Air India, Taj/IHCL, Croma & Tata 1mg; utilities & insurance capped at 2,000 NeuCoins/month.",
            "1.5% on RuPay UPI via Tata Neu app (capped at 500 NeuCoins/month = Rs. 33,333 UPI spend).",
        ],
    },
    "sbi_bank_tata_neu_infinity_sbi_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 1.5,
            "utilities_bills_telecom": 5.0,
            "fuel": 0.0,
            "insurance": 5.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -0.86,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {
            "upi_scan_and_pay": 500,
            "utilities_bills_telecom": 2000,
            "insurance": 2000,
        },
        "capping": [
            "5% NeuCoins (+5% NeuPass) across BigBasket, Air India, Taj, Croma; 1.5% on UPI via Tata Neu app (capped 500 NeuCoins/month).",
        ],
    },
    "hdfc_bank_tata_neu_hdfc_bank_credit_cards": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 2.0,
            "travel_flights_hotels": 2.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 2.0,
            "fuel": 0.0,
            "insurance": 2.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "upi_scan_and_pay": 500,
            "utilities_bills_telecom": 2000,
        },
        "capping": [
            "2% NeuCoins (+5% NeuPass) on Tata brands; 1% on RuPay UPI via Tata Neu app (capped at 500 NeuCoins/month).",
        ],
    },
    "hdfc_bank_infinia_credit_card": {
        "rates": {
            "online_shopping_general": 3.33,
            "amazon_flipkart_myntra": 16.5,
            "dining_swiggy_zomato": 3.33,
            "groceries_quick_commerce": 3.33,
            "travel_flights_hotels": 16.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 3.33,
            "fuel": 0.0,
            "insurance": 3.33,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 0.97,
            "offline_general_other": 3.33,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 15000,
            "travel_flights_hotels": 15000,
            "utilities_bills_telecom": 2000,
            "insurance": 10000,
        },
        "capping": [
            "Base 3.33% (5 RP/Rs.150 at Rs.1/RP on flights/hotels/Apple/Tanishq); 16.5% (5X) on flights & GyFTR vouchers and 33% (10X) on hotels via SmartBuy.",
            "SmartBuy accelerated RP capped at 15,000 RP/month; Insurance capped at 10,000 RP/month (5,000 RP/day eff. July 2025); Utilities capped at 2,000 RP/month; Rent & Govt/Tax earn 0%.",
        ],
        "category_caveats": {
            "insurance": "3.33% base RPs capped at 10,000 RP/month (5,000 RP/day) under HDFC July 2025 circular.",
            "education_rent_govt": "0% on Rent and Government/Tax transactions (only HDFC BizBlack earns rewards on Income Tax/GST).",
            "utilities_bills_telecom": "3.33% capped at 2,000 RP/month.",
        },
    },
    "hdfc_bank_hdfc_diners_club_black_credit_card": {
        "rates": {
            "online_shopping_general": 3.33,
            "amazon_flipkart_myntra": 10.0,
            "dining_swiggy_zomato": 3.33,
            "groceries_quick_commerce": 3.33,
            "travel_flights_hotels": 16.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 3.33,
            "fuel": 0.0,
            "insurance": 3.33,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 0.97,
            "offline_general_other": 3.33,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 10000,
            "travel_flights_hotels": 10000,
            "utilities_bills_telecom": 2000,
            "insurance": 5000,
        },
        "capping": [
            "Base 3.33% + up to 10X on SmartBuy (capped 10,000 RP/day and 10,000 RP/month bonus) + 10,000 bonus RP per Rs. 4L quarterly milestone; Insurance capped at 5,000 RP/mo (July 2025); Rent & Govt earn 0%.",
        ],
        "category_caveats": {
            "insurance": "3.33% base RPs capped at 5,000 RP/month (2,000 RP/day) per HDFC July 2025 policy.",
            "education_rent_govt": "0% on Rent and Government/Tax transactions.",
            "utilities_bills_telecom": "3.33% capped at 2,000 RP/month.",
        },
    },
    "hdfc_bank_hdfc_regalia_gold_credit_card": {
        "rates": {
            "online_shopping_general": 1.33,
            "amazon_flipkart_myntra": 6.66,
            "dining_swiggy_zomato": 1.33,
            "groceries_quick_commerce": 1.33,
            "travel_flights_hotels": 6.66,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 1.33,
            "fuel": 0.0,
            "insurance": 1.33,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -1.03,
            "offline_general_other": 1.33,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 2500,
            "travel_flights_hotels": 2000,
            "utilities_bills_telecom": 2000,
            "insurance": 2500,
        },
        "capping": [
            "Base ~1.33% (4 RP/Rs.150 at Rs.0.50 SmartBuy travel); 5X on Myntra/Nykaa/M&S/Reliance Digital (cap 5,000 RP/mo); up to 10X SmartBuy (cap 4,000 RP/mo); Rent & Govt/Tax earn 0%.",
        ],
        "category_caveats": {
            "education_rent_govt": "0% on Rent and Government/Tax transactions per HDFC MITC.",
            "insurance": "1.33% base RPs capped at 5,000 RP/month (~₹2,500 flight value) + 2,000 RP/day.",
        },
    },
    "hdfc_bank_diners_club_privilege_credit_card": {
        "rates": {
            "online_shopping_general": 1.33,
            "amazon_flipkart_myntra": 1.33,
            "dining_swiggy_zomato": 6.66,
            "groceries_quick_commerce": 1.33,
            "travel_flights_hotels": 6.66,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 1.33,
            "fuel": 0.0,
            "insurance": 1.33,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -1.03,
            "offline_general_other": 1.33,
        },
        "monthly_caps_inr": {
            "dining_swiggy_zomato": 2500,
            "travel_flights_hotels": 2500,
        },
        "capping": [
            "1.33% base (4 RP/Rs.150 at Rs.0.50 travel value); 5X (6.67%) on Swiggy/Zomato/BookMyShow up to 2,500 RP/month; Rs. 1,500 quarterly voucher at Rs. 1.5L spend.",
        ],
    },
    "hdfc_bank_biz_black_credit_card": {
        "rates": {
            "online_shopping_general": 3.33,
            "amazon_flipkart_myntra": 16.5,
            "dining_swiggy_zomato": 3.33,
            "groceries_quick_commerce": 3.33,
            "travel_flights_hotels": 16.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 16.5,
            "fuel": 0.0,
            "insurance": 3.33,
            "education_rent_govt": 16.5,
            "international_forex_net_of_markup": 0.97,
            "offline_general_other": 3.33,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 15000,
            "education_rent_govt": 7500,
            "utilities_bills_telecom": 7500,
            "travel_flights_hotels": 15000,
            "insurance": 5000,
        },
        "capping": [
            "3.33% base + 5X (16.5%) on Income Tax, GST, PayZapp utilities & SmartBuy business spends (business 5X bonus capped at 7,500 RP/cycle on >= Rs. 50,000 monthly spend); Insurance capped 5,000 RP/mo.",
        ],
        "category_caveats": {
            "education_rent_govt": "16.5% (5X) applies strictly to Income Tax / GST via PayZapp on Rs. 50k+ monthly spend (7,500 RP/cycle cap); Rent earns 0%.",
            "insurance": "3.33% base RPs capped at 5,000 RP/month per HDFC July 2025 policy.",
        },
    },
    "icici_bank_emeralde_private_metal_credit_card": {
        "rates": {
            "online_shopping_general": 3.0,
            "amazon_flipkart_myntra": 18.0,
            "dining_swiggy_zomato": 3.0,
            "groceries_quick_commerce": 3.0,
            "travel_flights_hotels": 18.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 3.0,
            "fuel": 0.0,
            "insurance": 3.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 0.64,
            "offline_general_other": 3.0,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 18000,
            "travel_flights_hotels": 18000,
            "utilities_bills_telecom": 5000,
            "insurance": 5000,
        },
        "capping": [
            "3% base (6 RP/Rs.200 at Rs.1/RP) on Insurance & Utilities (each capped at 5,000 RP/cycle); up to 18%-36% via iShop flights/hotels/vouchers (cap 18,000 RP/mo); Rent & Govt/Tax excluded.",
        ],
        "category_caveats": {
            "insurance": "3% (6 RP/Rs.200) capped at 5,000 RP per statement cycle on ICICI Bank terms.",
            "utilities_bills_telecom": "3% (6 RP/Rs.200) capped at 5,000 RP per statement cycle.",
            "education_rent_govt": "0% on Rent and Government/Tax transactions per icicibank.com exclusions.",
        },
    },
    "icici_bank_icici_bank_sapphiro_visa_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 2.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 4.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -2.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "Strong lifestyle perks (2x BOGO BookMyShow up to Rs. 500, DreamFolks golf & spa/lounge at Rs. 75k quarterly spend); modest ~1% domestic reward rate unless booked via iShop.",
        ],
    },
    "axis_bank_atlas_credit_card": {
        "rates": {
            "online_shopping_general": 4.0,
            "amazon_flipkart_myntra": 4.0,
            "dining_swiggy_zomato": 4.0,
            "groceries_quick_commerce": 4.0,
            "travel_flights_hotels": 10.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -0.13,
            "offline_general_other": 4.0,
        },
        "monthly_caps_inr": {
            "travel_flights_hotels": 20000,
        },
        "capping": [
            "2 EDGE Miles/Rs.100 (~4% Accor / airline partner value at 1:2 Group A transfer) uncapped base; 5 EDGE Miles/Rs.100 (~10% value) on direct airlines/hotels/Travel EDGE up to Rs. 2L spend/month.",
            "30,000 Group A annual transfer limit/year; excludes utilities, rent, gold, wallet, govt, fuel, insurance.",
        ],
    },
    "axis_bank_magnus_burgundy_credit_card": {
        "rates": {
            "online_shopping_general": 4.8,
            "amazon_flipkart_myntra": 4.8,
            "dining_swiggy_zomato": 4.8,
            "groceries_quick_commerce": 4.8,
            "travel_flights_hotels": 14.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 2.44,
            "offline_general_other": 4.8,
        },
        "monthly_caps_inr": {
            "travel_flights_hotels": 25000,
        },
        "capping": [
            "4.8% (12 ER/Rs.200 at 5:4 Group A/Accor transfer) up to Rs. 1.5L/mo; leaps to ~14% (35 ER/Rs.200) on incremental spends above Rs. 1.5L/month; 2.0% low forex markup yields positive net international value!",
        ],
    },
    "hsbc_bank_travelone_credit_card": {
        "rates": {
            "online_shopping_general": 2.0,
            "amazon_flipkart_myntra": 2.0,
            "dining_swiggy_zomato": 2.0,
            "groceries_quick_commerce": 2.0,
            "travel_flights_hotels": 8.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -2.13,
            "offline_general_other": 2.0,
        },
        "monthly_caps_inr": {
            "travel_flights_hotels": 18000,
        },
        "capping": [
            "2% uncapped base points + 4% direct flights/travel aggregators + up to 8%-12% Accor/airline partner value via HSBC Rewards Marketplace (capped 18,000 bonus RP/month); Utilities (MCC 4900), Insurance (MCC 6300), Tax & Education earn 0%.",
        ],
        "category_caveats": {
            "utilities_bills_telecom": "0% — utility MCCs (4900) excluded on HSBC TravelOne per hsbc.bank.in.",
            "insurance": "0% — insurance MCCs (6300/5960) excluded per hsbc.bank.in.",
        },
    },
    "hsbc_premier_credit_card": {
        "rates": {
            "online_shopping_general": 3.0,
            "amazon_flipkart_myntra": 3.0,
            "dining_swiggy_zomato": 3.0,
            "groceries_quick_commerce": 3.0,
            "travel_flights_hotels": 12.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 3.0,
            "fuel": 0.0,
            "insurance": 3.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 1.83,
            "offline_general_other": 3.0,
        },
        "monthly_caps_inr": {
            "travel_flights_hotels": 18000,
        },
        "capping": [
            "Ultra-low 0.99% forex markup (1.17% incl GST) yields positive +1.83% NET international return at 3% base points! Unlimited domestic + international airport lounge.",
        ],
    },
    "federal_bank_scapia_credit_card": {
        "rates": {
            "online_shopping_general": 2.0,
            "amazon_flipkart_myntra": 2.0,
            "dining_swiggy_zomato": 2.0,
            "groceries_quick_commerce": 2.0,
            "travel_flights_hotels": 4.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 0.0,
            "offline_general_other": 2.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "TRUE 0% forex markup globally (0% reward on international txns = exact XE rate!). 2% effective return domestic + 4% on Scapia Travel; unlimited domestic lounge on Rs. 10k Visa / Rs. 15k RuPay monthly spend.",
        ],
    },
    "au_small_finance_bank_ixigo_au_credit_card": {
        "rates": {
            "online_shopping_general": 1.25,
            "amazon_flipkart_myntra": 1.25,
            "dining_swiggy_zomato": 1.25,
            "groceries_quick_commerce": 1.25,
            "travel_flights_hotels": 2.5,
            "upi_scan_and_pay": 0.5,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 0.0,
            "offline_general_other": 1.25,
        },
        "monthly_caps_inr": {},
        "capping": [
            "TRUE 0% forex markup + no-spend international Priority Pass (1/yr) & 8+ domestic/railway lounges; 2.5% online / 1.25% offline.",
        ],
    },
    "au_small_finance_bank_zenith_plus_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 2.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 2.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 0.83,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "0.99% low forex markup (1.17% incl GST) with 2% international & travel rewards = +0.83% net overseas return; plus 8 complimentary golf rounds/lessons per year.",
        ],
    },
    "indusind_bank_tiger_credit_card": {
        "rates": {
            "online_shopping_general": 1.2,
            "amazon_flipkart_myntra": 1.2,
            "dining_swiggy_zomato": 1.2,
            "groceries_quick_commerce": 1.2,
            "travel_flights_hotels": 1.2,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.7,
            "fuel": 0.0,
            "insurance": 0.7,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -0.57,
            "offline_general_other": 1.2,
        },
        "monthly_caps_inr": {},
        "capping": [
            "Lifetime Free card with 1.5% low forex markup, 8 domestic + 2 international Priority Pass visits without spend criteria, and 4 complimentary golf rounds/year.",
        ],
    },
    "indusind_bank_eazy_diner_indusind_bank_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 15.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "dining_swiggy_zomato": 2000,
        },
        "capping": [
            "25%–50% off on PayEazy restaurant dining bills (max Rs. 1,000 discount/bill, up to 2–3x/mo) + free EazyDiner Prime membership.",
        ],
    },
    "yes_bank_klick_credit_card": {
        "rates": {
            "online_shopping_general": 0.5,
            "amazon_flipkart_myntra": 0.5,
            "dining_swiggy_zomato": 2.0,
            "groceries_quick_commerce": 2.0,
            "travel_flights_hotels": 0.5,
            "upi_scan_and_pay": 2.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {
            "upi_scan_and_pay": 1500,
        },
        "capping": [
            "2% flat Scan & Pay UPI cashback via Kiwi app (scales up to 5% effective with Kiwi Neon milestones on Rs. 1.5L/yr).",
        ],
    },
    "axis_bank_axis_supermoney_rupay_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 3.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "upi_scan_and_pay": 500,
        },
        "capping": [
            "3% Scan & Pay UPI cashback via super.money app capped at Rs. 500/month (Rs. 16,667 UPI spend/month); 1% other eligible spends.",
        ],
    },
    "idfc_first_bank_idfc_first_hpcl_power_plus_credit_card": {
        "rates": {
            "online_shopping_general": 0.67,
            "amazon_flipkart_myntra": 0.67,
            "dining_swiggy_zomato": 0.67,
            "groceries_quick_commerce": 2.5,
            "travel_flights_hotels": 0.67,
            "upi_scan_and_pay": 0.67,
            "utilities_bills_telecom": 2.5,
            "fuel": 6.5,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.46,
            "offline_general_other": 0.67,
        },
        "monthly_caps_inr": {
            "fuel": 750,
            "groceries_quick_commerce": 500,
            "utilities_bills_telecom": 500,
        },
        "capping": [
            "Up to 6.5% total savings at HPCL pumps via HP Pay app + FASTag/surcharge waiver (capped around Rs. 10,000–Rs. 12,000 monthly fuel spend); 2.5% grocery/utilities.",
        ],
    },
    "sbi_bank_sbi_bpcl_credit_card_octane": {
        "rates": {
            "online_shopping_general": 0.25,
            "amazon_flipkart_myntra": 0.25,
            "dining_swiggy_zomato": 2.5,
            "groceries_quick_commerce": 2.5,
            "travel_flights_hotels": 0.25,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 6.25,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.88,
            "offline_general_other": 0.25,
        },
        "monthly_caps_inr": {
            "fuel": 1250,
        },
        "capping": [
            "6.25% net value at BPCL pumps (25 RP/Rs.100 @ Rs.0.25/RP minus surcharge adjustment) capped at 2,500 RP (~Rs. 625) + surcharge waiver up to Rs. 10,000/mo spend.",
        ],
    },
    "rbl_bank_indianoil_rbl_xtra_credit_card": {
        "rates": {
            "online_shopping_general": 0.5,
            "amazon_flipkart_myntra": 0.5,
            "dining_swiggy_zomato": 0.5,
            "groceries_quick_commerce": 0.5,
            "travel_flights_hotels": 0.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 7.5,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.63,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {
            "fuel": 1000,
        },
        "capping": [
            "7.5% value-back (15 Fuel Points per Rs.100 @ Rs.0.50/pt) at IndianOil outlets, capped at 2,000 Fuel Points (~Rs. 1,000/month on ~Rs. 13,333 fuel spend).",
        ],
    },
    "axis_bank_indianoil_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 0.5,
            "groceries_quick_commerce": 0.5,
            "travel_flights_hotels": 0.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 4.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.63,
            "offline_general_other": 0.2,
        },
        "monthly_caps_inr": {
            "fuel": 200,
        },
        "capping": [
            "4% value at IndianOil pumps on transactions Rs. 400–Rs. 4,000 (capped at 1,000 EDGE RP = Rs. 200/month on Rs. 5,000 fuel spend).",
        ],
    },
    "hdfc_bank_indianoil_hdfc_bank_credit_card": {
        "rates": {
            "online_shopping_general": 0.5,
            "amazon_flipkart_myntra": 0.5,
            "dining_swiggy_zomato": 0.5,
            "groceries_quick_commerce": 2.5,
            "travel_flights_hotels": 0.5,
            "upi_scan_and_pay": 0.5,
            "utilities_bills_telecom": 2.5,
            "fuel": 5.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.63,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {
            "fuel": 250,
            "groceries_quick_commerce": 250,
            "utilities_bills_telecom": 250,
        },
        "capping": [
            "5% Fuel Points at IndianOil (up to 250 FP/mo in 1st 6 months, 150 FP/mo thereafter) shared with groceries & bill pay (~2.5% practical post-cap value); 1 Fuel Point = Rs. 0.96 on IndianOil.",
        ],
        "category_caveats": {
            "utilities_bills_telecom": "Shares the 250 FP/mo (150 FP/mo after 6m) bucket with Fuel & Groceries; effective value ~2.5% after shared monthly cap.",
            "groceries_quick_commerce": "Shares 250 FP/mo (150 FP/mo after 6m) bucket with Fuel & Utilities.",
        },
    },
    "amex_bank_american_express_platinum_travel_credit_cards": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 1.0,
            "fuel": 0.0,
            "insurance": 1.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "True ~7.5%–10% return is unlocked on exact Rs. 4,00,000 annual spend (40,000 bonus MR Points + Rs. 10,000 Taj Stay voucher + 8,000 base MR); counts toward insurance, NPS/tax exclusion workaround via Reward Multiplier vouchers.",
        ],
    },
    "amex_bank_american_express_gold_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 1.0,
            "fuel": 0.0,
            "insurance": 1.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 1000,
        },
        "capping": [
            "High Rs. 4,500+GST renewal fee (hard to justify after Rs. 1k/mo 6xRs.1,000 bonus & GyFTR Reward Multiplier cap); best only if transferring Gold Collection MR to Marriott.",
        ],
    },
    "sbi_bank_aurum_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 1.0,
            "fuel": 0.0,
            "insurance": 1.0,
            "education_rent_govt": 1.0,
            "international_forex_net_of_markup": -1.35,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "Invite-only metal card: real ~3%–5% yield comes from Rs. 1,500 monthly BookMyShow voucher, Rs. 1L/month milestone Rs. 1,500 Tatacliq/brand voucher, unlimited international PP + 16 golf lessons/rounds.",
        ],
    },
    "yes_bank_marquee_credit_card": {
        "rates": {
            "online_shopping_general": 2.25,
            "amazon_flipkart_myntra": 2.25,
            "dining_swiggy_zomato": 2.25,
            "groceries_quick_commerce": 2.25,
            "travel_flights_hotels": 2.25,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 1.07,
            "offline_general_other": 1.12,
        },
        "monthly_caps_inr": {},
        "capping": [
            "2.25% on almost ALL online spends (36 RP/Rs.200 at Rs.0.125/pt travel) + 1.0% low forex markup (+GST -> positive +1.07% net international yield); unlimited international lounge + 3 BOGO movies/mo.",
        ],
    },
    "idfc_first_bank_mayura_credit_card": {
        "rates": {
            "online_shopping_general": 2.5,
            "amazon_flipkart_myntra": 2.5,
            "dining_swiggy_zomato": 2.5,
            "groceries_quick_commerce": 1.25,
            "travel_flights_hotels": 2.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.83,
            "fuel": 0.0,
            "insurance": 0.83,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 2.5,
            "offline_general_other": 1.25,
        },
        "monthly_caps_inr": {},
        "capping": [
            "TRUE ZERO (0%) forex markup while STILL earning 2.5% rewards internationally (points never expire!), plus up to 24 golf rounds/lessons/year.",
        ],
    },
    "idfc_first_bank_idfc_first_wealth_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -0.27,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "Lifetime Free metal/premium card with 1.5% low forex markup, BOGO movie tickets, and monthly milestone tiers (after Rs. 20k/mo spend).",
        ],
    },
    "standard_chartered_bank_ultimate_credit_card": {
        "rates": {
            "online_shopping_general": 3.33,
            "amazon_flipkart_myntra": 3.33,
            "dining_swiggy_zomato": 3.33,
            "groceries_quick_commerce": 3.33,
            "travel_flights_hotels": 3.33,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 2.0,
            "fuel": 0.0,
            "insurance": 2.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 1.33,
            "offline_general_other": 3.33,
        },
        "monthly_caps_inr": {},
        "capping": [
            "3.33% flat value (5 RP/Rs.150 @ Rs.1/RP) with 2% forex markup; utilities, supermarkets & insurance earn reduced 2% (3 RP/Rs.150 = ~2% uncapped on most retail MCCs per sc.bank.in); Rent excluded.",
        ],
        "category_caveats": {
            "insurance": "Reduced rate 3 RP/Rs.150 (2%) per sc.bank.in; check current rewards catalogue.",
            "utilities_bills_telecom": "Reduced rate 2% per sc.bank.in.",
            "education_rent_govt": "Rent excluded from reward accrual.",
        },
    },
    "rbl_bank_world_safari_credit_card": {
        "rates": {
            "online_shopping_general": 0.5,
            "amazon_flipkart_myntra": 0.5,
            "dining_swiggy_zomato": 0.5,
            "groceries_quick_commerce": 0.5,
            "travel_flights_hotels": 1.25,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 0.0,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {},
        "capping": [
            "True 0% forex markup (no base rewards on international forex); MakeMyTrip vouchers on milestones + 4 complimentary golf rounds/yr.",
        ],
    },
    "hdfc_bank_tata_neu_infinity_hdfc_fd_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 1.5,
            "utilities_bills_telecom": 5.0,
            "fuel": 0.0,
            "insurance": 5.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -0.86,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {
            "upi_scan_and_pay": 500,
            "utilities_bills_telecom": 2000,
            "insurance": 2000,
        },
        "capping": [
            "FD-backed variant: 5% NeuCoins (+5% NeuPass on Tata Neu) on BigBasket, Air India, Taj & Croma; 1.5% on Tata Neu UPI (capped 500 NeuCoins/mo).",
        ],
    },
    "hsbc_bank_rupay_cashback_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 10.0,
            "groceries_quick_commerce": 10.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "dining_swiggy_zomato": 400,
            "groceries_quick_commerce": 400,
        },
        "capping": [
            "10% cashback on dining, grocery & food delivery strictly capped at Rs. 400/month combined (max Rs. 4,000/mo spend); 1% unlimited on UPI & other eligible spends.",
        ],
    },
    "yes_bank_paisabazaar_paisasave_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 6.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 6.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "dining_swiggy_zomato": 3000,
            "travel_flights_hotels": 3000,
        },
        "capping": [
            "6% cashback (12 RP/Rs.200) across Dining (Swiggy/Zomato/restaurants) & Travel combined capped at Rs. 3,000/month (up to Rs. 50,000/mo spend); 1% uncapped base.",
        ],
    },
    "idfc_first_bank_idfc_first_millennia_credit_card": {
        "rates": {
            "online_shopping_general": 0.75,
            "amazon_flipkart_myntra": 0.75,
            "dining_swiggy_zomato": 1.67,
            "groceries_quick_commerce": 0.75,
            "travel_flights_hotels": 1.67,
            "upi_scan_and_pay": 0.5,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -2.63,
            "offline_general_other": 0.75,
        },
        "monthly_caps_inr": {},
        "capping": [
            "3 RP/Rs.150 (~0.5%–0.75%) base up to Rs. 20k/month; 10X (~1.67%) on incremental spend > Rs. 20k/mo and dining/travel; Travel & Shop app hotel/flight bonus points subject to portal caps.",
        ],
    },
    "idfc_first_bank_idfc_first_classic_credit_card": {
        "rates": {
            "online_shopping_general": 0.75,
            "amazon_flipkart_myntra": 0.75,
            "dining_swiggy_zomato": 1.67,
            "groceries_quick_commerce": 0.75,
            "travel_flights_hotels": 1.67,
            "upi_scan_and_pay": 0.5,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -2.63,
            "offline_general_other": 0.75,
        },
        "monthly_caps_inr": {},
        "capping": [
            "3X base (~0.5%–0.75%) up to Rs. 20k/mo; 10X (~1.67%) on dining, travel & incremental monthly spend above Rs. 20,000 (points never expire).",
        ],
    },
    "idfc_first_bank_idfc_first_select_credit_card": {
        "rates": {
            "online_shopping_general": 0.75,
            "amazon_flipkart_myntra": 0.75,
            "dining_swiggy_zomato": 1.25,
            "groceries_quick_commerce": 0.75,
            "travel_flights_hotels": 1.5,
            "upi_scan_and_pay": 0.5,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -1.1,
            "offline_general_other": 0.75,
        },
        "monthly_caps_inr": {},
        "capping": [
            "Lifetime Free card with 1.99% low forex markup, BOGO movies up to Rs. 250, and 10 RP/Rs.200 (~1.25%) on dining/travel/intl spends.",
        ],
    },
    "idfc_first_bank_idfc_first_earn_credit_card": {
        "rates": {
            "online_shopping_general": 0.5,
            "amazon_flipkart_myntra": 0.5,
            "dining_swiggy_zomato": 0.5,
            "groceries_quick_commerce": 0.5,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 0.0,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {
            "upi_scan_and_pay": 500,
            "utilities_bills_telecom": 500,
        },
        "capping": [
            "FD-backed RuPay UPI card: 1% cashback via IDFC FIRST app (0.5% on 3rd-party UPI apps & utilities/insurance), total cashback capped at Rs. 500/month.",
        ],
    },
    "idfc_first_bank_swyp_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "dining_swiggy_zomato": 160,
            "travel_flights_hotels": 500,
        },
        "capping": [
            "Milestone-based RP earn (up to ~1%–1.5% at Rs. 5k/10k/15k monthly tiers) plus capped brand discount coupons (Domino's Rs. 80x2, Tata CLiQ Rs. 100, EaseMyTrip Rs. 500).",
        ],
    },
    "axis_bank_samsung_axis_bank_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 2.0,
            "dining_swiggy_zomato": 2.0,
            "groceries_quick_commerce": 2.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 1.0,
            "fuel": 0.0,
            "insurance": 1.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 2500,
        },
        "capping": [
            "10% cashback applies ONLY to Samsung brand purchases (capped at Rs. 2,500/month & Rs. 10,000/year); Myntra/Zomato/BigBasket/Tata 1mg earn 10 EDGE RP/Rs.100 (~2%), 1% base elsewhere.",
        ],
    },
    "axis_bank_samsung_axis_bank_infinite_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 3.0,
            "dining_swiggy_zomato": 3.0,
            "groceries_quick_commerce": 3.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 1.0,
            "fuel": 0.0,
            "insurance": 1.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 5000,
        },
        "capping": [
            "10% cashback applies ONLY to Samsung purchases (capped at Rs. 5,000/month & Rs. 20,000/year); 15 EDGE RP/Rs.100 (~3%) on Myntra/Zomato/BigBasket; Rs. 7L annual fee waiver.",
        ],
    },
    "federal_bank_rupay_wave_credit_card": {
        "rates": {
            "online_shopping_general": 0.25,
            "amazon_flipkart_myntra": 0.25,
            "dining_swiggy_zomato": 0.25,
            "groceries_quick_commerce": 0.25,
            "travel_flights_hotels": 0.25,
            "upi_scan_and_pay": 0.5,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.88,
            "offline_general_other": 0.25,
        },
        "monthly_caps_inr": {
            "upi_scan_and_pay": 250,
        },
        "capping": [
            "10% cashback is an introductory promo on only the first 5 UPI txns; ongoing earn is ~0.125%–0.25% base (1 RP/Rs.200) + 1,000 bonus RP per Rs. 50k quarterly milestone.",
        ],
    },
    "icici_bank_icici_bank_expression_credit_card": {
        "rates": {
            "online_shopping_general": 0.75,
            "amazon_flipkart_myntra": 0.75,
            "dining_swiggy_zomato": 0.75,
            "groceries_quick_commerce": 0.75,
            "travel_flights_hotels": 0.75,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.25,
            "fuel": 0.0,
            "insurance": 0.25,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.38,
            "offline_general_other": 0.75,
        },
        "monthly_caps_inr": {},
        "capping": [
            "3 ICICI RP/Rs.100 (~0.75%) retail base, 1 RP/Rs.100 (0.25%) on utilities & insurance; 25% off up to Rs. 100 twice/month is limited strictly to BookMyShow tickets.",
        ],
    },
    "sbm_bank_zet_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 2.0,
            "groceries_quick_commerce": 2.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 2.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 500,
            "dining_swiggy_zomato": 200,
            "groceries_quick_commerce": 200,
            "upi_scan_and_pay": 500,
        },
        "capping": [
            "FD-backed LTF card: 2% UPI via ZET app & 5% on Amazon/Flipkart vouchers (capped monthly); 20% off Swiggy/Zomato/Instamart capped at Rs. 100–200/month.",
        ],
    },
    "indian_overseas_bank_iob_zet_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 2.0,
            "groceries_quick_commerce": 2.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 2.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 500,
            "dining_swiggy_zomato": 200,
            "groceries_quick_commerce": 200,
            "upi_scan_and_pay": 500,
        },
        "capping": [
            "FD-backed LTF card: 2% UPI via ZET & 5% on Amazon/Flipkart vouchers; Swiggy/Zomato/Instamart coupon discounts capped at Rs. 100–200/month.",
        ],
    },
    "standard_chartered_bank_standard_chartered_beyond_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 1.5,
            "travel_flights_hotels": 3.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 1.0,
            "fuel": 0.0,
            "insurance": 1.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -1.5,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {
            "travel_flights_hotels": 1500,
        },
        "capping": [
            "Ultra-luxury lifestyle card (Rs. 25,000 fee): 15% cashback is restricted strictly to Duty-Free spends (capped Rs. 1,500/month); general travel/base earn is ~1.5%–3%.",
        ],
    },
    "kotak_mahindra_bank_pvr_inox_kotak_credit_card": {
        "rates": {
            "online_shopping_general": 0.5,
            "amazon_flipkart_myntra": 0.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 0.5,
            "travel_flights_hotels": 0.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.63,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {
            "dining_swiggy_zomato": 600,
        },
        "capping": [
            "Milestone-based PVR INOX movie tickets (1 free ticket per Rs. 10,000 monthly spend) + 5% F&B / 20% in-cinema discounts; ~0.5% non-cinema value.",
        ],
    },
    "hsbc_bank_hsbc_smart_value_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 0.75,
            "travel_flights_hotels": 0.75,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 1.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.38,
            "offline_general_other": 0.75,
        },
        "monthly_caps_inr": {},
        "capping": [
            "3X RP (~1.5% value) on Dining, Telecom & Online shopping; 0.75% base elsewhere (50% Google Pay max Rs. 100 is first-txn welcome promo only).",
        ],
    },
    "standard_chartered_bank_easemytrip_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "travel_flights_hotels": 5000,
        },
        "capping": [
            "10%–20% instant discount capped per transaction on EaseMyTrip flights/hotels (~5% blended travel value); 10 RP/Rs.100 on standalone hotel & airline spends.",
        ],
    },
    "standard_chartered_bank_digismart_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 2.0,
            "dining_swiggy_zomato": 2.0,
            "groceries_quick_commerce": 2.0,
            "travel_flights_hotels": 2.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.63,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 700,
            "dining_swiggy_zomato": 500,
            "groceries_quick_commerce": 500,
            "travel_flights_hotels": 750,
        },
        "capping": [
            "Instant discount caps on Myntra/Zomato/Grofers/INOX/Yatra (10%–20% off capped Rs. 150–750 per order); 0.5% base rewards; monthly fee Rs. 49 waived at Rs. 5k/mo spend.",
        ],
    },
    "sbi_bank_flipkart_sbi_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 4.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 2667,
            "travel_flights_hotels": 1333,
            "dining_swiggy_zomato": 1333,
        },
        "capping": [
            "7.5% Myntra (cap Rs. 4,000/qtr), 5% Flipkart & Cleartrip (cap Rs. 4,000 each/qtr), 4% Zomato/Uber/Netmeds (cap Rs. 4,000/qtr); 1% unlimited base.",
        ],
    },
    "sbi_bank_sbi_bpcl_credit_card": {
        "rates": {
            "online_shopping_general": 0.25,
            "amazon_flipkart_myntra": 0.25,
            "dining_swiggy_zomato": 1.25,
            "groceries_quick_commerce": 1.25,
            "travel_flights_hotels": 0.25,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 3.25,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.88,
            "offline_general_other": 0.25,
        },
        "monthly_caps_inr": {
            "fuel": 1300,
            "dining_swiggy_zomato": 1250,
            "groceries_quick_commerce": 1250,
        },
        "capping": [
            "13X RP (3.25% rewards + 1% surcharge waiver = 4.25% total) at BPCL pumps up to 1,300 RP/billing cycle; 5X (1.25%) groceries/dining/movies capped 5,000 RP/mo.",
        ],
    },
    "kotak_mahindra_bank_kotak_cashback_plus_credit_card": {
        "rates": {
            "online_shopping_general": 0.5,
            "amazon_flipkart_myntra": 0.5,
            "dining_swiggy_zomato": 5.0,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 0.5,
            "upi_scan_and_pay": 0.5,
            "utilities_bills_telecom": 0.0,
            "fuel": 3.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.63,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {
            "dining_swiggy_zomato": 500,
            "groceries_quick_commerce": 500,
            "fuel": 500,
        },
        "capping": [
            "5% on online food/grocery/entertainment & 3% on fuel — COMBINED cap of Rs. 500/month total accelerated cashback; 0.5% unlimited base.",
        ],
    },
    "kotak_mahindra_bank_kotak_cashback_plus_prime_credit_card": {
        "rates": {
            "online_shopping_general": 0.5,
            "amazon_flipkart_myntra": 0.5,
            "dining_swiggy_zomato": 5.0,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 0.5,
            "upi_scan_and_pay": 0.5,
            "utilities_bills_telecom": 0.0,
            "fuel": 3.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.63,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {
            "dining_swiggy_zomato": 750,
            "groceries_quick_commerce": 750,
            "fuel": 750,
            "insurance": 125,
        },
        "capping": [
            "5% on online food/grocery/entertainment/auto & 3% on fuel — COMBINED cap of Rs. 750/month; 0.5% on insurance (capped Rs. 25k/mo spend) & other spends.",
        ],
    },
    "axis_bank_axis_bank_cashback_credit_card": {
        "rates": {
            "online_shopping_general": 4.5,
            "amazon_flipkart_myntra": 4.5,
            "dining_swiggy_zomato": 0.75,
            "groceries_quick_commerce": 0.75,
            "travel_flights_hotels": 0.75,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.38,
            "offline_general_other": 0.75,
        },
        "monthly_caps_inr": {
            "online_shopping_general": 4000,
            "amazon_flipkart_myntra": 4000,
            "utilities_bills_telecom": 100,
        },
        "capping": [
            "Tiered online cashback: 2% up to Rs.5k (Rs.100), 5% on Rs.5k–40k (Rs.1,750), 7% > Rs.40k (max Rs.2,150) = Rs. 4,000/mo total online cap; 0.5% utilities capped Rs.100/mo.",
        ],
    },
    "idfc_first_bank_hello_cashback_credit_card": {
        "rates": {
            "online_shopping_general": 4.0,
            "amazon_flipkart_myntra": 4.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 2.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 1.0,
            "fuel": 0.0,
            "insurance": 1.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -2.5,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "online_shopping_general": 1000,
            "amazon_flipkart_myntra": 1000,
        },
        "capping": [
            "3% online up to Rs. 10k/mo + 5% incremental above Rs. 10k/mo (~4% blended), capped at Rs. 1,000/month combined online cashback; 1% offline/UPI (IDFC app).",
        ],
    },
    "hdfc_bank_hdfc_pixel_play_fd_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 3.0,
            "dining_swiggy_zomato": 5.0,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 1.0,
            "fuel": 0.0,
            "insurance": 1.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 500,
            "dining_swiggy_zomato": 500,
            "groceries_quick_commerce": 500,
            "travel_flights_hotels": 500,
            "upi_scan_and_pay": 500,
        },
        "capping": [
            "5% on chosen 2 packs & SmartBuy capped at 500 pts/mo per bucket; 3% chosen e-com merchant capped 500 pts/mo; 1% UPI capped 500 pts/mo.",
        ],
    },
    "hdfc_bank_swiggy_ornge_hdfc_credit_card": {
        "rates": {
            "online_shopping_general": 5.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 5.0,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "online_shopping_general": 1500,
            "amazon_flipkart_myntra": 1500,
            "dining_swiggy_zomato": 1500,
            "groceries_quick_commerce": 1500,
            "travel_flights_hotels": 1000,
            "offline_general_other": 1000,
        },
        "capping": [
            "5% cashback on Swiggy & select online partners combined capped at Rs. 1,500/month; 1% on other eligible spends capped at Rs. 1,000/month.",
        ],
    },
    "au_small_finance_bank_au_kosmo_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 1.5,
            "travel_flights_hotels": 1.5,
            "upi_scan_and_pay": 2.5,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -2.63,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {
            "upi_scan_and_pay": 1500,
            "online_shopping_general": 1500,
        },
        "capping": [
            "1.5% base on Kiwi Scan & Pay (scales to 5% on Rs. 1.5L/yr Kiwi Neon milestones); monthly cashback capped relative to credit limit.",
        ],
    },
    "utkarsh_bank_utkarsh_supermoney_rupay_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 3.5,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 500,
            "upi_scan_and_pay": 500,
        },
        "capping": [
            "FD-backed LTF RuPay card: 5% Myntra / 2% Flipkart / 1% UPI via Super.Money app (each capped Rs. 500/cycle).",
        ],
    },
    "sbi_bank_sbi_eternal_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 6.0,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 2.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "dining_swiggy_zomato": 1500,
            "groceries_quick_commerce": 1500,
        },
        "capping": [
            "Co-branded Zomato/Blinkit offers (up to 10% Zomato/District/Bistro & 5% Blinkit/partners subject to monthly/order offer caps).",
        ],
    },
    "credit_card_axis_bank_reserve_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 2.5,
            "groceries_quick_commerce": 1.5,
            "travel_flights_hotels": 3.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 1.23,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {},
        "capping": [
            "Rs. 50k+GST ultra-luxury card: 15 EDGE RP/Rs.200 (~1.5%) domestic & 30 EDGE RP/Rs.200 (~3%) intl; hotel/dining % off are partner tier privileges.",
        ],
    },
    "hsbc_bank_taj_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 2.5,
            "groceries_quick_commerce": 1.5,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 1.23,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {
            "travel_flights_hotels": 15000,
        },
        "capping": [
            "Rs. 1.1L+GST Taj Platinum card: 1.5% base & 5% at Taj/IHCL wallets; 25% Taj BAR/F&B discounts apply only at participating Taj Palaces.",
        ],
    },
    "rbl_bank_rbl_quickpay_credit_card": {
        "rates": {
            "online_shopping_general": 0.25,
            "amazon_flipkart_myntra": 0.25,
            "dining_swiggy_zomato": 0.25,
            "groceries_quick_commerce": 0.25,
            "travel_flights_hotels": 0.25,
            "upi_scan_and_pay": 0.25,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.88,
            "offline_general_other": 0.25,
        },
        "monthly_caps_inr": {
            "upi_scan_and_pay": 500,
        },
        "capping": [
            "1 RP/Rs.200 (~0.25%); '20% cashback capped Rs. 50' is a one-time welcome offer on the first 2 UPI txns only.",
        ],
    },
    "rbl_bank_rbl_upi_wala_credit_card": {
        "rates": {
            "online_shopping_general": 0.25,
            "amazon_flipkart_myntra": 0.25,
            "dining_swiggy_zomato": 0.25,
            "groceries_quick_commerce": 0.25,
            "travel_flights_hotels": 0.25,
            "upi_scan_and_pay": 0.25,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.88,
            "offline_general_other": 0.25,
        },
        "monthly_caps_inr": {
            "upi_scan_and_pay": 500,
        },
        "capping": [
            "1 RP/Rs.200 (~0.25%); '20% cashback capped Rs. 50' is a one-time welcome promo on the first 2 UPI txns within 15 days.",
        ],
    },
    "axis_bank_axis_bank_neo_credit_cards": {
        "rates": {
            "online_shopping_general": 0.1,
            "amazon_flipkart_myntra": 0.1,
            "dining_swiggy_zomato": 0.1,
            "groceries_quick_commerce": 0.1,
            "travel_flights_hotels": 0.1,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -4.03,
            "offline_general_other": 0.1,
        },
        "monthly_caps_inr": {},
        "capping": [
            "0.10% base EDGE RP (1 RP/Rs. 200). Headline Zomato 40% (max Rs. 120 twice/mo), Blinkit 10% (max Rs. 100/mo) & Paytm 5% (max Rs. 150/mo) are coupon-code promo discounts, not open % reward earn.",
        ],
    },
    "axis_bank_axis_bank_my_zone_credit_cards": {
        "rates": {
            "online_shopping_general": 0.4,
            "amazon_flipkart_myntra": 0.4,
            "dining_swiggy_zomato": 0.4,
            "groceries_quick_commerce": 0.4,
            "travel_flights_hotels": 0.4,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.73,
            "offline_general_other": 0.4,
        },
        "monthly_caps_inr": {},
        "capping": [
            "0.40% base EDGE RP (4 RP/Rs. 200). Swiggy Rs. 120 off twice/mo (MOV Rs. 500), District 1+1 movies & AJIO coupons are promo-code discounts, not open category % cashback.",
        ],
    },
    "axis_bank_my_zone_easy_credit_card": {
        "rates": {
            "online_shopping_general": 0.4,
            "amazon_flipkart_myntra": 0.4,
            "dining_swiggy_zomato": 0.4,
            "groceries_quick_commerce": 0.4,
            "travel_flights_hotels": 0.4,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.73,
            "offline_general_other": 0.4,
        },
        "monthly_caps_inr": {},
        "capping": [
            "0.40% base EDGE RP; movie/shopping benefits are capped promo coupon discounts.",
        ],
    },
    "yes_bank_popclub_credit_card": {
        "rates": {
            "online_shopping_general": 5.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.01,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "online_shopping_general": 1500,
            "amazon_flipkart_myntra": 1500,
        },
        "capping": [
            "5% value back as POPcoins (10 POPcoins/Rs. 100, redeemed inside POPclub ecosystem) on online transactions; 1% base elsewhere; fuel is 1% surcharge waiver only (0% rewards).",
        ],
    },
    "csb_bank_edge_plus_csb_rupay_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 10.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "amazon_flipkart_myntra": 1500,
            "travel_flights_hotels": 1000,
            "online_shopping_general": 1000,
            "upi_scan_and_pay": 1000,
        },
        "capping": [
            "10% cashback on Amazon/Flipkart/Myntra/Tata/Reliance shopping brands (category cap Rs. 1,500/mo, Rs. 500/merchant); 5% on top travel OTAs (cap Rs. 1,000/mo); 1% on general/UPI spends (cap Rs. 1,000/mo).",
        ],
    },
    "indusind_bank_cred_indusind_rupay_credit_card": {
        "rates": {
            "online_shopping_general": 5.0,
            "amazon_flipkart_myntra": 2.0,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 1.5,
            "travel_flights_hotels": 2.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "online_shopping_general": 1000,
            "upi_scan_and_pay": 500,
        },
        "capping": [
            "5% cashback on CRED Pay e-commerce checkouts (cap Rs. 1,000/mo); 1% on RuPay UPI & offline retail (cap Rs. 500/mo); fuel/utilities/rent excluded.",
        ],
    },
    "unity_small_finance_bank_roar_bank_rupay_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 5.0,
            "groceries_quick_commerce": 2.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "dining_swiggy_zomato": 1500,
            "groceries_quick_commerce": 1000,
        },
        "capping": [
            "Rotating chosen monthly boost categories up to 5%–10% capped at Rs. 1,500/mo; 1% base on retail & RuPay UPI; fuel is excluded (surcharge waiver only).",
        ],
    },
    "slice_bank_slice_rupay_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 2.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 1.0,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "upi_scan_and_pay": 750,
        },
        "capping": [
            "LTF Slice SFB RuPay card: up to 3% Slice Monies on Spark & UPI tiers (blended ~2% capped Rs. 750/mo); 1% base retail & 0% forex markup.",
        ],
    },
    "csb_bank_jupiter_edge_csb_rupay_credit_card": {
        "rates": {
            "online_shopping_general": 2.0,
            "amazon_flipkart_myntra": 2.0,
            "dining_swiggy_zomato": 0.4,
            "groceries_quick_commerce": 0.4,
            "travel_flights_hotels": 0.4,
            "upi_scan_and_pay": 0.4,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.73,
            "offline_general_other": 0.4,
        },
        "monthly_caps_inr": {
            "online_shopping_general": 500,
            "amazon_flipkart_myntra": 500,
        },
        "capping": [
            "LTF Edge CSB variant: 2% Jewels on 1 chosen boost category (Shopping, Travel or Dining — cap Rs. 500/mo); 0.4% base on UPI & other retail.",
        ],
    },
}

# Verified Official Bank T&C & r/CreditCardsIndia Fixes (Nov 2026)
CURATED_CALC_OVERRIDES.update({
    "hsbc_bank_live_plus_credit_card": {
        "rates": {
            "online_shopping_general": 10.0,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 10.0,
            "groceries_quick_commerce": 10.0,
            "travel_flights_hotels": 1.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 10.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -0.85,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {
            "online_shopping_general": 1200,
            "dining_swiggy_zomato": 1200,
            "groceries_quick_commerce": 1200,
            "utilities_bills_telecom": 1200,
        },
        "capping": [
            "10% cashback across dining, food delivery, groceries, eligible shopping (excl. Amazon & Flipkart) & utility bills (MCC 4900) — combined shared cap of Rs. 1,200/month (up to Rs. 12,000 monthly spend); 1.5% uncapped after cap or on Amazon/Flipkart/travel.",
            "r/CreditCardsIndia caveat: Direct govt/state electricity boards billed under MCC 9399 yield 0%/1.5%; pay via Paytm/Airtel/Amazon Pay utility channels (MCC 4900) where eligible.",
        ],
        "category_caveats": {
            "online_shopping_general": "10% applies to eligible dining/apparel/dept MCCs sharing Rs. 1,200/mo pool; Amazon & Flipkart earn 1.5% uncapped.",
            "dining_swiggy_zomato": "Shares Rs. 1,200/month 10% cashback pool across dining, groceries, eligible shopping & utilities.",
            "groceries_quick_commerce": "Shares Rs. 1,200/month 10% cashback pool across dining, groceries, eligible shopping & utilities.",
            "utilities_bills_telecom": "Shares Rs. 1,200/month 10% pool on MCC 4900 only; direct govt utility portals (MCC 9399) yield 0%/1.5% — route via Paytm/Airtel MCC 4900.",
        },
    },
    "hsbc_premier_credit_card": {
        "rates": {
            "online_shopping_general": 3.0,
            "amazon_flipkart_myntra": 3.0,
            "dining_swiggy_zomato": 3.0,
            "groceries_quick_commerce": 3.0,
            "travel_flights_hotels": 12.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 1.83,
            "offline_general_other": 3.0,
        },
        "monthly_caps_inr": {"travel_flights_hotels": 18000},
        "capping": [
            "0.99% forex markup (1.17% incl. GST) yields +1.83% NET international return at 3% base points; Insurance (MCC 6300/5960), Utilities (MCC 4900), Education, Tax & Fuel earn 0% per hsbc.bank.in.",
        ],
        "category_caveats": {
            "insurance": "0% — insurance MCCs (6300/5960) excluded on HSBC Premier per hsbc.bank.in.",
            "utilities_bills_telecom": "0% — utility MCCs (4900) excluded per hsbc.bank.in.",
            "education_rent_govt": "0% — education, rent & government/tax MCCs excluded per hsbc.bank.in.",
        },
    },
    "hsbc_bank_rupay_cashback_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 10.0,
            "groceries_quick_commerce": 10.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -4.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {"dining_swiggy_zomato": 400, "groceries_quick_commerce": 400},
        "capping": [
            "10% cashback on dining, grocery & food delivery strictly capped at Rs. 400/month combined (Rs. 4,000/mo spend); 1% on UPI & domestic retail; 0% cashback on international transactions (3.5%+GST standard forex markup; check HSBC limited-time 0% promo).",
        ],
        "category_caveats": {
            "dining_swiggy_zomato": "Shares Rs. 400/month combined 10% cashback cap with groceries/food delivery; 1% base after cap.",
            "groceries_quick_commerce": "Shares Rs. 400/month combined 10% cashback cap with dining; 1% base after cap.",
            "international_forex_net_of_markup": "Earns 0% international rewards; standard 3.5%+GST forex markup (subject to limited-time HSBC 0% forex promotional waiver).",
        },
    },
    "hdfc_bank_swiggy_credit_card": {
        "rates": {
            "online_shopping_general": 5.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 10.0,
            "groceries_quick_commerce": 10.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "dining_swiggy_zomato": 1500,
            "groceries_quick_commerce": 1500,
            "online_shopping_general": 1500,
            "amazon_flipkart_myntra": 1500,
            "offline_general_other": 500,
        },
        "capping": [
            "10% strictly on Swiggy Food, Instamart & Dineout (capped Rs. 1,500/cycle — Zomato & offline dining earn 1%); 5% on Amazon/Flipkart/Myntra/apparel online MCCs (capped Rs. 1,500/cycle); 1% other (capped Rs. 500/cycle).",
        ],
        "category_caveats": {
            "dining_swiggy_zomato": "10% applies STRICTLY to Swiggy Food & Dineout (shared Rs. 1,500/mo Swiggy pool); offline dining & Zomato earn 1%.",
            "groceries_quick_commerce": "10% applies STRICTLY to Swiggy Instamart (shared Rs. 1,500/mo Swiggy pool).",
            "online_shopping_general": "5% on eligible online apparel/dept MCCs (shared Rs. 1,500/mo pool with Amazon/Flipkart).",
        },
    },
    "hdfc_bank_swiggy_blck_hdfc_credit_card": {
        "rates": {
            "online_shopping_general": 5.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 10.0,
            "groceries_quick_commerce": 10.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "dining_swiggy_zomato": 2000,
            "groceries_quick_commerce": 2000,
            "online_shopping_general": 1500,
            "amazon_flipkart_myntra": 1500,
        },
        "capping": [
            "10% strictly on Swiggy Food/Instamart/Dineout (Rs. 2,000/mo pool); 5% on major online MCCs (Rs. 1,500/mo pool).",
        ],
        "category_caveats": {
            "dining_swiggy_zomato": "10% applies strictly on Swiggy Food & Dineout; Zomato & general offline dining earn 1%.",
            "groceries_quick_commerce": "10% applies strictly on Swiggy Instamart.",
        },
    },
    "hdfc_bank_phonepe_ultimo_credit_card": {
        "rates": {
            "online_shopping_general": 5.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 5.0,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 10.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 8.2,
            "fuel": 0.0,
            "insurance": 8.2,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "utilities_bills_telecom": 1000,
            "travel_flights_hotels": 1000,
            "insurance": 1000,
            "amazon_flipkart_myntra": 500,
            "groceries_quick_commerce": 500,
            "dining_swiggy_zomato": 500,
            "upi_scan_and_pay": 500,
        },
        "capping": [
            "10% reward points ONLY when paid inside PhonePe App on Utilities, Insurance & Travel (net ~8.2% on bills/insurance after ~1.8% PhonePe convenience fee; 0% outside PhonePe App; combined cap Rs. 1,000/mo); 5% on select online partners (cap Rs. 500/mo); 1% Scan & Pay UPI (cap Rs. 500/mo).",
        ],
        "category_caveats": {
            "insurance": "10% gross ONLY via PhonePe App (~8.2% net after ~1.8% convenience fee); 0% on offline swipe / direct insurer portal / external UPI; shares Rs. 1,000/mo pool.",
            "utilities_bills_telecom": "10% gross ONLY via PhonePe App (~8.2% net after ~1.8% convenience fee); 0% outside PhonePe; shares Rs. 1,000/mo pool.",
            "travel_flights_hotels": "10% strictly inside PhonePe Travel; shares Rs. 1,000/mo pool.",
        },
    },
    "hdfc_bank_phonepe_uno_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 2.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {
            "utilities_bills_telecom": 500,
            "travel_flights_hotels": 500,
            "insurance": 500,
            "amazon_flipkart_myntra": 500,
            "upi_scan_and_pay": 500,
        },
        "capping": [
            "2% gross ONLY via PhonePe App on Utilities, Travel & Insurance (~0.5% net on bills/insurance after ~1.5% PhonePe convenience fee; 0% outside PhonePe; shared Rs. 500/mo cap); 1% online & UPI (cap Rs. 500/mo each).",
        ],
        "category_caveats": {
            "insurance": "2% gross via PhonePe App (~0.5% net after ~1.5% convenience fee); 0% offline swipe or direct insurer.",
            "utilities_bills_telecom": "2% gross via PhonePe App (~0.5% net after ~1.5% convenience fee); 0% outside PhonePe.",
        },
    },
    "sbi_bank_phonepe_select_black_credit_card": {
        "rates": {
            "online_shopping_general": 5.0,
            "amazon_flipkart_myntra": 5.0,
            "dining_swiggy_zomato": 5.0,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 10.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 8.2,
            "fuel": 0.0,
            "insurance": 8.2,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "utilities_bills_telecom": 1500,
            "travel_flights_hotels": 1500,
            "insurance": 500,
            "online_shopping_general": 1000,
            "amazon_flipkart_myntra": 1000,
            "dining_swiggy_zomato": 1000,
            "groceries_quick_commerce": 1000,
            "upi_scan_and_pay": 2000,
            "offline_general_other": 2000,
        },
        "capping": [
            "10% RPs ONLY via PhonePe App on Insurance (cap 500 RP/mo; net ~8.2% after ~1.8% convenience fee) and Utilities/Travel (cap 1,500 RP/mo; ~8.2% net on bills) — offline swipe / direct insurer / external UPI earn 0%; 5% online (cap 1,000 RP/mo); 1% UPI & offline (cap 2,000 RP/mo).",
        ],
        "category_caveats": {
            "insurance": "10% RPs ONLY inside PhonePe App (~8.2% net after ~1.8% gateway convenience fee; capped at 500 RP/month ~ ₹5k spend); 0% on POS swipe, direct insurer website, or external UPI.",
            "utilities_bills_telecom": "10% RPs ONLY inside PhonePe App (~8.2% net after ~1.8% fee; shares 1,500 RP/month pool with PhonePe Travel); 0% outside PhonePe.",
        },
    },
    "sbi_bank_phonepe_purple_credit_card": {
        "rates": {
            "online_shopping_general": 2.0,
            "amazon_flipkart_myntra": 2.0,
            "dining_swiggy_zomato": 2.0,
            "groceries_quick_commerce": 2.0,
            "travel_flights_hotels": 3.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 1.5,
            "fuel": 0.0,
            "insurance": 1.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "utilities_bills_telecom": 750,
            "travel_flights_hotels": 750,
            "insurance": 250,
            "online_shopping_general": 750,
            "upi_scan_and_pay": 1000,
        },
        "capping": [
            "3% RPs ONLY via PhonePe App on Insurance (cap 250 RP/mo) & Utilities (cap 750 RP/mo) — ~1.5% net after ~1.5% PhonePe convenience fee; 0% on swipe or external UPI; 2% online (cap 750 RP/mo); 1% UPI (cap 1,000 RP/mo).",
        ],
        "category_caveats": {
            "insurance": "3% gross ONLY via PhonePe App (~1.5% net after ~1.5% convenience fee; capped at 250 RP/month); 0% on swipe/direct insurer/external UPI.",
            "utilities_bills_telecom": "3% gross ONLY via PhonePe App (~1.5% net after ~1.5% fee; capped at 750 RP/month); 0% outside PhonePe.",
        },
    },
    "hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 1.5,
            "utilities_bills_telecom": 3.3,
            "fuel": 0.0,
            "insurance": 3.3,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -0.86,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {"upi_scan_and_pay": 500, "utilities_bills_telecom": 2000, "insurance": 2000},
        "capping": [
            "5% NeuCoins via Tata Neu App on Insurance & Utilities (~3.3% net after ~1.5-1.8% Tata Pay convenience fee; 1.5% on direct portals; capped at 2,000 NeuCoins/month per HDFC July 2025 policy); 5% on Tata brands; 1.5% on Tata Neu UPI (cap 500 NeuCoins/mo).",
        ],
        "category_caveats": {
            "insurance": "5% NeuCoins ONLY via Tata Neu App (~3.3% net after ~1.5-1.8% convenience fee); 1.5% on direct insurer site; capped at 2,000 NeuCoins/month.",
            "utilities_bills_telecom": "5% NeuCoins ONLY via Tata Neu App (~3.3% net after convenience fee); 1.5% direct; capped at 2,000 NeuCoins/month.",
            "upi_scan_and_pay": "1.5% NeuCoins via Tata Neu UPI (capped at 500 NeuCoins/month).",
        },
    },
    "hdfc_bank_tata_neu_infinity_hdfc_fd_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 1.5,
            "utilities_bills_telecom": 3.3,
            "fuel": 0.0,
            "insurance": 3.3,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -0.86,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {"upi_scan_and_pay": 500, "utilities_bills_telecom": 2000, "insurance": 2000},
        "capping": [
            "FD-backed variant: 5% NeuCoins via Tata Neu App on Insurance & Utilities (~3.3% net after ~1.7% convenience fee; capped 2,000 NeuCoins/mo); 5% Tata brands; 1.5% Tata Neu UPI (cap 500 NeuCoins/mo).",
        ],
        "category_caveats": {
            "insurance": "5% via Tata Neu App (~3.3% net after ~1.7% convenience fee); 1.5% direct; capped 2,000 NeuCoins/mo.",
            "utilities_bills_telecom": "5% via Tata Neu App (~3.3% net after convenience fee); capped 2,000 NeuCoins/mo.",
        },
    },
    "sbi_bank_tata_neu_infinity_sbi_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 1.5,
            "utilities_bills_telecom": 3.3,
            "fuel": 0.0,
            "insurance": 3.3,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -0.86,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {"upi_scan_and_pay": 500, "utilities_bills_telecom": 2000, "insurance": 2000},
        "capping": [
            "5% NeuCoins via Tata Neu App on Insurance & Utilities (~3.3% net after ~1.7% convenience fee; capped 2,000 NeuCoins/mo); 5% Tata brands; 1.5% Tata Neu UPI (cap 500 NeuCoins/mo).",
        ],
        "category_caveats": {
            "insurance": "5% via Tata Neu App (~3.3% net after ~1.7% convenience fee); capped 2,000 NeuCoins/mo.",
            "utilities_bills_telecom": "5% via Tata Neu App (~3.3% net after convenience fee); capped 2,000 NeuCoins/mo.",
        },
    },
    "hdfc_bank_tata_neu_hdfc_bank_credit_cards": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 2.0,
            "travel_flights_hotels": 2.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {"upi_scan_and_pay": 500, "utilities_bills_telecom": 2000, "insurance": 2000},
        "capping": [
            "2% NeuCoins on Tata brands + 1% on Tata Neu UPI (cap 500 NeuCoins/mo); Insurance & Utilities via Tata Neu App yield ~0.5% net after ~1.5% convenience fee (1% direct insurer).",
        ],
        "category_caveats": {
            "insurance": "2% via Tata Neu App minus ~1.5% convenience fee (~0.5% net); 1% on direct insurer portals.",
            "utilities_bills_telecom": "2% via Tata Neu App minus ~1.5% convenience fee (~0.5% net).",
        },
    },
    "hdfc_bank_tata_neu_plus_hdfc_fd_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 2.0,
            "travel_flights_hotels": 2.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {"upi_scan_and_pay": 500, "utilities_bills_telecom": 2000, "insurance": 2000},
        "capping": [
            "FD-backed Tata Neu Plus: 2% on Tata brands; 1% on RuPay UPI (cap 500 NeuCoins/mo); Insurance & Utilities ~0.5% net via Tata Neu App after convenience fee.",
        ],
        "category_caveats": {
            "upi_scan_and_pay": "1% NeuCoins via Tata Neu UPI (capped 500 NeuCoins/month).",
            "insurance": "2% via Tata Neu App minus ~1.5% convenience fee (~0.5% net).",
        },
    },
    "sbi_bank_tata_neu_plus_sbi_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 2.0,
            "travel_flights_hotels": 2.0,
            "upi_scan_and_pay": 1.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.5,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {"upi_scan_and_pay": 500, "utilities_bills_telecom": 2000, "insurance": 2000},
        "capping": [
            "2% on Tata brands; 1% on Tata Neu UPI (cap 500 NeuCoins/mo); Insurance & Utilities ~0.5% net via Tata Neu App after convenience fee.",
        ],
    },
    "hdfc_bank_marriott_bonvoy_hdfc_credit_card": {
        "rates": {
            "online_shopping_general": 0.8,
            "amazon_flipkart_myntra": 0.8,
            "dining_swiggy_zomato": 1.6,
            "groceries_quick_commerce": 0.8,
            "travel_flights_hotels": 3.2,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.8,
            "fuel": 0.0,
            "insurance": 0.8,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.33,
            "offline_general_other": 0.8,
        },
        "monthly_caps_inr": {},
        "capping": [
            "Exempt from HDFC July 2025 monthly insurance capping: earns uncapped 2 Bonvoy Points/Rs.150 (~0.8% at ~Rs.0.60/pt) on insurance & utilities AND counts toward Rs. 6L / Rs. 9L / Rs. 15L Free Night Award milestones; 4 pts/Rs.150 dining/travel; 8 pts/Rs.150 Marriott.",
        ],
        "category_caveats": {
            "insurance": "Uncapped (exempt from HDFC July 2025 monthly insurance cap per HDFC circular & r/CreditCardsIndia): earns ~0.8% Bonvoy points AND counts toward Free Night Award milestones (₹6L/₹9L/₹15L).",
            "utilities_bills_telecom": "Uncapped 2 Bonvoy pts/Rs.150 (~0.8%) + counts toward Free Night Award milestones.",
        },
    },
    "axis_bank_rewards_credit_card": {
        "rates": {
            "online_shopping_general": 0.5,
            "amazon_flipkart_myntra": 0.5,
            "dining_swiggy_zomato": 0.5,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 0.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.63,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {"groceries_quick_commerce": 1400},
        "capping": [
            "10X EDGE RP on apparel & department stores up to Rs. 7,000/month (~5% effective) + 1,500 bonus RP at Rs. 30,000 monthly spend; Insurance (MCC 6300), Utilities (MCC 4900), Rent & Govt/Tax earn 0% per axis.bank.in.",
        ],
        "category_caveats": {
            "insurance": "0% — insurance (MCC 6300/5960/6381) explicitly excluded from Axis EDGE Rewards.",
            "utilities_bills_telecom": "0% — utility & telecom spends excluded on Axis Rewards.",
            "groceries_quick_commerce": "Accelerated 10X applies specifically to eligible department stores & apparel MCCs up to Rs. 7,000/month.",
        },
    },
    "axis_bank_burgundy_private_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 1.5,
            "travel_flights_hotels": 3.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 1.5,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {},
        "capping": [
            "15 EDGE RP/Rs.200 domestic & international retail (~1.5% base cashback; up to ~3% via 5:4 airline/hotel partners); True 0% forex markup; Insurance, Utilities, Rent, Wallet & Govt/Tax excluded per Axis 2024-2026 T&C.",
        ],
        "category_caveats": {
            "insurance": "0% — excluded per Axis Bank Burgundy Private T&C update (no EDGE RP on insurance).",
            "utilities_bills_telecom": "0% — utility MCCs excluded from EDGE Rewards.",
            "education_rent_govt": "0% — rent, wallet & government/tax spends excluded.",
        },
    },
    "axis_bank_select_credit_card": {
        "rates": {
            "online_shopping_general": 0.8,
            "amazon_flipkart_myntra": 0.8,
            "dining_swiggy_zomato": 0.8,
            "groceries_quick_commerce": 1.6,
            "travel_flights_hotels": 0.8,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.33,
            "offline_general_other": 0.8,
        },
        "monthly_caps_inr": {"groceries_quick_commerce": 800},
        "capping": [
            "20 EDGE RP/Rs.200 on retail shopping (2X capped Rs. 20k/mo) & 10 EDGE RP/Rs.200 base; Insurance, Utilities, Rent & Govt excluded.",
        ],
    },
    "axis_bank_magnus_credit_card": {
        "rates": {
            "online_shopping_general": 2.4,
            "amazon_flipkart_myntra": 2.4,
            "dining_swiggy_zomato": 2.4,
            "groceries_quick_commerce": 2.4,
            "travel_flights_hotels": 12.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -1.73,
            "offline_general_other": 2.4,
        },
        "monthly_caps_inr": {"travel_flights_hotels": 24000},
        "capping": [
            "12 EDGE RP/Rs.200 up to Rs. 1.5L/mo (~2.4% via 5:2 partner transfer) and 35 ER/Rs.200 above Rs. 1.5L/mo; 60 ER/Rs.200 on Travel EDGE; Insurance, Utilities, Rent & Govt/Tax excluded.",
        ],
    },
    "axis_bank_aura_credit_card": {
        "rates": {
            "online_shopping_general": 0.4,
            "amazon_flipkart_myntra": 0.4,
            "dining_swiggy_zomato": 0.4,
            "groceries_quick_commerce": 0.4,
            "travel_flights_hotels": 0.4,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 2.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.73,
            "offline_general_other": 0.4,
        },
        "monthly_caps_inr": {"insurance": 200},
        "capping": [
            "Legacy / Discontinued card: 5X EDGE RP on insurance spends capped at Rs. 10,000 per transaction (~2% capped ~Rs. 200/txn).",
        ],
        "category_caveats": {
            "insurance": "Legacy discontinued card — 5X (~2%) insurance capped at Rs. 10,000 per transaction.",
        },
    },
    "axis_bank_freecharge_plus_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 5.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "5% cashback strictly on Freecharge App utility/bill/recharge spends (0% on utility payments made outside Freecharge App).",
        ],
        "category_caveats": {
            "utilities_bills_telecom": "5% strictly inside Freecharge App only; external utility payments earn 0% per axis.bank.in.",
        },
    },
    "sbi_bank_simplyclick_credit_card": {
        "rates": {
            "online_shopping_general": 1.25,
            "amazon_flipkart_myntra": 2.5,
            "dining_swiggy_zomato": 0.25,
            "groceries_quick_commerce": 0.25,
            "travel_flights_hotels": 0.25,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.88,
            "offline_general_other": 0.25,
        },
        "monthly_caps_inr": {"amazon_flipkart_myntra": 2500, "online_shopping_general": 2500},
        "capping": [
            "10X (2.5%) strictly on Apollo 24x7, BookMyShow, Cleartrip, Dominos, IGP, Myntra, Netmeds, Swiggy & Yatra (cap 10,000 RP/mo); 5X (1.25%) other online spends; 0.25% offline; Insurance, Utilities, Govt & Rent earn 0%.",
        ],
        "category_caveats": {
            "amazon_flipkart_myntra": "2.5% (10X) on Myntra only; general e-commerce (incl. Flipkart/Amazon) earns 1.25% (5X).",
            "dining_swiggy_zomato": "10X on Swiggy/Dominos; direct offline dining earns 0.25% (1 RP/Rs.100).",
            "insurance": "0% — insurance excluded on SBI SimplyCLICK.",
        },
    },
    "sbi_bank_sbi_miles_prime_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 3.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -1.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "6 Travel Credits/Rs.200 on travel + 2 TC/Rs.200 on other retail (~1%-3% depending on Air Miles transfer partner); Insurance, Utilities, Rent & Govt/Tax earn 0% per sbicard.com.",
        ],
    },
    "sbi_bank_aurum_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 1.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -1.35,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "4 RP/Rs.100 (1% effective at Rs.0.25/RP) + up to Rs. 1.5L/mo spend milestones (Taj/Tata CLiQ/Movie vouchers); Govt & Rent earn 0%.",
        ],
    },
    "sbi_bank_tata_star_credit_cards": {
        "rates": {
            "online_shopping_general": 0.5,
            "amazon_flipkart_myntra": 0.5,
            "dining_swiggy_zomato": 0.5,
            "groceries_quick_commerce": 2.5,
            "travel_flights_hotels": 0.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.63,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {},
        "capping": [
            "3.5% at Star stores/Tata brands & 2.5% departmental/grocery retail; 1% fee if monthly utilities exceed Rs. 50,000; Insurance, Rent & Govt excluded.",
        ],
    },
    "rbl_bank_rbl_bank_blockbuster_credit_card": {
        "rates": {
            "online_shopping_general": 0.8,
            "amazon_flipkart_myntra": 1.6,
            "dining_swiggy_zomato": 0.8,
            "groceries_quick_commerce": 0.8,
            "travel_flights_hotels": 0.8,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.33,
            "offline_general_other": 0.8,
        },
        "monthly_caps_inr": {},
        "capping": [
            "2 RP/Rs.100 online & BookMyShow entertainment perks; Utilities, Insurance, Fuel, Rent & Govt/Tax excluded per rbl.bank.in.",
        ],
    },
    "yes_bank_prosperity_edge_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "8 YES Rewardz/Rs.200 (~1% travel value); Insurance (MCC 6300), Rent (MCC 6513), Education & Govt excluded per yes.bank.in.",
        ],
    },
    "yes_bank_zagg_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.5,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "Partner Zagg ecosystem rewards; Insurance, Utilities, Rent, Education & Govt excluded per yes.bank.in & Zagg terms.",
        ],
    },
    "yes_bank_yes_essence_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "Insurance, Rent, Education & Govt excluded per yes.bank.in.",
        ],
    },
    "yes_bank_yes_first_exclusive_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 3.0,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 1.5,
            "travel_flights_hotels": 3.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -0.57,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {},
        "capping": [
            "YES BANK RESERV: accelerated hotel/flight portal RP; Insurance, Rent, Education & Govt excluded per yes.bank.in.",
        ],
    },
    "yes_bank_yes_prosperity_cashback_plus_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 5.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {"utilities_bills_telecom": 250},
        "capping": [
            "5% cashback on YES PayNow standing-instruction utility bills (capped Rs. 250/mo); Insurance, Rent & Govt excluded.",
        ],
    },
    "au_small_finance_bank_au_tejas_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 10.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {"utilities_bills_telecom": 50},
        "capping": [
            "10% cashback on bills paid directly inside AU 0101 App strictly capped at Rs. 50/month; external utilities capped 100 RP/txn.",
        ],
        "category_caveats": {
            "utilities_bills_telecom": "10% applies ONLY inside AU 0101 App and is strictly capped at Rs. 50/month.",
        },
    },
    "hdfc_bank_hdfc_business_bharat_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 5.0,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 5.0,
            "fuel": 5.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {
            "utilities_bills_telecom": 150,
            "groceries_quick_commerce": 150,
            "fuel": 150,
            "travel_flights_hotels": 150,
        },
        "capping": [
            "5% cashback across bill payments, recharges, groceries, fuel & IRCTC combined strictly capped at Rs. 150/month.",
        ],
        "category_caveats": {
            "utilities_bills_telecom": "Shares tight Rs. 150/month total cashback cap with Fuel, Groceries & IRCTC.",
        },
    },
    "hdfc_bank_paytm_hdfc_bank_select_credit_card": {
        "rates": {
            "online_shopping_general": 3.0,
            "amazon_flipkart_myntra": 3.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 5.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 5.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {"utilities_bills_telecom": 1500, "travel_flights_hotels": 1500},
        "capping": [
            "5% CashPoints strictly via Paytm App on Recharge/Utilities/Travel/Movies capped at Rs. 1,500/calendar month.",
        ],
        "category_caveats": {
            "utilities_bills_telecom": "5% strictly inside Paytm App only; capped Rs. 1,500/mo.",
        },
    },
    "hdfc_bank_paytm_hdfc_bank_credit_card": {
        "rates": {
            "online_shopping_general": 2.0,
            "amazon_flipkart_myntra": 2.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 3.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 3.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {"utilities_bills_telecom": 500, "travel_flights_hotels": 500},
        "capping": [
            "3% CashPoints strictly via Paytm App on Recharge/Utilities/Travel capped at Rs. 500/calendar month.",
        ],
        "category_caveats": {
            "utilities_bills_telecom": "3% strictly inside Paytm App only; capped Rs. 500/mo.",
        },
    },
    "icici_bank_adani_one_signature_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 1.5,
            "travel_flights_hotels": 7.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -0.27,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {},
        "capping": [
            "7% Adani Reward Points on Adani One ecosystem; 0.5% on Utilities; Insurance & Income Tax excluded per adanione.com & icicibank.com.",
        ],
    },
    "icici_bank_adani_one_credit_cards": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 3.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "3% Adani Reward Points on Adani One ecosystem; 0.5% on Utilities; Insurance & Tax excluded.",
        ],
    },
    "idfc_first_bank_lic_credit_cards": {
        "rates": {
            "online_shopping_general": 0.5,
            "amazon_flipkart_myntra": 0.5,
            "dining_swiggy_zomato": 0.5,
            "groceries_quick_commerce": 0.5,
            "travel_flights_hotels": 0.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.5,
            "fuel": 0.0,
            "insurance": 5.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 0.5,
            "offline_general_other": 0.5,
        },
        "monthly_caps_inr": {"insurance": 1000},
        "capping": [
            "Accelerated Reward Points on LIC insurance premiums ONLY via official LIC portal/website (non-LIC insurance earns 0%/base).",
        ],
        "category_caveats": {
            "insurance": "Accelerated rewards apply ONLY on LIC India portal/premium payments; non-LIC insurers earn 0%/base.",
        },
    },
    "axis_bank_samsung_axis_bank_credit_card": {
        "rates": {
            "online_shopping_general": 1.0,
            "amazon_flipkart_myntra": 1.0,
            "dining_swiggy_zomato": 1.0,
            "groceries_quick_commerce": 1.0,
            "travel_flights_hotels": 1.0,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -3.13,
            "offline_general_other": 1.0,
        },
        "monthly_caps_inr": {},
        "capping": [
            "10% cashback on Samsung products/services capped at Rs. 2,500/month (Rs. 10,000/year); 1% base retail; Insurance, Utilities, Rent & Govt excluded.",
        ],
    },
    "axis_bank_samsung_axis_bank_infinite_credit_card": {
        "rates": {
            "online_shopping_general": 1.5,
            "amazon_flipkart_myntra": 1.5,
            "dining_swiggy_zomato": 1.5,
            "groceries_quick_commerce": 1.5,
            "travel_flights_hotels": 1.5,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.0,
            "fuel": 0.0,
            "insurance": 0.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": -2.63,
            "offline_general_other": 1.5,
        },
        "monthly_caps_inr": {},
        "capping": [
            "10% cashback on Samsung spends capped at Rs. 5,000/month (Rs. 20,000/year); 1.5% base retail; 3.5% standard forex markup; Insurance, Utilities, Rent & Govt excluded.",
        ],
    },
    "idfc_first_bank_idfc_lic_select_credit_card": {
        "rates": {
            "online_shopping_general": 0.75,
            "amazon_flipkart_myntra": 0.75,
            "dining_swiggy_zomato": 0.75,
            "groceries_quick_commerce": 0.75,
            "travel_flights_hotels": 0.75,
            "upi_scan_and_pay": 0.0,
            "utilities_bills_telecom": 0.75,
            "fuel": 0.0,
            "insurance": 5.0,
            "education_rent_govt": 0.0,
            "international_forex_net_of_markup": 0.75,
            "offline_general_other": 0.75,
        },
        "monthly_caps_inr": {"insurance": 2000},
        "capping": [
            "10X Reward Points strictly on LIC India insurance premiums paid via LIC portal/app; non-LIC insurers earn base/0%.",
        ],
        "category_caveats": {
            "insurance": "Accelerated rewards apply ONLY on LIC India portal/premium payments; non-LIC insurers earn 0%/base.",
        },
    },
})

# Verified Golf Privilege Table entries (sourced cleanly across official bank guides)
CURATED_GOLF_DATA: dict[str, dict[str, str]] = {
    "amex_bank_american_express_platinum_reserve_credit_cards": {
        "complimentary_access": "2 rounds/month with green fee waiver (up to 24/yr)",
        "eligible_courses": "Domestic",
        "spend_condition": "Min Rs. 50,000 monthly spend",
        "extra_notes": "Complimentary green fee waiver after monthly threshold",
    },
    "au_small_finance_bank_zenith_plus_credit_card": {
        "complimentary_access": "2 rounds or lessons / quarter (8/yr)",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "Includes 8 complimentary golf games or coaching sessions/yr",
    },
    "axis_bank_burgundy_private_credit_card": {
        "complimentary_access": "50 rounds / year",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "No-spend green fee access across premier Indian clubs",
    },
    "axis_bank_select_credit_card": {
        "complimentary_access": "6 rounds/yr (+6 bonus on >= Rs. 3L annual spend)",
        "eligible_courses": "Domestic",
        "spend_condition": "Rs. 3L annual for +6 bonus rounds",
        "extra_notes": "Baseline 6 rounds unconditional per card year",
    },
    "axis_bank_primus_credit_card": {
        "complimentary_access": "Unlimited domestic + 4 international rounds (w/ 1 guest)",
        "eligible_courses": "Domestic & International",
        "spend_condition": "None",
        "extra_notes": "Flagship global golf & stay concierge",
    },
    "hdfc_bank_hdfc_diners_club_black_credit_card": {
        "complimentary_access": "6 games / quarter (100% green fee waiver)",
        "eligible_courses": "Domestic & International",
        "spend_condition": "None",
        "extra_notes": "Global course coverage + exclusive club dining concierge",
    },
    "hdfc_bank_infinia_credit_card": {
        "complimentary_access": "Unlimited games & unlimited coaching (100% green fee waiver)",
        "eligible_courses": "Domestic & International",
        "spend_condition": "None",
        "extra_notes": "Global concierge booking + select club restaurant privileges",
    },
    "hdfc_bank_marriott_bonvoy_hdfc_credit_card": {
        "complimentary_access": "2 games + 2 lessons / quarter",
        "eligible_courses": "Domestic & International",
        "spend_condition": "None",
        "extra_notes": "Domestic & international games + domestic lessons",
    },
    "hdfc_bank_swiggy_credit_card": {
        "complimentary_access": "4 green fee rounds + 1 lesson / year",
        "eligible_courses": "Domestic",
        "spend_condition": "Mastercard World tier",
        "extra_notes": "50% off green fees beyond complimentary rounds via Mastercard",
    },
    "hdfc_bank_biz_black_credit_card": {
        "complimentary_access": "6 games / quarter worldwide",
        "eligible_courses": "Domestic & International",
        "spend_condition": "None",
        "extra_notes": "24x7 global Diners golf concierge",
    },
    "hsbc_bank_travelone_credit_card": {
        "complimentary_access": "4 rounds/yr + 1 lesson/month (12/yr)",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "50% off green fees on additional rounds",
    },
    "icici_bank_emeralde_private_metal_credit_card": {
        "complimentary_access": "Unlimited rounds & lessons via Golftripz",
        "eligible_courses": "Domestic & International",
        "spend_condition": "None",
        "extra_notes": "Book slots digitally via Golftripz account",
    },
    "icici_bank_icici_bank_emeralde_credit_card": {
        "complimentary_access": "Up to 4 rounds/lessons per month",
        "eligible_courses": "Domestic & International",
        "spend_condition": "Rs. 50,000 previous month per round",
        "extra_notes": "1 round/lesson unlocked per Rs. 50k prior-month spend",
    },
    "icici_bank_icici_bank_sapphiro_visa_credit_card": {
        "complimentary_access": "Up to 4 rounds/lessons per month",
        "eligible_courses": "Domestic & International",
        "spend_condition": "Rs. 50,000 previous month per round",
        "extra_notes": "1 round/lesson per Rs. 50,000 previous-month retail spend",
    },
    "icici_bank_icici_bank_rubyx_visa_credit_card": {
        "complimentary_access": "Up to 2 rounds/lessons per month",
        "eligible_courses": "Domestic & International",
        "spend_condition": "Rs. 50,000 previous month per round",
        "extra_notes": "1 round/lesson per Rs. 50,000 previous-month retail spend",
    },
    "idfc_first_bank_ashva_credit_card": {
        "complimentary_access": "Up to 2 rounds/lessons per month",
        "eligible_courses": "Domestic",
        "spend_condition": "Rs. 20,000 previous month per round",
        "extra_notes": "1 round/lesson granted per Rs. 20k previous-month spend",
    },
    "idfc_first_bank_mayura_credit_card": {
        "complimentary_access": "Up to 2 rounds/lessons per month (24/yr)",
        "eligible_courses": "Domestic",
        "spend_condition": "Rs. 20,000 previous month per round",
        "extra_notes": "1 round/lesson unlocked per Rs. 20,000 spent in prior cycle",
    },
    "idfc_first_bank_idfc_first_wealth_credit_card": {
        "complimentary_access": "Up to 2 rounds/lessons per month",
        "eligible_courses": "Domestic",
        "spend_condition": "Rs. 20,000 previous month per round",
        "extra_notes": "Lifetime Free card with monthly spend-linked golf privilege",
    },
    "idfc_first_bank_idfc_first_private_credit_card": {
        "complimentary_access": "Unlimited rounds & lessons",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "Invite-only wealth tier with unrestricted domestic golf",
    },
    "indusind_bank_celesta_credit_card": {
        "complimentary_access": "3 games + 3 lessons / month",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "Leading monthly golf quota under Rs. 5,000 renewal tier",
    },
    "indusind_bank_crest_credit_card": {
        "complimentary_access": "4 games + 4 lessons / month",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "Up to 4 games & 4 lessons monthly across partner courses",
    },
    "indusind_bank_pioneer_legacy_credit_card": {
        "complimentary_access": "4 games + 4 lessons / month",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "LTF banking tier privilege",
    },
    "indusind_bank_indulge_credit_card": {
        "complimentary_access": "Unlimited regular games & lessons + 4/mo premier clubs",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "High-tier metal card with unlimited coaching",
    },
    "indusind_bank_pioneer_heritage_metal_credit_card": {
        "complimentary_access": "Unlimited games & lessons",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "Invite-only banking unlimited domestic golf",
    },
    "indusind_bank_tiger_credit_card": {
        "complimentary_access": "1 complimentary game/lesson per quarter (4/yr)",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "Lifetime Free card with unconditional quarterly golf game",
    },
    "kotak_mahindra_bank_kotak_white_reserve_credit_card": {
        "complimentary_access": "2 tee-offs / month (24/yr)",
        "eligible_courses": "Domestic & International",
        "spend_condition": "None",
        "extra_notes": "Domestic and select international golf courses",
    },
    "rbl_bank_rbl_bank_icon_credit_card": {
        "complimentary_access": "4 rounds/yr + 1 lesson/month",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "50% off green fees on extra rounds + Mastercard concierge",
    },
    "rbl_bank_world_safari_credit_card": {
        "complimentary_access": "4 rounds/yr + 1 lesson/month",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "50% off additional rounds via Mastercard World golf program",
    },
    "sbi_bank_aurum_credit_card": {
        "complimentary_access": "4 rounds/quarter + 12 lessons/year",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "16 rounds + 12 coaching sessions/yr via Aureate concierge",
    },
    "standard_chartered_bank_ultimate_credit_card": {
        "complimentary_access": "1 game + 1 coaching session / month",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "12 complimentary domestic games + 12 lessons/yr",
    },
    "yes_bank_yes_first_exclusive_credit_card": {
        "complimentary_access": "4 green fee rounds/yr + 1 lesson/month",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "50% off green fees beyond complimentary sessions (Mastercard)",
    },
    "yes_bank_prosperity_edge_credit_card": {
        "complimentary_access": "4 green fee rounds/yr + 1 lesson/yr",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "Strong budget card with green fee waivers",
    },
    "yes_bank_private_credit_card": {
        "complimentary_access": "3 rounds + 1 guest + 3 lessons / quarter",
        "eligible_courses": "Domestic & International",
        "spend_condition": "None",
        "extra_notes": "Private club access + VIP international golf offers",
    },
    "yes_bank_marquee_credit_card": {
        "complimentary_access": "4 green fee waivers + 12 lessons / year",
        "eligible_courses": "Domestic",
        "spend_condition": "None",
        "extra_notes": "Plus unlimited international & 24 domestic lounge visits",
    },
}

# AI-Audited Anchor Scores (ROI, Caps, Fee Fairness, Devaluation Resilience, Community Consensus)
CURATED_RATING_ANCHORS: dict[str, float] = {
    "hdfc_bank_infinia_credit_card": 4.90,
    "icici_bank_emeralde_private_metal_credit_card": 4.86,
    "sbi_cashback_sbi_card": 4.82,
    "hsbc_bank_live_plus_credit_card": 4.76,
    "axis_bank_atlas_credit_card": 4.72,
    "axis_bank_airtel_axis_bank_credit_card": 4.30,
    "hdfc_bank_swiggy_credit_card": 4.66,
    "hdfc_bank_phonepe_ultimo_credit_card": 4.62,
    "hsbc_bank_travelone_credit_card": 4.60,
    "sbi_bank_phonepe_select_black_credit_card": 4.58,
    "icici_amazon_pay_icici_bank_credit_card": 4.56,
    "hdfc_bank_hdfc_diners_club_black_credit_card": 4.55,
    "hdfc_bank_biz_black_credit_card": 4.54,
    "axis_bank_magnus_burgundy_credit_card": 4.52,
    "hsbc_premier_credit_card": 4.50,
    "federal_bank_scapia_credit_card": 4.46,
    "amex_bank_american_express_platinum_travel_credit_cards": 4.45,
    "hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card": 4.44,
    "idfc_first_bank_idfc_first_hpcl_power_plus_credit_card": 4.42,
    "sbi_bank_sbi_bpcl_credit_card_octane": 4.40,
    "yes_bank_marquee_credit_card": 4.40,
    "au_small_finance_bank_ixigo_au_credit_card": 4.38,
    "indusind_bank_tiger_credit_card": 4.36,
    "rbl_bank_indianoil_rbl_xtra_credit_card": 4.35,
    "hdfc_bank_hdfc_regalia_gold_credit_card": 4.34,
    "yes_bank_klick_credit_card": 4.32,
    "axis_bank_axis_supermoney_rupay_credit_card": 4.30,
    "hdfc_bank_millennia_credit_card": 4.28,
    "axis_bank_ace_credit_card": 4.26,
    "idfc_first_bank_mayura_credit_card": 4.26,
    "indusind_bank_eazy_diner_indusind_bank_credit_card": 4.25,
    "axis_bank_flipkart_axis_bank_credit_card": 4.22,
    "idfc_first_bank_idfc_first_wealth_credit_card": 4.20,
    "sbi_bank_aurum_credit_card": 4.18,
    "au_small_finance_bank_zenith_plus_credit_card": 4.18,
    "hdfc_bank_diners_club_privilege_credit_card": 4.16,
    "standard_chartered_bank_ultimate_credit_card": 4.14,
    "rbl_bank_world_safari_credit_card": 4.12,
    "utkarsh_bank_utkarsh_supermoney_rupay_credit_card": 4.10,
    # Realistic fee-adjusted calibration for legacy-inflated cards
    "amex_bank_american_express_gold_credit_card": 4.05,
    "amex_bank_membership_rewards_credit_card": 4.12,
    "sbi_bank_phonepe_purple_credit_card": 4.18,
    "hdfc_bank_phonepe_uno_credit_card": 4.12,
    "yes_bank_paisabazaar_paisasave_credit_card": 4.28,
    "hdfc_bank_swiggy_ornge_hdfc_credit_card": 4.25,
    "sbi_bank_flipkart_sbi_credit_card": 4.24,
    "hsbc_bank_rupay_cashback_credit_card": 4.22,
    "axis_bank_axis_bank_cashback_credit_card": 4.20,
    "idfc_first_bank_hello_cashback_credit_card": 4.16,
    "kotak_mahindra_bank_kotak_cashback_plus_prime_credit_card": 4.15,
    "kotak_mahindra_bank_kotak_cashback_plus_credit_card": 4.05,
    "hdfc_bank_tata_neu_infinity_hdfc_fd_credit_card": 4.28,
    "csb_bank_edge_plus_csb_rupay_credit_card": 4.26,
    "indusind_bank_cred_indusind_rupay_credit_card": 4.20,
    "slice_bank_slice_rupay_credit_card": 4.18,
    "unity_small_finance_bank_roar_bank_rupay_credit_card": 4.14,
    "csb_bank_jupiter_edge_csb_rupay_credit_card": 4.10,
    "yes_bank_popclub_credit_card": 4.08,
    "axis_bank_axis_bank_my_zone_credit_cards": 3.72,
    "axis_bank_axis_bank_neo_credit_cards": 3.55,
}


_PROMO_LINE_RE = re.compile(
    r"(?:\bdiscount\b|\b%\s*off\b|\boff\s+up\s*to\b|\boff\s+on\b|\binstant\s*discount\b|\bfirst\s*(?:2|two|5|five|\d+)\s*transact|"
    r"\bcoupon\s*code\b|\bpromo\s*code\b|\bmin\.?\s*(?:order|spend|txn|transaction)\b|\bmov\b|"
    r"\btwice\s*(?:a|per)\s*month\b|\bonce\s*(?:a|per)\s*month\b|\bbuy\s*1\s*get\s*1\b|\bbogo\b|"
    r"\bmovie\s*ticket\b|\bdistrict\s*app\b|\bsave\s+up\s*to\b|\bwaiver\b|"
    r"\bwelcome\s*benefit\b|\bjoining\b|\bbirthday\b|\bduty[- ]?free\b|\bon\s+2nd\s+night\b|"
    r"\bfree\s+night\b|\bbookmyshow\b|\binox\b|\bpvr\b|\bemi\b|\binterest\s*rate\b|\bapr\b|\bsurcharge\b)",
    re.I,
)


def extract_fallback_rates_and_caps(card: dict[str, Any]) -> tuple[float, float, dict[str, int]]:
    """Infer base_pct, accel_pct, and monthly INR caps cleanly while filtering promo/discount noise."""
    rw = card.get("rewards") or {}
    bf = card.get("benefits_and_features") or {}
    base = rw.get("base_reward_rate_pct")
    accel = rw.get("accelerated_reward_rate_pct")
    pt_val = float(rw.get("point_value_inr") or 0.25)

    reward_lines = [str(x) for x in (rw.get("category_multipliers") or []) + (bf.get("highlights") or [])]
    cap_lines = reward_lines + [str(x) for x in (rw.get("milestone_benefits") or [])]

    earn_pct_vals: list[float] = []
    rp_vals: list[float] = []
    for line in reward_lines:
        low = line.lower()
        is_promo = bool(_PROMO_LINE_RE.search(low))
        # Parse explicit point-per-rupee earn math even if line has extra promo wording
        for rp_s, rs_s in re.findall(
            r"(\d+(?:\.\d+)?)\s*(?:reward\s*points?|points?|rp|coins?|neucoins?|mycash)\s*(?:per|for\s+every|on\s+every)\s*(?:rs\.?|₹)\s*(\d+)",
            line,
            re.I,
        ):
            rs_num = float(rs_s)
            if rs_num > 0:
                val = round((float(rp_s) * pt_val / rs_num) * 100.0, 2)
                if 0.1 <= val <= 15.0:
                    rp_vals.append(val)

        if is_promo:
            continue
        for m in re.findall(r"(\d+(?:\.\d+)?)\s*%", line):
            v = float(m)
            if 0.1 <= v <= 15.0:
                # Only trust >3.5% if line looks like real ongoing cashback/reward earn (not "save up to 20%")
                if v > 3.5 and not any(k in low for k in ("cashback", "reward", "point", "neucoin", "value-back", "value back")):
                    continue
                earn_pct_vals.append(v)

    if base is None:
        all_base = sorted([v for v in (earn_pct_vals + rp_vals) if 0.1 <= v <= 12.0])
        if rp_vals:
            base = min(min(rp_vals), 3.33)
        elif all_base:
            base = min(all_base[0], 2.5)
        else:
            base = 0.5

    if accel is None:
        if rp_vals and not earn_pct_vals:
            accel = min(8.0, max([float(base)] + rp_vals))
        else:
            candidates = [v for v in (earn_pct_vals + rp_vals) if v <= 10.0]
            # Bound un-curated percent-only accel so single merchant promos cannot dominate broad categories
            accel = min(6.0, max([float(base)] + candidates)) if candidates else max(float(base), 1.0)

    # Extract generic monthly / billing-cycle / quarterly caps per category keyword
    monthly_caps: dict[str, int] = {}
    general_caps: list[int] = []
    cap_re = re.compile(
        r"(?:capp?ed\s+(?:at)?|max(?:imum)?\s*(?:cashback\s*)?(?:of)?|up\s*to)\s*"
        r"(?:(rs\.?|₹)\s*)?([\d,]+)\s*(?:(reward\s*points?|points?|rp|cashpoints?|neucoins?))?\s*"
        r"(?:per|/|every|in\s+a|a)?\s*(month|billing\s*cycle|statement\s*cycle|quarter|p\.?m\.?)",
        re.I,
    )
    in_month_re = re.compile(
        r"(?:(rs\.?|₹)\s*)?([\d,]+)\s*(?:(reward\s*points?|points?|rp|cashpoints?))?\s*"
        r"(?:/|\s*(?:per|every|in\s+a|a)\s*)(month|billing\s*cycle|statement\s*cycle|quarter|p\.?m\.?)",
        re.I,
    )

    for line in cap_lines:
        low = line.lower()
        m_cap = cap_re.search(line) or (in_month_re.search(line) if any(k in low for k in ("cap", "max", "limit", "cashback", "points")) else None)
        if not m_cap:
            continue
        has_rs = bool(m_cap.group(1))
        raw_num = int(m_cap.group(2).replace(",", ""))
        if raw_num <= 0:
            continue
        unit_str = (m_cap.group(3) or "").lower()
        period_str = (m_cap.group(4) or "month").lower()
        is_pts = bool(unit_str) and not has_rs
        cap_inr = int(round(raw_num * (pt_val if is_pts else 1.0)))
        if "quarter" in period_str:
            cap_inr = max(50, int(round(cap_inr / 3.0)))
        if cap_inr < 50:
            continue

        matched_specific = False
        if any(w in low for w in ("utility", "utilities", "bill", "recharge", "telecom", "airtel")):
            monthly_caps.setdefault("utilities_bills_telecom", cap_inr)
            matched_specific = True
        if any(w in low for w in ("dining", "swiggy", "zomato", "food", "restaurant", "movie", "bookmyshow")):
            monthly_caps.setdefault("dining_swiggy_zomato", cap_inr)
            matched_specific = True
        if any(w in low for w in ("grocery", "groceries", "bigbasket", "blinkit", "zepto", "instamart", "departmental")):
            monthly_caps.setdefault("groceries_quick_commerce", cap_inr)
            matched_specific = True
        if any(w in low for w in ("amazon", "flipkart", "myntra")):
            monthly_caps.setdefault("amazon_flipkart_myntra", cap_inr)
            matched_specific = True
        if any(w in low for w in ("online", "e-com", "ecommerce")):
            monthly_caps.setdefault("online_shopping_general", cap_inr)
            matched_specific = True
        if any(w in low for w in ("fuel", "hpcl", "bpcl", "indianoil", "iocl", "petrol")):
            monthly_caps.setdefault("fuel", cap_inr)
            matched_specific = True
        if any(w in low for w in ("upi", "scan & pay", "scan and pay", "rupay")):
            monthly_caps.setdefault("upi_scan_and_pay", cap_inr)
            matched_specific = True
        if any(w in low for w in ("travel", "flight", "hotel", "ixigo", "irctc")):
            monthly_caps.setdefault("travel_flights_hotels", cap_inr)
            matched_specific = True
        if not matched_specific and ("accelerated" in low or "cashback" in low or "reward" in low or "month" in low):
            general_caps.append(cap_inr)

    # Propagate standalone monthly cap ("Cashback earnings are capped at Rs. 400 per month") when no per-cat cap matched
    if not monthly_caps and general_caps:
        g_cap = min(general_caps)
        for k in (
            "online_shopping_general",
            "amazon_flipkart_myntra",
            "dining_swiggy_zomato",
            "groceries_quick_commerce",
            "travel_flights_hotels",
            "upi_scan_and_pay",
            "utilities_bills_telecom",
        ):
            monthly_caps[k] = g_cap

    return round(float(base), 2), round(float(accel), 2), monthly_caps


def extract_golf_summary(card: dict[str, Any], pb_parsed: dict[str, Any]) -> dict[str, Any] | None:
    """Return structured golf benefit details if the card offers real complimentary golf games/lessons."""
    cid = card["card_id"]
    if cid in CURATED_GOLF_DATA:
        return {"has_golf": True, **CURATED_GOLF_DATA[cid]}

    bf = card.get("benefits_and_features") or {}
    raw_items = (
        list(bf.get("golf_benefits") or [])
        + list(bf.get("golf") or [])
        + list(pb_parsed.get("golf_benefits") or [])
    )
    for h in (bf.get("highlights") or []):
        hs = str(h)
        if re.search(r"\bgolf\b|\bgreen fee\b|\btee[- ]?off\b|\bgolf course\b", hs, re.I):
            raw_items.append(hs)

    clean_items: list[str] = []
    for it in raw_items:
        s = re.sub(r"([a-zA-Z])\d+\b", r"\1", re.sub(r"\s+", " ", str(it or ""))).strip()
        low = s.lower()
        if not s or low in ("none", "nil", "no", "na", "not applicable"):
            continue
        if any(bad in low for bad in ("no complimentary golf", "does not offer golf", "not available")):
            continue
        # Only count real golf benefit statements (games/rounds/lessons/green fee/unlimited/golf club/privileges)
        if re.search(r"\b(golf|green fee|tee)\b", low) and any(
            w in low for w in ("round", "game", "lesson", "coaching", "waiver", "complimentary", "free", "unlimited", "privileg", "access", "offer", "year", "month", "quarter")
        ):
            if s not in clean_items:
                clean_items.append(s)

    if not clean_items:
        return None

    joined = " | ".join(clean_items)
    low = joined.lower()
    courses = "Domestic & International" if any(k in low for k in ("international", "abroad", "world", "global", "overseas", "asia pacific")) else "Domestic"

    m_cond = re.search(r"((?:on\s+)?spend(?:ing)?\s+(?:at\s+least\s+)?(?:min\.?\s*)?rs\.?\s*[\d,]+[^.|;]*)", low, re.I)
    cond = m_cond.group(1).strip().capitalize() if m_cond else "None / Network rules apply"

    best_access = clean_items[0]
    for it in clean_items:
        if any(k in it.lower() for k in ("unlimited", "round", "game", "lesson", "waiver", "month", "quarter", "year")):
            best_access = it
            break

    return {
        "has_golf": True,
        "complimentary_access": best_access[:120],
        "eligible_courses": courses,
        "spend_condition": cond[:90],
        "extra_notes": (clean_items[1] if len(clean_items) > 1 else clean_items[0])[:130],
    }


def calibrate_overall_rating(
    card: dict[str, Any],
    rates: dict[str, float],
    monthly_caps: dict[str, int],
    lng: dict[str, Any],
    forex_num: float,
    golf_summary: dict[str, Any] | None,
    deval_block: dict[str, Any],
) -> float:
    """
    AI-calibrated real-world rating (2.80 - 4.92) factoring:
    - True post-cap spend yield across daily Indian spend buckets
    - Fee fairness vs tangible rewards
    - Lounge (especially no-spend / international), 0% Forex & Golf privileges
    - Community consensus & devaluation risk
    """
    cid = card["card_id"]
    if cid in CURATED_RATING_ANCHORS:
        return CURATED_RATING_ANCHORS[cid]

    ann_fee = int((card.get("fees") or {}).get("annual_fee_inr") or 0)
    is_ltf = bool(card.get("is_ltf_available") or ann_fee == 0)

    # Real typical Rs.40,000/mo diversified consumer monthly simulation (capped!)
    sample_spend = {
        "online_shopping_general": 7000,
        "amazon_flipkart_myntra": 6000,
        "dining_swiggy_zomato": 5000,
        "groceries_quick_commerce": 5000,
        "travel_flights_hotels": 6000,
        "upi_scan_and_pay": 5000,
        "utilities_bills_telecom": 3000,
        "fuel": 3000,
        "offline_general_other": 5000,
    }
    monthly_val = 0.0
    for k, amt in sample_spend.items():
        r = max(0.0, float(rates.get(k, 0.0)))
        earned = amt * (r / 100.0)
        cap = monthly_caps.get(k)
        if cap and cap > 0:
            earned = min(earned, float(cap))
        monthly_val += earned
    annual_reward_est = monthly_val * 12.0
    net_annual_value = annual_reward_est - (ann_fee * 1.18)

    # Peak practical yield across primary categories
    peak_rate = max(
        float(rates.get("online_shopping_general", 0)),
        float(rates.get("amazon_flipkart_myntra", 0)),
        float(rates.get("dining_swiggy_zomato", 0)),
        float(rates.get("groceries_quick_commerce", 0)),
        float(rates.get("travel_flights_hotels", 0)),
        float(rates.get("upi_scan_and_pay", 0)),
        float(rates.get("utilities_bills_telecom", 0)),
        float(rates.get("fuel", 0)),
    )
    base_rate = float(rates.get("offline_general_other", 0.5))

    score = 3.05
    # Yield contribution (up to +0.95)
    score += min(0.55, peak_rate * 0.055)
    score += min(0.32, base_rate * 0.11)
    if net_annual_value > 12000:
        score += 0.22
    elif net_annual_value > 6000:
        score += 0.14
    elif net_annual_value > 2500:
        score += 0.07
    elif net_annual_value < 0 and ann_fee >= 2500:
        score -= 0.16

    # Fee fairness
    if is_ltf:
        score += 0.18
    elif ann_fee <= 500:
        score += 0.10
    elif ann_fee <= 1500:
        score += 0.05
    elif ann_fee >= 10000 and peak_rate < 3.0 and not lng.get("has_international_lounge"):
        score -= 0.18

    # Lounge & Travel & Golf bonuses
    if lng.get("no_spend_domestic_lounge"):
        score += 0.20
    elif lng.get("has_domestic_lounge"):
        score += 0.08
    if lng.get("has_international_lounge"):
        score += 0.12
    if forex_num == 0.0:
        score += 0.24
    elif forex_num <= 2.0:
        score += 0.12
    if golf_summary and golf_summary.get("has_golf"):
        score += 0.12
    if card.get("is_rupay_upi_enabled") and float(rates.get("upi_scan_and_pay", 0)) >= 1.0:
        score += 0.10

    # Subtle blend with legacy community & devaluation resilience
    rat = card.get("ratings") or {}
    comm = rat.get("market_community_rating")
    if isinstance(comm, (int, float)) and comm > 0:
        score = (score * 0.85) + (float(comm) * 0.15)
    risk = int(deval_block.get("devaluation_risk_score") or 3)
    if risk >= 7:
        score -= 0.10

    return round(max(2.85, min(4.52, score)), 2)
