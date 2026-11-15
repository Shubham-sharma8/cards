# Design System Master File — CardLedger India

> Trustworthy, calm, editorial Indian credit card advisory platform (Web + React Native).
> Explicitly designed WITHOUT bold-heavy typography, WITHOUT neon/glow effects, and WITHOUT decorative/fancy fonts.

**Project:** CardLedger India (`cardledger.in`)
**Figma Design File:** https://www.figma.com/design/5dXBKVxkwdAzbBbdTftlkw
**Motion Philosophy:** Restrained `motion/react` + CSS transitions (`180ms–260ms`, `cubic-bezier(0.22, 1, 0.36, 1)`), strictly honoring `prefers-reduced-motion`.

---

## 1. Visual Rules (User-Mandated Constraints)

1. **No Bold-Heavy Typography:**
   - Primary body weight: `400` (Regular)
   - Headings / titles / card names / buttons / key metrics: `500` (Medium) only — never `700`/`800`/`900` heavy bold.
   - Hierarchy is achieved through **type scale, line-height, whitespace, subtle hairline borders, and ink contrast**, not heavy stroke thickness.
2. **No Neon or Glow Effects:**
   - Zero electric cyan, purple gradients, glowing dark-mode borders, or neon drop shadows.
   - Grounded light paper canvas (`#FAF9F6`), pure card surface (`#FFFFFF`), calm muted neutral border (`#E4E4DF`), deep charcoal ink (`#1A1D21`), understated pine-teal primary (`#0F5C4D`), and disciplined warm amber (`#B45309`) / crimson (`#B91C1C`) semantic alerts.
3. **No Fancy Fonts:**
   - Single plain, crisp humanist sans-serif: **IBM Plex Sans** (with clean system sans fallback `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`) and `font-variant-numeric: tabular-nums` on all INR currency (`₹1,24,500`), reward percentages (`3.33%`), CIBIL scores, and fee tables.

---

## 2. Color Palette (Web CSS Tokens & React Native Tokens)

| Role | Light Hex | Purpose |
|------|-----------|---------|
| `--bg-canvas` | `#FAF9F6` | Warm paper page canvas (reduces harsh pure-white glare) |
| `--bg-surface` | `#FFFFFF` | Card, calculator drawer, modal, and table surfaces |
| `--bg-subtle` | `#F3F2EE` | Input fills, pill backgrounds, zebra table headers |
| `--bg-tint-primary` | `#EEF5F2` | Soft pine tint for LTF badges, active filter pills, best match |
| `--bg-tint-warn` | `#FEF6EA` | Soft warm sand tint for spend caps, devaluation advisories |
| `--bg-tint-danger` | `#FDF2F2` | Soft muted rose tint for high devaluation risk / cons |
| `--ink-primary` | `#1A1D21` | Primary text (15.4:1 contrast on `#FFFFFF`) |
| `--ink-secondary` | `#4B525C` | Descriptions, metadata, table values (7.8:1 contrast) |
| `--ink-muted` | `#717882` | Captions, axis labels, placeholder hints (4.52:1 on `#FFFFFF`) |
| `--border-hairline` | `#E4E4DF` | Crisp `1px` card/section dividers |
| `--border-strong` | `#C9C9C2` | Input hover, focused control outline |
| `--accent-primary` | `#0F5C4D` | Deep Pine Teal — primary buttons, active tabs, positive yield |
| `--accent-primary-hover` | `#0B473B` | Hover/pressed state |
| `--accent-slate` | `#2C3E50` | Secondary neutral button / outline |
| `--semantic-positive` | `#166534` | Net annual profit, LTF, fee waived |
| `--semantic-warn` | `#9A5B13` | Medium devaluation risk, spend-linked lounge |
| `--semantic-danger` | `#991B1B` | High devaluation risk, net annual loss after fee |

---

## 3. Typography Scale (Weights Strictly 400 & 500)

| Token | Web Size / Line-Height | RN Size / Line-Height | Weight | Letter-Spacing |
|-------|------------------------|-----------------------|--------|----------------|
| `display` | `32px / 40px` (`2rem`) | `26px / 32px` | `500` | `-0.02em` |
| `h1` | `26px / 34px` (`1.625rem`) | `22px / 28px` | `500` | `-0.015em` |
| `h2` | `20px / 28px` (`1.25rem`) | `18px / 24px` | `500` | `-0.01em` |
| `h3` | `16px / 24px` (`1rem`) | `16px / 22px` | `500` | `-0.005em` |
| `body` | `15px / 24px` | `15px / 22px` | `400` | `0em` |
| `body-sm` | `13.5px / 20px` | `13.5px / 19px` | `400` | `0em` |
| `caption` | `12px / 16px` | `12px / 16px` | `400` / `500` | `0.01em` |

---

## 4. Aceternity UI Reference Patterns (Adapted Clean & Calm)

| Aceternity Component | Calm Light Adaptation in CardLedger India |
|---|---|
| **Floating / Resizable Navbar** | Sticky centered single-row header (`max-w-7xl`) with crisp `1px` bottom hairline, gentle backdrop blur (`bg-[#FAF9F6]/90 backdrop-blur-md`), shrinking cleanly on scroll, custom geometric SVG mark + wordmark, 5 plain links, keyboard `Cmd+K` search pill |
| **Bento Grid** | Clean 4-tile & 6-tile editorial discovery grid (No-Fee Lifetime Free, No-Spend Airport Lounges, Zero Forex Markup, RuPay UPI Scan & Pay, Cashback Champions, Travel Miles) with hairline borders and soft `translateY(-2px)` hover |
| **Animated Tabs** (`layoutId`) | Smooth pill indicator (`motion/react` `layoutId`) switching Card Dossier sections (`Overview & Pros/Cons`, `Reward Calculator`, `Lounges & Links`, `Fees & Slabs`, `Reddit & Devaluation`) & Finder views without page jump |
| **Card Hover Effect / Focus Cards** | Subtle hairline border tint (`#0F5C4D/40`) and soft `#F8F8F5` surface wash on hover instead of heavy shadows or neon glows |
| **Expandable Card / Accordion** | Smooth height/opacity reveal for Reddit feedback threads, FAQs, and late-payment fee slabs |
| **Side-by-Side Compare Tray** | Floating bottom sticky tray comparing up to 3 selected cards side-by-side (`compare?cards=...`) |

---

## 5. Brand Identity: Logo, Header & Footer

- **Brand Name:** **CardLedger** (Wordmark: `CardLedger` + subtle `India` tag) — signals neutral, numbers-first honesty.
- **Logo Mark (SVG):** Two crisp staggered card silhouettes (`1px` rounded overlap with subtle notch + rupee/ledger datum line) in `#0F5C4D` and `#1A1D21`.
- **Header:** Brand mark -> Nav Links (`Cards`, `Calculator`, `Lounges`, `Banks`, `Devaluations`) -> Quick Search button (`⌘K`) -> Compare count pill. Clean mobile hamburger drawer on `<768px`.
- **Footer:** 4-column editorial footer (`Popular Guides`, `Card Categories`, `Top Issuers`, `Methodology & Disclaimers`) + clear independence note ("Unbiased fee math, issuer MITC links, and r/CreditCardsIndia community notes. Verify final T&Cs on your bank's MITC before applying.").
