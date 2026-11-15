# SEO Strategy & Roadmap — Cards by cogify (`https://card.cogify.me`)

> A product of [cogify.me](https://cogify.me)

## 1. Domain & Technical Foundation
- **Canonical Domain**: `https://card.cogify.me` (subdomain dedicated to Indian Credit Card Intelligence)
- **Runtime**: Next.js 16 + `@opennextjs/cloudflare` deployed on Cloudflare Workers + Workers Static Assets (`ASSETS`) + Cloudflare R2 (`cardledger-media`) for images, logos, and JSON dossiers.
- **Indexing & Crawl Assets**:
  - `/sitemap.xml`: Statically built index covering 555+ canonical URLs (`/` + 10 hub/tool pages + 38 `/help/[bankSlug]` bank escalation desks + 506 `/[bankSlug]/[cardSlug]` card dossiers).
  - `/robots.txt`: Permits standard crawlers, social preview bots (`WhatsApp`, `Twitterbot`, `facebookexternalhit`, `LinkedInBot`, `Slackbot`), and AI search engines (`OAI-SearchBot`, `GPTBot`, `PerplexityBot`, `ClaudeBot`, `Google-Extended`), while disallowing `/api/` and `/my-cards`.
  - `/llms.txt`: Structured entity & URL directory for AI answer engines (GEO).
  - Security headers (`X-Frame-Options: DENY`, HSTS preload, strict CSP, `immutable` cache headers for R2/static assets).

## 2. Social & Link Preview Architecture (Twitter / X, Reddit, WhatsApp, LinkedIn)
- Dynamic Worker-compatible PNG OpenGraph endpoint `/og` (`ImageResponse`, zero native binaries) generating 1200x630 previews for:
  - `?type=card&bank=...&card=...` (card fee, peak return, lounge quotas, rating + bank PNG logo)
  - `?type=compare&cards=...` (up to 3-card side-by-side summary)
  - `?type=home`, `calculator`, `lounge`, `advisor`, `devaluations`, `categories`
- Static PNG/ICO fallbacks cleanly hosted at root (`/favicon.ico`, `/icon.png`, `/apple-icon.png`, `/og-default.png`).

## 3. Target Keyword Architecture
| Cluster | Primary Target Keywords | Landing Route | Schema Markup |
|---|---|---|---|
| **Core Brand & Hub** | Cards by cogify, credit cards India 2026, best credit card calculator India | `/`, `/cards` | `Organization`, `WebSite` (`SearchAction`), `CollectionPage` |
| **Card Dossiers (506)** | `<Card Name> review 2026`, `<Card Name> lounge access`, `<Card Name> fees & reward cap` | `/[bankSlug]/[cardSlug]` | `FinancialProduct` + `CreditCard`, `BreadcrumbList`, `FAQPage` |
| **Spend Playbooks** | HSBC Live+ Zepto Amazon Pay insurance trick, best RuPay UPI credit card, zero forex cards India | `/categories` | `CollectionPage`, `BreadcrumbList` |
| **Calculator & Compare** | credit card cashback calculator India, Infinia vs Emeralde Private comparison | `/calculator`, `/compare` | `WebApplication`, `BreadcrumbList` |
| **Lounges & QR Portals** | domestic airport lounge card list 2026, LoungeOne.ai QR claim guide, HoI lounge portal | `/lounges`, `/lounges/guide` | `CollectionPage`, `HowTo`, `BreadcrumbList` |
| **Customer Escalation** | `<Bank> credit card customer care PNO email`, RBI Ombudsman credit card escalation | `/help`, `/help/[bankSlug]` | `ContactPage`, `BreadcrumbList` |

## 4. Phased Growth Roadmap (90 Days)
1. **Weeks 1–2 (Launch & Search Console)**: Connect custom domain `card.cogify.me` on Cloudflare Worker, verify Search Console domain property for `cogify.me`, submit `https://card.cogify.me/sitemap.xml`, and validate Twitter Card Validator + Facebook Sharing Debugger + Reddit link previews.
2. **Weeks 3–6 (Long-Tail & Community Hacks)**: Publish monthly devaluation recaps on `/devaluations`, expand verified `optimization_tips` & spend-threshold alerts across top 50 searched cards.
3. **Weeks 7–12 (GEO & Authority)**: Cross-link flagship tools from `cogify.me`, monitor Search Console impressions on top `vs` queries & `"spend criteria lounge"` keywords, and track CWV (`LCP < 1.8s`, `CLS < 0.05`, `INP < 150ms`) via Cloudflare Web Analytics.
