# Cards by cogify (`https://card.cogify.me`)

> A product of [cogify.me](https://cogify.me) ❤️

Math-first Indian credit card intelligence across **506 active cards** and **38 issuers** — real post-cap reward calculations, 12-category spend modeling, airport & railway lounge directories, golf privileges, MITC charges, pro community optimization hacks, and RBI L1/L2/L3 PNO escalation helplines.

## Architecture

- **`web/`** — Next.js 16 + Tailwind CSS + `@opennextjs/cloudflare` configured for **Cloudflare Workers** (`card.cogify.me`) with R2 JSON & media fallback (`cardledger-media`).
- **`data/`** — Canonical card dossiers (`data/cards_by_bank/`), search/lounge/golf/devaluation indexes (`data/master/`), and dataset quality/R2 sync scripts (`data/scripts/`).
- **`bots/`** — Dataset generators and sync tooling.
- **`mobile/`** — Expo React Native iOS/Android companion app.

## Deploy to Cloudflare Workers (`card.cogify.me`)

1. Install web dependencies:
   ```bash
   cd web
   npm install
   ```
2. Set variables from [`web/.env.cloudflare.example`](web/.env.cloudflare.example) in **Cloudflare Dashboard → Workers & Pages → `cards-cogify` → Settings → Variables and Secrets**:
   - `NEXT_PUBLIC_SITE_URL=https://card.cogify.me`
   - `NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-8a560aaca6404206b9adcd66799b1cee.r2.dev`
3. Build & deploy the Worker:
   ```bash
   npm run build:cf
   npx wrangler deploy
   ```
   Custom domain routing for `card.cogify.me` and R2 binding (`cardledger-media`) are pre-configured in [`web/wrangler.jsonc`](web/wrangler.jsonc).

## SEO & Sitemaps

- Canonical sitemap: `https://card.cogify.me/sitemap.xml` (555+ URLs covering all 506 card dossiers, `/compare`, `/cards`, `/calculator`, `/advisor`, `/lounges`, `/lounges/guide`, `/categories`, `/devaluations`, `/banks`, `/help`, and all 38 bank `/help/[bankSlug]` pages)
- Dynamic Worker-compatible OpenGraph endpoint: `/og` (plus `/og-default.png`, `/icon.png`, `/apple-icon.png`, `/favicon.ico`)
- AI search readiness: [`web/public/llms.txt`](web/public/llms.txt) & [`web/SEO-STRATEGY.md`](web/SEO-STRATEGY.md)
