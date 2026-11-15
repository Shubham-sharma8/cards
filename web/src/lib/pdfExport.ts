import type { CardDossier } from "./types";
import type { CategoryStudyTable } from "./categoryStudies";
import { getBankHelpBySlug } from "./bankHelpDirectory";
import {
  SPEND_CATEGORY_KEYS,
  SPEND_CATEGORY_META,
  cardLocalImageUrl,
  formatInr,
  formatLoungeQuota,
} from "./format";
import { escapeHtml, sanitizeHexColor, sanitizeImageSrc } from "./security";

function resolveImgAbs(localImagePath: string | null | undefined): string | null {
  const rel = sanitizeImageSrc(cardLocalImageUrl(localImagePath));
  if (!rel) return null;
  if (typeof window !== "undefined" && rel.startsWith("/")) {
    return `${window.location.origin}${rel}`;
  }
  return rel;
}

const CHART_PALETTE = [
  "#0F5C4D",
  "#1D4ED8",
  "#B45309",
  "#7C3AED",
  "#0369A1",
  "#15803D",
  "#374151",
  "#C2410C",
  "#0E7490",
  "#4338CA",
  "#0F766E",
  "#6B7280",
];

function buildSvgBarChart(
  items: Array<{ label: string; value: number; display: string; color?: string }>,
  opts: { title: string; subtitle?: string; width?: number; height?: number }
): string {
  if (!items.length) return "";
  const width = opts.width ?? 680;
  const height = opts.height ?? 176;
  const padL = 24;
  const padR = 16;
  const padT = 24;
  const padB = 42;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const maxVal = Math.max(1, ...items.map((i) => i.value)) * 1.15;
  const step = plotW / items.length;
  const barW = Math.min(38, Math.max(14, Math.floor(step * 0.56)));

  const gridLines = [0.25, 0.5, 0.75]
    .map((pct) => {
      const y = (padT + plotH - pct * plotH).toFixed(1);
      return `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="#E5E7EB" stroke-dasharray="3 3" />`;
    })
    .join("");

  const bars = items
    .map((item, idx) => {
      const ratio = Math.max(0.05, Math.min(1, item.value / maxVal));
      const bh = Math.round(ratio * plotH);
      const cx = padL + idx * step + step / 2;
      const bx = cx - barW / 2;
      const by = padT + plotH - bh;
      const fill = sanitizeHexColor(item.color, CHART_PALETTE[idx % CHART_PALETTE.length]);
      const shortLbl = item.label.length > 13 ? item.label.slice(0, 12) + "…" : item.label;

      return `
        <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW}" height="${bh}" rx="4" fill="${fill}" />
        <text x="${cx.toFixed(1)}" y="${Math.max(12, by - 5).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="600" fill="#1A1D21">${escapeHtml(item.display)}</text>
        <text x="${cx.toFixed(1)}" y="${(padT + plotH + 14).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="#4B525C">${escapeHtml(shortLbl)}</text>
      `;
    })
    .join("");

  return `
    <div class="chart-card">
      <div class="chart-title">${escapeHtml(opts.title)}</div>
      ${opts.subtitle ? `<div class="chart-sub">${escapeHtml(opts.subtitle)}</div>` : ""}
      <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" xmlns="http://www.w3.org/2000/svg">
        ${gridLines}
        <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#CBD2D9" />
        ${bars}
      </svg>
    </div>
  `;
}

const BASE_PDF_CSS = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body {
    margin: 0; padding: 0;
    background: #FBFBF8; color: #1A1D21;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-weight: 400; font-size: 11px; line-height: 1.44;
  }
  .sheet { max-width: 100%; margin: 0 auto; }
  .hdr {
    display: flex; align-items: flex-end; justify-content: space-between;
    border-bottom: 2px solid #0F5C4D; padding-bottom: 10px; margin-bottom: 12px;
  }
  .brand { font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; color: #0F5C4D; font-weight: 600; }
  h1 { margin: 2px 0 0; font-size: 18px; font-weight: 600; color: #1A1D21; letter-spacing: -0.015em; }
  .sub { margin: 3px 0 0; font-size: 11px; color: #4B525C; }
  .meta-right { text-align: right; font-size: 9.5px; color: #717882; }
  .card-art-frame {
    background: #F8F6F0; border: 1px solid #E4E4DF; border-radius: 8px;
    padding: 5px; display: inline-flex; align-items: center; justify-content: center;
  }
  .card-art-frame img { display: block; width: 100%; height: 100%; object-fit: contain; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; background: #FFFFFF; border: 1px solid #E4E4DF; border-radius: 10px; overflow: hidden; margin-top: 10px; }
  th, td { padding: 7px 9px; border-bottom: 1px solid #EFEFE9; border-left: 1px solid #EFEFE9; vertical-align: top; text-align: left; font-size: 10.5px; }
  th:first-child, td:first-child { border-left: none; }
  tr:last-child td { border-bottom: none; }
  th { background: #FAF9F6; color: #4B525C; font-weight: 600; }
  .attr-col { width: 162px; background: #FAF9F6; color: #4B525C; font-weight: 600; }
  .win-cell { background: #EEF5F2; color: #0F5C4D; font-weight: 600; }
  .section-bar td { background: #F3F2EE; color: #1A1D21; font-weight: 600; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 5px; font-size: 9.5px; font-weight: 600; }
  .badge-green { background: #EEF5F2; color: #0F5C4D; border: 1px solid #C5DFD6; }
  .badge-amber { background: #FEF6EA; color: #9A5B13; border: 1px solid #EED8B5; }
  .badge-red { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; break-inside: avoid; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin-top: 10px; break-inside: avoid; }
  .grid-kpi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; break-inside: avoid; }
  .panel { background: #FFFFFF; border: 1px solid #E4E4DF; border-radius: 9px; padding: 9px 11px; break-inside: avoid; margin-top: 10px; }
  .panel-title { font-size: 11px; font-weight: 600; color: #0F5C4D; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.03em; }
  .chart-card { background: #FFFFFF; border: 1px solid #E4E4DF; border-radius: 9px; padding: 10px 12px; margin-top: 10px; break-inside: avoid; }
  .chart-title { font-size: 11.5px; font-weight: 600; color: #1A1D21; }
  .chart-sub { font-size: 9.5px; color: #717882; margin-bottom: 6px; }
  .pros-box { background: #EEF5F2; border: 1px solid #C5DFD6; border-radius: 8px; padding: 9px 11px; break-inside: avoid; }
  .cons-box { background: #FEF6EA; border: 1px solid #EED8B5; border-radius: 8px; padding: 9px 11px; break-inside: avoid; }
  .warn-box { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 9px 11px; break-inside: avoid; }
  .pc-title-pro { color: #0F5C4D; font-weight: 600; font-size: 11px; margin: 0 0 5px; }
  .pc-title-con { color: #9A5B13; font-weight: 600; font-size: 11px; margin: 0 0 5px; }
  ul.pc-list { margin: 0; padding-left: 14px; }
  ul.pc-list li { margin-bottom: 3.5px; color: #1A1D21; font-size: 10px; line-height: 1.38; }
  .kpi { background: #FFFFFF; border: 1px solid #E4E4DF; border-radius: 8px; padding: 7px 10px; }
  .kpi-lbl { font-size: 9px; color: #717882; display: block; text-transform: uppercase; letter-spacing: 0.03em; }
  .kpi-val { font-size: 12px; font-weight: 600; color: #1A1D21; margin-top: 2px; display: block; }
  .kpi-sub { font-size: 9px; color: #4B525C; margin-top: 2px; display: block; }
  .ftr { margin-top: 12px; padding-top: 8px; border-top: 1px solid #E4E4DF; font-size: 9px; color: #717882; display: flex; justify-content: space-between; }
`;

function printHtmlDocument(title: string, bodyHtml: string, landscape = false): void {
  if (typeof document === "undefined") return;
  const fullHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  ${BASE_PDF_CSS}
  @page { size: ${landscape ? "A4 landscape" : "A4 portrait"}; margin: 10mm; }
</style>
</head>
<body>
  <div class="sheet">${bodyHtml}</div>
</body>
</html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      iframe.remove();
    }, 1500);
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) {
      cleanup();
      return;
    }
    const imgs = Array.from(doc.querySelectorAll("img"));
    const waits = imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        })
    );
    Promise.race([
      Promise.all(waits),
      new Promise<void>((resolve) => setTimeout(resolve, 2500)),
    ]).then(() => {
      win.focus();
      win.print();
      cleanup();
    });
  };

  iframe.srcdoc = fullHtml;
}

export function exportComparisonPdf(cards: CardDossier[]): void {
  if (!cards.length) return;
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const bestRating = Math.max(...cards.map((c) => c.ratings.overall_market_rating));
  const lowestFee = Math.min(...cards.map((c) => c.fees_and_charges_detailed.annual_fee_inr));
  const lowestForex = Math.min(...cards.map((c) => c.fees_and_charges_detailed.forex_markup_pct));

  const chartRating = buildSvgBarChart(
    cards.map((c) => ({
      label: c.identity.card_name.replace(/Credit Card/gi, "").trim(),
      value: c.ratings.overall_market_rating,
      display: `${c.ratings.overall_market_rating.toFixed(2)}★`,
    })),
    { title: "Overall Rating Comparison", subtitle: "Composite Score out of 5.0", width: 340, height: 150 }
  );

  const chartPeak = buildSvgBarChart(
    cards.map((c) => {
      const vals = Object.values(c.reward_calculator_model?.effective_return_pct_by_category || {}).filter(
        (v) => typeof v === "number"
      );
      const peak = vals.length ? Math.max(...vals) : c.reward_calculator_model.accelerated_reward_rate_pct;
      return {
        label: c.identity.card_name.replace(/Credit Card/gi, "").trim(),
        value: Math.max(0.2, peak),
        display: `${peak.toFixed(1)}%`,
      };
    }),
    { title: "Peak Category Earn Rate (%)", subtitle: "Highest post-cap category return rate", width: 340, height: 150 }
  );

  const headerCells = cards
    .map((c) => {
      const imgUrl = resolveImgAbs(c.visual_assets.local_image_path);
      return `
        <th style="min-width:170px;">
          ${imgUrl ? `<div class="card-art-frame" style="width:118px;height:74px;margin-bottom:6px;"><img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(c.identity.card_name)}" /></div>` : ""}
          <div style="font-size:9.5px;color:#717882;">${escapeHtml(c.identity.bank)} · ${escapeHtml(c.identity.card_network)}</div>
          <div style="font-size:12px;color:#1A1D21;font-weight:600;margin-top:2px;">${escapeHtml(c.identity.card_name)}</div>
          <div style="font-size:9.5px;color:#0F5C4D;margin-top:2px;">${escapeHtml(c.pros_and_cons.verdict || c.identity.primary_category)}</div>
        </th>`;
    })
    .join("");

  const renderCells = (fn: (c: CardDossier) => { text: string; win?: boolean }) =>
    cards
      .map((c) => {
        const res = fn(c);
        return `<td class="${res.win ? "win-cell" : ""}">${res.text}</td>`;
      })
      .join("");

  const categoryRows = SPEND_CATEGORY_KEYS.map((key) => {
    const vals = cards.map((c) => c.reward_calculator_model.effective_return_pct_by_category[key] ?? 0);
    const maxVal = Math.max(...vals);
    return `
      <tr>
        <td class="attr-col">${escapeHtml(SPEND_CATEGORY_META[key].shortLabel)}</td>
        ${cards
          .map((c) => {
            const v = c.reward_calculator_model.effective_return_pct_by_category[key] ?? 0;
            const win = v > 0 && Math.abs(v - maxVal) < 0.001;
            return `<td class="${win ? "win-cell" : ""}">${v.toFixed(2)}%</td>`;
          })
          .join("")}
      </tr>`;
  }).join("");

  const prosConsColumns = cards
    .map((c) => {
      const help = getBankHelpBySlug(c.identity.bank_slug);
      return `
      <div class="panel">
        <div class="panel-title">${escapeHtml(c.identity.card_name)} — Key Takeaways &amp; Helplines</div>
        <div style="font-size:10px;color:#0F5C4D;font-weight:600;margin-bottom:3px;">✓ Key Strengths</div>
        <ul class="pc-list">${(c.pros_and_cons.pros || []).slice(0, 4).map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
        <div style="font-size:10px;color:#9A5B13;font-weight:600;margin:6px 0 3px;">⚠ Watch-Outs &amp; Exclusions</div>
        <ul class="pc-list">${(c.pros_and_cons.cons || []).slice(0, 3).map((con) => `<li>${escapeHtml(con)}</li>`).join("")}</ul>
        ${
          (c.reward_calculator_model.excluded_categories || []).length
            ? `<div style="margin-top:5px;font-size:9.5px;color:#717882;"><strong>Excluded:</strong> ${escapeHtml(c.reward_calculator_model.excluded_categories.slice(0, 5).join(", "))}</div>`
            : ""
        }
        ${
          help
            ? `<div style="margin-top:6px;padding-top:5px;border-top:1px solid #EFEFE9;font-size:9px;color:#4B525C;"><strong>Helpline:</strong> ${escapeHtml(help.helplineTollFree)} · <strong>PNO:</strong> ${escapeHtml(help.l3PnoEmail)}</div>`
            : ""
        }
      </div>`;
    })
    .join("");

  const bodyHtml = `
    <div class="hdr">
      <div>
        <div class="brand">Cards by cogify · Comprehensive Comparison Dossier</div>
        <h1>Side-by-Side Credit Card Research Report</h1>
        <p class="sub">${escapeHtml(cards.map((c) => c.identity.card_name).join(" vs. "))}</p>
      </div>
      <div class="meta-right">Generated ${escapeHtml(dateStr)}<br />Post-Cap Net Rewards · MITC Fees · L1/L2/PNO</div>
    </div>

    <div class="grid-2">${chartRating}${chartPeak}</div>

    <table>
      <thead><tr><th class="attr-col">Comparison Dimension</th>${headerCells}</tr></thead>
      <tbody>
        <tr class="section-bar"><td colspan="${cards.length + 1}">Fees, Valuation &amp; Market Ratings</td></tr>
        <tr><td class="attr-col">Joining / Annual Fee</td>${renderCells((c) => {
          const j = c.fees_and_charges_detailed.joining_fee_inr;
          const a = c.fees_and_charges_detailed.annual_fee_inr;
          const gstNote = c.fees_and_charges_detailed.gst_applicable && a > 0 ? " (+18% GST)" : "";
          return {
            text: `${j === 0 ? "₹0" : escapeHtml(formatInr(j))} / ${a === 0 ? "LTF (₹0)" : escapeHtml(formatInr(a))}${escapeHtml(gstNote)}`,
            win: a === lowestFee,
          };
        })}</tr>
        <tr><td class="attr-col">Annual Fee Waiver</td>${renderCells((c) => ({
          text: c.fees_and_charges_detailed.fee_waiver_spend_inr
            ? `${escapeHtml(formatInr(c.fees_and_charges_detailed.fee_waiver_spend_inr))}/yr`
            : c.fees_and_charges_detailed.annual_fee_inr === 0
              ? "Lifetime Free"
              : "No waiver",
        }))}</tr>
        <tr><td class="attr-col">Forex Markup</td>${renderCells((c) => ({
          text: `${c.fees_and_charges_detailed.forex_markup_pct}%`,
          win: c.fees_and_charges_detailed.forex_markup_pct === lowestForex,
        }))}</tr>
        <tr><td class="attr-col">Reward Engine &amp; Expiry</td>${renderCells((c) => ({
          text: `${escapeHtml(c.reward_calculator_model.earn_unit)} (₹${c.reward_calculator_model.point_value_inr_default}/pt) · ${escapeHtml(c.reward_calculator_model.point_expiry)}`,
        }))}</tr>
        <tr><td class="attr-col">Market Rating</td>${renderCells((c) => ({
          text: `★ ${c.ratings.overall_market_rating.toFixed(2)}/5`,
          win: c.ratings.overall_market_rating === bestRating,
        }))}</tr>

        <tr class="section-bar"><td colspan="${cards.length + 1}">Airport Lounge, Golf &amp; Milestones</td></tr>
        <tr><td class="attr-col">Domestic Airport Lounge</td>${renderCells((c) => ({
          text: `${escapeHtml(formatLoungeQuota(c.lounge_access_detailed.domestic.visits_per_year, c.lounge_access_detailed.domestic.visits_per_quarter) || "None")} (${escapeHtml(c.lounge_access_detailed.domestic.spend_criteria || (c.lounge_access_detailed.no_spend_domestic_lounge ? "No-Spend Free" : "Check Terms"))})`,
          win: c.lounge_access_detailed.no_spend_domestic_lounge,
        }))}</tr>
        <tr><td class="attr-col">International &amp; Rail Lounge</td>${renderCells((c) => ({
          text: `Intl: ${escapeHtml(String(c.lounge_access_detailed.international.visits_per_year || "None"))} (${escapeHtml(c.lounge_access_detailed.international.program || "—")}) · Rail: ${escapeHtml(String(c.lounge_access_detailed.railway.visits_per_year || "None"))}`,
        }))}</tr>
        <tr><td class="attr-col">Golf Rounds &amp; Coaching</td>${renderCells((c) => ({
          text: c.benefits_features_and_faqs.golf_summary?.has_golf
            ? `${escapeHtml(c.benefits_features_and_faqs.golf_summary.complimentary_access)} (${escapeHtml(c.benefits_features_and_faqs.golf_summary.eligible_courses)})`
            : "No complimentary golf",
        }))}</tr>
        <tr><td class="attr-col">Transfer Partners</td>${renderCells((c) => ({
          text: (c.reward_calculator_model.transfer_partners || []).length
            ? escapeHtml(
                c.reward_calculator_model.transfer_partners
                  .slice(0, 4)
                  .map((p) => (typeof p === "string" ? p : `${p.partner} (${p.ratio})`))
                  .join(" · ")
              )
            : "Statement credit / vouchers",
        }))}</tr>
        <tr><td class="attr-col">Eligibility (Income &amp; CIBIL)</td>${renderCells((c) => ({
          text: `${c.eligibility_detailed.min_monthly_income_salaried_inr ? `${escapeHtml(formatInr(c.eligibility_detailed.min_monthly_income_salaried_inr))}/mo` : "Check income"} · CIBIL ${c.eligibility_detailed.min_cibil_score}+`,
        }))}</tr>
        <tr><td class="attr-col">Devaluation Risk Score</td>${renderCells((c) => ({
          text: `${c.devaluation_analysis.devaluation_risk_score}/10 (${escapeHtml(c.devaluation_analysis.devaluation_frequency)})`,
        }))}</tr>

        <tr class="section-bar"><td colspan="${cards.length + 1}">Net Category Return Rates (12 Spend Categories)</td></tr>
        ${categoryRows}
      </tbody>
    </table>

    <div class="${cards.length === 3 ? "grid-3" : "grid-2"}">${prosConsColumns}</div>

    <div class="ftr">
      <span>Cards by cogify · Objective Comparison Dossier (${cards.length} cards)</span>
      <span>card.cogify.me · Always verify latest MITC before applying</span>
    </div>`;

  printHtmlDocument(`Compare: ${cards.map((c) => c.identity.card_name).join(" vs ")}`, bodyHtml, cards.length >= 3);
}

export function exportSingleCardPdf(d: CardDossier): void {
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const imgUrl = resolveImgAbs(d.visual_assets.local_image_path);
  const fees = d.fees_and_charges_detailed;
  const calc = d.reward_calculator_model;
  const lng = d.lounge_access_detailed;
  const elig = d.eligibility_detailed;
  const deval = d.devaluation_analysis;
  const ben = d.benefits_features_and_faqs;
  const help = getBankHelpBySlug(d.identity.bank_slug);
  const accent = sanitizeHexColor(d.visual_assets.card_theme?.primary_hex, "#0F5C4D");

  const domQuota =
    formatLoungeQuota(lng.domestic.visits_per_year, lng.domestic.visits_per_quarter) ||
    (lng.has_domestic_lounge ? "Included" : "None");

  const catChartSvg = buildSvgBarChart(
    SPEND_CATEGORY_KEYS.map((k) => {
      const pct = calc.effective_return_pct_by_category[k] ?? 0;
      return {
        label: SPEND_CATEGORY_META[k].shortLabel,
        value: Math.max(0.15, pct),
        display: `${pct.toFixed(1)}%`,
        color: pct >= 5 ? "#0F5C4D" : pct >= 2 ? "#1D4ED8" : "#64748B",
      };
    }),
    {
      title: "12-Category Effective Post-Cap Return Chart (%)",
      subtitle: `Unit: ${calc.earn_unit} · Base Value ₹${calc.point_value_inr_default}/pt · Point Expiry: ${calc.point_expiry}`,
      width: 680,
      height: 175,
    }
  );

  const welcomeList = Array.isArray(ben.welcome_benefit)
    ? ben.welcome_benefit
    : ben.welcome_benefit
      ? [ben.welcome_benefit]
      : [];

  const pvEntries = Object.entries(calc.point_value_inr_matrix || {});
  const transferPartners = (calc.transfer_partners || []).map((p) =>
    typeof p === "string" ? p : `${p.partner} (${p.ratio})`
  );

  const bodyHtml = `
    <div class="hdr">
      <div style="display:flex;align-items:center;gap:14px;">
        ${imgUrl ? `<div class="card-art-frame" style="width:128px;height:80px;"><img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(d.identity.card_name)}" /></div>` : ""}
        <div>
          <div class="brand" style="color:${accent};">${escapeHtml(d.identity.bank)} · ${escapeHtml(d.identity.card_network)} · ${escapeHtml(d.identity.card_tier)}</div>
          <h1>${escapeHtml(d.identity.card_name)}</h1>
          <p class="sub">${escapeHtml(d.pros_and_cons.editorial_summary || d.pros_and_cons.verdict)}</p>
        </div>
      </div>
      <div class="meta-right">
        <span class="badge badge-green">Market Rating ★ ${d.ratings.overall_market_rating.toFixed(2)}/5</span><br/>
        <span style="display:inline-block;margin-top:4px;">${escapeHtml(d.identity.primary_category)} · ${escapeHtml(dateStr)}</span>
      </div>
    </div>

    <div class="grid-kpi">
      <div class="kpi">
        <span class="kpi-lbl">Joining / Annual Fee</span>
        <span class="kpi-val">${fees.joining_fee_inr === 0 ? "₹0" : escapeHtml(formatInr(fees.joining_fee_inr))} / ${fees.annual_fee_inr === 0 ? "LTF (₹0)" : escapeHtml(formatInr(fees.annual_fee_inr))}</span>
        <span class="kpi-sub">${fees.gst_applicable && fees.annual_fee_inr > 0 ? "+18% GST applies" : "No GST"} · ${fees.fee_waiver_spend_inr ? `Waiver @ ${escapeHtml(formatInr(fees.fee_waiver_spend_inr))}/yr` : "Check waiver terms"}</span>
      </div>
      <div class="kpi">
        <span class="kpi-lbl">Airport Lounge &amp; Golf</span>
        <span class="kpi-val">Dom: ${escapeHtml(domQuota)}</span>
        <span class="kpi-sub">Intl: ${escapeHtml(String(lng.international.visits_per_year || "None"))} · ${ben.golf_summary?.has_golf ? `Golf: ${escapeHtml(ben.golf_summary.complimentary_access)}` : "No free golf"}</span>
      </div>
      <div class="kpi">
        <span class="kpi-lbl">Forex &amp; Devaluation Risk</span>
        <span class="kpi-val">${fees.forex_markup_pct}% Forex Markup</span>
        <span class="kpi-sub">Deval Risk: ${deval.devaluation_risk_score}/10 (${escapeHtml(deval.devaluation_frequency)})</span>
      </div>
    </div>

    ${catChartSvg}

    <div class="grid-2">
      <div class="panel">
        <div class="panel-title">Reward Engine, Conversion &amp; Caps</div>
        <div style="font-size:10px;color:#1A1D21;margin-bottom:5px;">
          <strong>Base Rate:</strong> ${calc.base_reward_rate_pct}% · <strong>Peak Rate:</strong> ${calc.accelerated_reward_rate_pct}% · <strong>Default Pt Value:</strong> ₹${calc.point_value_inr_default}
        </div>
        ${
          pvEntries.length
            ? `<div style="font-size:9.5px;color:#4B525C;margin-bottom:5px;"><strong>Redemption Value Matrix:</strong> ${escapeHtml(pvEntries.map(([k, v]) => `${k}: ${v}`).join(" · "))}</div>`
            : ""
        }
        ${
          (calc.monthly_capping_rules || []).length
            ? `<div style="font-size:9.5px;font-weight:600;color:#1A1D21;margin-top:4px;">Monthly Caps &amp; Rules:</div><ul class="pc-list">${calc.monthly_capping_rules.slice(0, 5).map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
            : ""
        }
        ${
          (calc.excluded_categories || []).length
            ? `<div style="font-size:9.5px;color:#9A5B13;margin-top:5px;"><strong>Excluded (0 Rewards):</strong> ${escapeHtml(calc.excluded_categories.join(", "))}</div>`
            : ""
        }
      </div>

      <div class="panel">
        <div class="panel-title">Welcome, Milestones &amp; Transfer Partners</div>
        ${
          welcomeList.length
            ? `<div style="font-size:9.5px;margin-bottom:5px;"><strong>Welcome Benefit:</strong> ${escapeHtml(welcomeList.join(" · "))}</div>`
            : ""
        }
        ${
          (ben.milestone_benefits || []).length
            ? `<div style="font-size:9.5px;font-weight:600;margin-top:4px;">Milestones:</div><ul class="pc-list">${ben.milestone_benefits.slice(0, 4).map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>`
            : ""
        }
        <div style="font-size:9.5px;color:#4B525C;margin-top:5px;">
          <strong>Transfer Partners:</strong> ${transferPartners.length ? escapeHtml(transferPartners.join(", ")) : "Direct statement cashback / curated catalogue"}
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-title">Lounge &amp; Golf Claim Walkthrough</div>
        <div style="font-size:10px;line-height:1.45;">
          <strong>Domestic Spend Criteria:</strong> ${escapeHtml(lng.domestic.spend_criteria || (lng.no_spend_domestic_lounge ? "No prior spend condition" : "Check quarterly spend"))}<br/>
          <strong>Intl Program:</strong> ${escapeHtml(lng.international.program || "None")} (${escapeHtml(lng.international.summary || "—")})<br/>
          <strong>Railway Lounge:</strong> ${escapeHtml(lng.railway.summary || "None")}<br/>
          <strong>Online Cardless QR Portals:</strong> Claim at <span style="color:#0F5C4D;font-weight:600;">loungeone.ai</span> (Adani), <span style="color:#0F5C4D;font-weight:600;">loungeaccess.travelfoodservices.com</span> (TFS), or <span style="color:#0F5C4D;font-weight:600;">lms.hoi.in</span> (DEL/HYD/GOX) before queuing.<br/>
          <strong>Golf Booking:</strong> ${ben.golf_summary?.has_golf ? `${escapeHtml(ben.golf_summary.complimentary_access)} · Book via RuPay Select Truztee / Mastercard 1800-102-6263 / Visa TeePass 4–7 days prior.` : "Not applicable on this variant."}
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">Eligibility, APR &amp; MITC Charges</div>
        <div style="font-size:10px;line-height:1.45;">
          <strong>Income Required:</strong> ${elig.min_monthly_income_salaried_inr ? `${escapeHtml(formatInr(elig.min_monthly_income_salaried_inr))}/mo salaried` : "Variable"} ${elig.min_annual_itr_self_employed_inr ? `· ${escapeHtml(formatInr(elig.min_annual_itr_self_employed_inr))} ITR` : ""}<br/>
          <strong>CIBIL &amp; Age:</strong> ${elig.min_cibil_score}+ CIBIL · Age ${escapeHtml(elig.age_range)}<br/>
          <strong>Interest APR:</strong> ${fees.apr_monthly_pct}% / mo (${fees.apr_annual_pct}% p.a.) · <strong>Cash Advance:</strong> ${escapeHtml(fees.cash_advance_fee)}<br/>
          <strong>Fuel Waiver &amp; Add-On:</strong> ${escapeHtml(fees.fuel_surcharge_waiver)} · Add-on: ${escapeHtml(fees.add_on_card_fee)}<br/>
          ${elig.approval_notes ? `<strong>Approval Tip:</strong> ${escapeHtml(elig.approval_notes)}` : ""}
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="pros-box">
        <div class="pc-title-pro">✓ Strengths (Pros)</div>
        <ul class="pc-list">${(d.pros_and_cons.pros || []).map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
      </div>
      <div class="cons-box">
        <div class="pc-title-con">⚠ Limitations &amp; Watch-Outs</div>
        <ul class="pc-list">${[...(d.pros_and_cons.cons || []), ...(d.reddit_user_feedback.practical_community_warnings || [])].slice(0, 7).map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
      </div>
    </div>

    ${
      deval.devaluation_history.length || deval.watch_out_vectors.length
        ? `<div class="warn-box" style="margin-top:10px;">
            <div style="font-size:10.5px;font-weight:600;color:#991B1B;margin-bottom:4px;">Devaluation Watch &amp; Historical Cuts (${escapeHtml(deval.last_devalued_on || "Monitored")})</div>
            <ul class="pc-list">${[...deval.devaluation_history, ...deval.watch_out_vectors].slice(0, 5).map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
          </div>`
        : ""
    }

    ${
      help
        ? `<div class="panel">
            <div class="panel-title">${escapeHtml(help.bank)} Support &amp; RBI Escalation (L1 → L2 → L3 PNO)</div>
            <div style="font-size:10px;line-height:1.45;">
              <strong>24x7 Helpline:</strong> ${escapeHtml(help.helplineTollFree)} · <strong>Card Block:</strong> ${escapeHtml(help.cardBlockNumber)}<br/>
              <strong>L1 Support (${escapeHtml(help.l1Sla)}):</strong> ${escapeHtml(help.l1Email)} · <strong>L2 Nodal (${escapeHtml(help.l2Sla)}):</strong> ${escapeHtml(help.l2NodalEmail)}<br/>
              <strong>L3 PNO:</strong> ${escapeHtml(help.l3PnoEmail)} (Tel: ${escapeHtml(help.pnoPhone)}) · <strong>Governance:</strong> ${escapeHtml(help.governanceEmail)}
            </div>
          </div>`
        : ""
    }

    <div class="ftr">
      <span>Cards by cogify · Complete Dossier PDF · Verdict: ${escapeHtml(d.pros_and_cons.verdict)}</span>
      <span>card.cogify.me · Verify final MITC before applying</span>
    </div>`;

  printHtmlDocument(`${d.identity.card_name} — Complete Dossier PDF`, bodyHtml, false);
}

export function exportCategoryStudyPdf(study: CategoryStudyTable): void {
  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const barChart = buildSvgBarChart(
    study.rows.slice(0, 10).map((r) => ({
      label: r.cardName.replace(/Credit Card|Card/gi, "").trim(),
      value: typeof r.rating === "number" ? r.rating : 3.5,
      display: typeof r.rating === "number" ? `${r.rating.toFixed(1)}★` : "—",
    })),
    {
      title: `Top Benchmarked Cards in ${study.title}`,
      subtitle: "Overall composite rating across earn rate, cap limits, fees & lounges",
      width: 720,
      height: 160,
    }
  );

  const rowsHtml = study.rows
    .map((row) => {
      const imgUrl = resolveImgAbs(row.localImagePath);
      return `
        <tr>
          <td style="min-width:195px;">
            <div style="display:flex;align-items:center;gap:8px;">
              ${imgUrl ? `<div class="card-art-frame" style="width:52px;height:34px;flex-shrink:0;"><img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(row.cardName)}" /></div>` : ""}
              <div>
                <div style="font-size:9px;color:#717882;">${escapeHtml(row.bank)}</div>
                <div style="font-size:10.5px;font-weight:600;color:#0F5C4D;">${escapeHtml(row.cardName)}</div>
              </div>
            </div>
          </td>
          <td style="white-space:nowrap;font-weight:600;">${escapeHtml(row.annualFee)}</td>
          <td style="white-space:nowrap;">★ ${typeof row.rating === "number" ? row.rating.toFixed(2) : "—"}</td>
          ${row.cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}
        </tr>`;
    })
    .join("");

  const bodyHtml = `
    <div class="hdr">
      <div>
        <div class="brand">Cards by cogify · Visual Category Research Study</div>
        <h1>${escapeHtml(study.title)}</h1>
        <p class="sub">${escapeHtml(study.subtitle)}</p>
      </div>
      <div class="meta-right">Generated ${escapeHtml(dateStr)}<br />${study.rows.length} Live Benchmarked Cards</div>
    </div>

    ${barChart}

    <table>
      <thead>
        <tr>
          <th>Card Artwork &amp; Issuer</th>
          <th>Annual Fee</th>
          <th>Rating</th>
          ${study.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <div class="panel">
      <div class="panel-title">Smart Card Selection Checkpoints</div>
      <div style="font-size:10px;color:#4B525C;line-height:1.45;">
        1. Verify monthly category reward caps and excluded MCCs (wallet loads, fuel, rent, jewellery, or tax often earn 0 on standard retail cards).<br/>
        2. Account for 18% GST on non-waived annual fees and track annual fee waiver thresholds via Cards Cashback Calculator.<br/>
        3. For airport lounge claims without physical cards, pre-generate QR passes on LoungeOne (loungeone.ai), TFS, or HOI (lms.hoi.in).
      </div>
    </div>

    <div class="ftr">
      <span>Cards by cogify · Category Benchmark Study (${study.rows.length} Cards)</span>
      <span>card.cogify.me · Objective Net-Return Research</span>
    </div>`;

  printHtmlDocument(`${study.title} — Cards by cogify PDF`, bodyHtml, true);
}

export async function shareUrlOrText(opts: {
  title: string;
  text: string;
  url?: string;
}): Promise<"shared" | "copied" | "failed"> {
  if (typeof window === "undefined") return "failed";
  const shareUrl = opts.url || window.location.href;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title: opts.title, text: opts.text, url: shareUrl });
      return "shared";
    }
  } catch {
    // Fallback to clipboard
  }
  try {
    await navigator.clipboard.writeText(`${opts.title}\n${opts.text}\n${shareUrl}`);
    return "copied";
  } catch {
    return "failed";
  }
}
