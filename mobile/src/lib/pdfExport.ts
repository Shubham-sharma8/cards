import { Image, NativeModules, Platform, Share } from 'react-native';
import { getBankHelpBySlug } from './bankHelpDirectory';
import { resolveCardImageAsset } from './cardImages';
import {
  formatInr,
  formatLoungeQuota,
  SPEND_CATEGORY_KEYS,
  SPEND_CATEGORY_META,
} from './format';
import { escapeHtml, sanitizeExternalUrl, sanitizeHexColor } from './security';
import type { MobileCardDossier } from './types';

type PdfNativeModule = {
  exportHtmlToPdf: (html: string, fileName: string) => Promise<string>;
};

const CardLedgerPdf: PdfNativeModule | undefined = NativeModules.CardLedgerPdf;

const CHART_PALETTE = [
  '#0F5C4D',
  '#1D4ED8',
  '#B45309',
  '#7C3AED',
  '#0369A1',
  '#15803D',
  '#374151',
  '#C2410C',
  '#0E7490',
  '#4338CA',
  '#0F766E',
  '#6B7280',
];

function resolveCardImageUri(dossier: MobileCardDossier): string | null {
  const localAsset = resolveCardImageAsset(dossier.visual_assets.local_image_path);
  if (localAsset) {
    try {
      const resolved = Image.resolveAssetSource(localAsset);
      if (resolved?.uri) return resolved.uri;
    } catch {
      // Ignore asset resolution error
    }
  }
  return sanitizeExternalUrl(dossier.visual_assets.image_url);
}

function buildSvgBarChart(
  items: Array<{ label: string; value: number; display: string; color?: string }>,
  opts: { title: string; subtitle?: string; width?: number; height?: number }
): string {
  if (!items.length) return '';
  const width = opts.width ?? 680;
  const height = opts.height ?? 172;
  const padL = 22;
  const padR = 16;
  const padT = 24;
  const padB = 40;
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
    .join('');

  const bars = items
    .map((item, idx) => {
      const ratio = Math.max(0.05, Math.min(1, item.value / maxVal));
      const bh = Math.round(ratio * plotH);
      const cx = padL + idx * step + step / 2;
      const bx = cx - barW / 2;
      const by = padT + plotH - bh;
      const fill = sanitizeHexColor(item.color, CHART_PALETTE[idx % CHART_PALETTE.length]);
      const shortLbl = item.label.length > 12 ? item.label.slice(0, 11) + '…' : item.label;

      return `
        <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW}" height="${bh}" rx="4" fill="${fill}" />
        <text x="${cx.toFixed(1)}" y="${Math.max(12, by - 5).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="600" fill="#1A1D21">${escapeHtml(item.display)}</text>
        <text x="${cx.toFixed(1)}" y="${(padT + plotH + 14).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="#4B525C">${escapeHtml(shortLbl)}</text>
      `;
    })
    .join('');

  return `
    <div class="chart-card">
      <div class="chart-title">${escapeHtml(opts.title)}</div>
      ${opts.subtitle ? `<div class="chart-sub">${escapeHtml(opts.subtitle)}</div>` : ''}
      <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;" xmlns="http://www.w3.org/2000/svg">
        ${gridLines}
        <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#CBD2D9" />
        ${bars}
      </svg>
    </div>
  `;
}

const PDF_STYLES = `
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body {
    margin: 0; padding: 0;
    background: #FBFBF8; color: #1A1D21;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    font-weight: 400; font-size: 11px; line-height: 1.44;
  }
  .hdr {
    display: flex; justify-content: space-between; align-items: flex-end;
    border-bottom: 2px solid #0F5C4D; padding-bottom: 10px; margin-bottom: 12px;
  }
  .brand { font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; color: #0F5C4D; font-weight: 600; }
  h1 { margin: 2px 0 0; font-size: 17.5px; font-weight: 600; color: #1A1D21; }
  .sub { margin: 3px 0 0; font-size: 10.5px; color: #4B525C; }
  .meta-right { text-align: right; font-size: 9.5px; color: #717882; }
  .art-box {
    width: 118px; height: 74px; border-radius: 8px; padding: 5px;
    border: 1px solid #E4E4DF; background: #F8F6F0;
    display: inline-flex; align-items: center; justify-content: center; margin-bottom: 5px;
  }
  .art-box img { width: 100%; height: 100%; object-fit: contain; display: block; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; background: #FFFFFF; border: 1px solid #E4E4DF; border-radius: 10px; overflow: hidden; margin-top: 10px; }
  th, td { padding: 7px 9px; border-bottom: 1px solid #EFEFE9; border-left: 1px solid #EFEFE9; vertical-align: top; text-align: left; font-size: 10px; }
  th:first-child, td:first-child { border-left: none; }
  tr:last-child td { border-bottom: none; }
  th { background: #FAF9F6; color: #4B525C; font-weight: 600; }
  .attr-col { width: 152px; background: #FAF9F6; color: #4B525C; font-weight: 600; }
  .win-cell { background: #EEF5F2; color: #0F5C4D; font-weight: 600; }
  .sec-row td { background: #F3F2EE; color: #1A1D21; font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; }
  .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px; break-inside: avoid; }
  .kpi { background: #FFFFFF; border: 1px solid #E4E4DF; border-radius: 8px; padding: 7px 9px; }
  .kpi-lbl { font-size: 8.5px; color: #717882; text-transform: uppercase; letter-spacing: 0.03em; display: block; }
  .kpi-val { font-size: 11.5px; font-weight: 600; color: #1A1D21; margin-top: 2px; display: block; }
  .kpi-sub { font-size: 8.8px; color: #4B525C; margin-top: 2px; display: block; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; break-inside: avoid; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; margin-top: 10px; break-inside: avoid; }
  .panel { background: #FFFFFF; border: 1px solid #E4E4DF; border-radius: 9px; padding: 9px 10px; margin-top: 10px; break-inside: avoid; }
  .panel-title { font-size: 10.5px; font-weight: 600; color: #0F5C4D; margin: 0 0 5px; text-transform: uppercase; letter-spacing: 0.03em; }
  .chart-card { background: #FFFFFF; border: 1px solid #E4E4DF; border-radius: 9px; padding: 9px 11px; margin-top: 10px; break-inside: avoid; }
  .chart-title { font-size: 11px; font-weight: 600; color: #1A1D21; }
  .chart-sub { font-size: 9px; color: #717882; margin-bottom: 5px; }
  .pros-box { background: #EEF5F2; border: 1px solid #C5DFD6; border-radius: 8px; padding: 9px 10px; break-inside: avoid; }
  .cons-box { background: #FEF6EA; border: 1px solid #EED8B5; border-radius: 8px; padding: 9px 10px; break-inside: avoid; }
  .warn-box { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 9px 10px; break-inside: avoid; margin-top: 10px; }
  ul.pc-list { margin: 0; padding-left: 14px; }
  ul.pc-list li { margin-bottom: 3px; font-size: 9.8px; color: #1A1D21; line-height: 1.38; }
  .ftr { margin-top: 12px; padding-top: 8px; border-top: 1px solid #E4E4DF; font-size: 9px; color: #717882; display: flex; justify-content: space-between; }
`;

function wrapHtml(body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${PDF_STYLES}</style>
</head>
<body>${body}</body>
</html>`;
}

export async function exportComparisonPdfMobile(dossiers: MobileCardDossier[]): Promise<void> {
  if (!dossiers.length) return;
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const bestRating = Math.max(...dossiers.map((c) => c.ratings.overall_market_rating));
  const lowestFee = Math.min(...dossiers.map((c) => c.fees_and_charges_detailed.annual_fee_inr));
  const lowestForex = Math.min(...dossiers.map((c) => c.fees_and_charges_detailed.forex_markup_pct));

  const chartRating = buildSvgBarChart(
    dossiers.map((c) => ({
      label: c.identity.card_name.replace(/Credit Card/gi, '').trim(),
      value: c.ratings.overall_market_rating,
      display: `${c.ratings.overall_market_rating.toFixed(2)}★`,
    })),
    { title: 'Overall Rating (/5.0)', width: 330, height: 146 }
  );

  const chartPeak = buildSvgBarChart(
    dossiers.map((c) => {
      const vals = Object.values(c.reward_calculator_model?.effective_return_pct_by_category || {}).filter(
        (v) => typeof v === 'number'
      );
      const peak = vals.length ? Math.max(...vals) : c.reward_calculator_model.accelerated_reward_rate_pct;
      return {
        label: c.identity.card_name.replace(/Credit Card/gi, '').trim(),
        value: Math.max(0.2, peak),
        display: `${peak.toFixed(1)}%`,
      };
    }),
    { title: 'Peak Category Return (%)', width: 330, height: 146 }
  );

  const thCols = dossiers
    .map((c) => {
      const imgUri = resolveCardImageUri(c);
      return `
        <th>
          ${imgUri ? `<div class="art-box"><img src="${escapeHtml(imgUri)}" alt="${escapeHtml(c.identity.card_name)}" /></div>` : ''}
          <div style="font-size:9px;color:#717882;">${escapeHtml(c.identity.bank)} · ${escapeHtml(c.identity.card_network)}</div>
          <div style="font-size:11.5px;font-weight:600;color:#1A1D21;">${escapeHtml(c.identity.card_name)}</div>
          <div style="font-size:9px;color:#0F5C4D;">${escapeHtml(c.pros_and_cons.verdict || c.identity.primary_category)}</div>
        </th>`;
    })
    .join('');

  const catRows = SPEND_CATEGORY_KEYS.map((key) => {
    const vals = dossiers.map((c) => c.reward_calculator_model.effective_return_pct_by_category[key] ?? 0);
    const maxV = Math.max(...vals);
    return `
      <tr>
        <td class="attr-col">${escapeHtml(SPEND_CATEGORY_META[key].shortLabel)}</td>
        ${dossiers
          .map((c) => {
            const v = c.reward_calculator_model.effective_return_pct_by_category[key] ?? 0;
            const win = v > 0 && Math.abs(v - maxV) < 0.001;
            return `<td class="${win ? 'win-cell' : ''}">${v.toFixed(2)}%</td>`;
          })
          .join('')}
      </tr>`;
  }).join('');

  const prosConsColumns = dossiers
    .map((c) => {
      const help = getBankHelpBySlug(c.identity.bank_slug);
      return `
      <div class="panel">
        <div class="panel-title">${escapeHtml(c.identity.card_name)} — Verdict &amp; Care</div>
        <ul class="pc-list">
          ${(c.pros_and_cons.pros || []).slice(0, 3).map((p) => `<li>✓ ${escapeHtml(p)}</li>`).join('')}
          ${(c.pros_and_cons.cons || []).slice(0, 2).map((con) => `<li>⚠ ${escapeHtml(con)}</li>`).join('')}
        </ul>
        ${
          help
            ? `<div style="margin-top:5px;padding-top:4px;border-top:1px solid #EFEFE9;font-size:8.8px;color:#4B525C;"><strong>Helpline:</strong> ${escapeHtml(help.helplineTollFree)} · <strong>PNO:</strong> ${escapeHtml(help.l3PnoEmail)}</div>`
            : ''
        }
      </div>`;
    })
    .join('');

  const body = `
    <div class="hdr">
      <div>
        <div class="brand">CardLedger India · Comprehensive Comparison Dossier</div>
        <h1>Side-by-Side Credit Card Comparison</h1>
        <p class="sub">${escapeHtml(dossiers.map((d) => d.identity.card_name).join(' vs. '))}</p>
      </div>
      <div class="meta-right">Generated ${escapeHtml(dateStr)}<br />Post-Cap Return · MITC · L1/L2/PNO</div>
    </div>
    <div class="grid-2">${chartRating}${chartPeak}</div>
    <table>
      <thead><tr><th class="attr-col">Dimension</th>${thCols}</tr></thead>
      <tbody>
        <tr class="sec-row"><td colspan="${dossiers.length + 1}">Fees, Valuation &amp; Market Ratings</td></tr>
        <tr><td class="attr-col">Joining / Annual Fee</td>${dossiers.map((c) => {
          const a = c.fees_and_charges_detailed.annual_fee_inr;
          const j = c.fees_and_charges_detailed.joining_fee_inr;
          const gst = c.fees_and_charges_detailed.gst_applicable && a > 0 ? ' (+18% GST)' : '';
          return `<td class="${a === lowestFee ? 'win-cell' : ''}">${j === 0 ? '₹0' : escapeHtml(formatInr(j))} / ${a === 0 ? 'LTF (₹0)' : escapeHtml(formatInr(a))}${escapeHtml(gst)}</td>`;
        }).join('')}</tr>
        <tr><td class="attr-col">Annual Waiver Target</td>${dossiers.map((c) => `<td>${c.fees_and_charges_detailed.fee_waiver_spend_inr ? escapeHtml(formatInr(c.fees_and_charges_detailed.fee_waiver_spend_inr)) + '/yr' : c.fees_and_charges_detailed.annual_fee_inr === 0 ? 'Lifetime Free' : 'No waiver'}</td>`).join('')}</tr>
        <tr><td class="attr-col">Forex Markup</td>${dossiers.map((c) => `<td class="${c.fees_and_charges_detailed.forex_markup_pct === lowestForex ? 'win-cell' : ''}">${c.fees_and_charges_detailed.forex_markup_pct}%</td>`).join('')}</tr>
        <tr><td class="attr-col">Reward Engine &amp; Expiry</td>${dossiers.map((c) => `<td>${escapeHtml(c.reward_calculator_model.earn_unit)} · ${escapeHtml(c.reward_calculator_model.point_expiry)}</td>`).join('')}</tr>
        <tr><td class="attr-col">Market Rating</td>${dossiers.map((c) => `<td class="${c.ratings.overall_market_rating === bestRating ? 'win-cell' : ''}">★ ${c.ratings.overall_market_rating.toFixed(2)}/5</td>`).join('')}</tr>
        <tr class="sec-row"><td colspan="${dossiers.length + 1}">Lounge, Golf &amp; Eligibility</td></tr>
        <tr><td class="attr-col">Domestic Lounge</td>${dossiers.map((c) => {
          const q = formatLoungeQuota(c.lounge_access_detailed.domestic.visits_per_year, c.lounge_access_detailed.domestic.visits_per_quarter) || 'None';
          return `<td class="${c.lounge_access_detailed.no_spend_domestic_lounge ? 'win-cell' : ''}">${escapeHtml(q)} · ${escapeHtml(c.lounge_access_detailed.domestic.spend_criteria || (c.lounge_access_detailed.no_spend_domestic_lounge ? 'No-Spend Free' : 'Check Terms'))}</td>`;
        }).join('')}</tr>
        <tr><td class="attr-col">International &amp; Golf</td>${dossiers.map((c) => `<td>Intl: ${escapeHtml(String(c.lounge_access_detailed.international.visits_per_year || 'None'))} · Golf: ${c.benefits_features_and_faqs.golf_summary?.has_golf ? escapeHtml(c.benefits_features_and_faqs.golf_summary.complimentary_access) : 'None'}</td>`).join('')}</tr>
        <tr><td class="attr-col">Income &amp; CIBIL</td>${dossiers.map((c) => `<td>${c.eligibility_detailed.min_monthly_income_salaried_inr ? escapeHtml(formatInr(c.eligibility_detailed.min_monthly_income_salaried_inr)) + '/mo' : 'Check'} · CIBIL ${c.eligibility_detailed.min_cibil_score}+</td>`).join('')}</tr>
        <tr><td class="attr-col">Devaluation Risk</td>${dossiers.map((c) => `<td>${c.devaluation_analysis.devaluation_risk_score}/10 (${escapeHtml(c.devaluation_analysis.devaluation_frequency)})</td>`).join('')}</tr>
        <tr class="sec-row"><td colspan="${dossiers.length + 1}">Net Return Across 12 Spend Categories</td></tr>
        ${catRows}
      </tbody>
    </table>
    <div class="${dossiers.length === 3 ? 'grid-3' : 'grid-2'}">${prosConsColumns}</div>
    <div class="ftr"><span>CardLedger India · Native iOS Report</span><span>Verify MITC &amp; caps before applying</span></div>`;

  const fileName = `cardledger-compare-${dossiers.map((d) => d.identity.card_slug.slice(0, 12)).join('-vs-')}.pdf`;
  if (Platform.OS === 'ios' && CardLedgerPdf?.exportHtmlToPdf) {
    await CardLedgerPdf.exportHtmlToPdf(wrapHtml(body), fileName);
    return;
  }
  await shareComparisonSummary(dossiers);
}

export async function exportSingleCardPdfMobile(d: MobileCardDossier): Promise<void> {
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const imgUri = resolveCardImageUri(d);
  const accent = sanitizeHexColor(d.visual_assets.card_theme?.primary_hex, '#0F5C4D');
  const fees = d.fees_and_charges_detailed;
  const calc = d.reward_calculator_model;
  const lng = d.lounge_access_detailed;
  const elig = d.eligibility_detailed;
  const deval = d.devaluation_analysis;
  const ben = d.benefits_features_and_faqs;
  const help = getBankHelpBySlug(d.identity.bank_slug);
  const domQuota = formatLoungeQuota(lng.domestic.visits_per_year, lng.domestic.visits_per_quarter) || (lng.has_domestic_lounge ? 'Included' : 'None');

  const catChartSvg = buildSvgBarChart(
    SPEND_CATEGORY_KEYS.map((k) => {
      const pct = calc.effective_return_pct_by_category[k] ?? 0;
      return {
        label: SPEND_CATEGORY_META[k].shortLabel,
        value: Math.max(0.15, pct),
        display: `${pct.toFixed(1)}%`,
        color: pct >= 5 ? '#0F5C4D' : pct >= 2 ? '#1D4ED8' : '#64748B',
      };
    }),
    {
      title: '12-Category Effective Post-Cap Return (%)',
      subtitle: `Unit: ${calc.earn_unit} · Base ₹${calc.point_value_inr_default}/pt · Expiry: ${calc.point_expiry}`,
      width: 660,
      height: 170,
    }
  );

  const pvEntries = Object.entries(calc.point_value_inr_matrix || {});
  const transferPartners = (calc.transfer_partners || []).map((p) =>
    typeof p === 'string' ? p : `${p.partner} (${p.ratio})`
  );

  const body = `
    <div class="hdr">
      <div style="display:flex;align-items:center;gap:12px;">
        ${imgUri ? `<div class="art-box"><img src="${escapeHtml(imgUri)}" alt="${escapeHtml(d.identity.card_name)}" /></div>` : ''}
        <div>
          <div class="brand" style="color:${accent};">${escapeHtml(d.identity.bank)} · ${escapeHtml(d.identity.card_network)} · ${escapeHtml(d.identity.card_tier)}</div>
          <h1>${escapeHtml(d.identity.card_name)}</h1>
          <p class="sub">${escapeHtml(d.pros_and_cons.editorial_summary || d.pros_and_cons.verdict)}</p>
        </div>
      </div>
      <div class="meta-right">Market ★ ${d.ratings.overall_market_rating.toFixed(2)}/5<br />${escapeHtml(d.identity.primary_category)} · ${escapeHtml(dateStr)}</div>
    </div>

    <div class="kpi-row">
      <div class="kpi">
        <span class="kpi-lbl">Joining / Annual Fee</span>
        <span class="kpi-val">${fees.joining_fee_inr === 0 ? '₹0' : escapeHtml(formatInr(fees.joining_fee_inr))} / ${fees.annual_fee_inr === 0 ? 'LTF (₹0)' : escapeHtml(formatInr(fees.annual_fee_inr))}</span>
        <span class="kpi-sub">${fees.gst_applicable && fees.annual_fee_inr > 0 ? '+18% GST · ' : ''}${fees.fee_waiver_spend_inr ? 'Waiver @ ' + escapeHtml(formatInr(fees.fee_waiver_spend_inr)) : 'Standard renewal'}</span>
      </div>
      <div class="kpi">
        <span class="kpi-lbl">Lounge &amp; Golf</span>
        <span class="kpi-val">Dom: ${escapeHtml(domQuota)}</span>
        <span class="kpi-sub">Intl: ${escapeHtml(String(lng.international.visits_per_year || 'None'))} · ${ben.golf_summary?.has_golf ? 'Golf: ' + escapeHtml(ben.golf_summary.complimentary_access) : 'No golf'}</span>
      </div>
      <div class="kpi">
        <span class="kpi-lbl">Forex &amp; Deval Risk</span>
        <span class="kpi-val">${fees.forex_markup_pct}% Forex Markup</span>
        <span class="kpi-sub">Risk: ${deval.devaluation_risk_score}/10 (${escapeHtml(deval.devaluation_frequency)})</span>
      </div>
    </div>

    ${catChartSvg}
    ${
      Object.keys(calc.category_caveats || {}).length
        ? `<div class="panel" style="padding:7px 10px;background:#FFFBEB;border-color:#FDE68A;"><div class="panel-title" style="color:#92400E;margin-bottom:3px;">Partner &amp; Category Conditions</div><ul class="pc-list">${Object.values(calc.category_caveats || {}).map((cv) => `<li>${escapeHtml(cv)}</li>`).join('')}</ul></div>`
        : ''
    }

    <div class="grid-2">
      <div class="panel">
        <div class="panel-title">Reward Engine, Caps &amp; Exclusions</div>
        <div style="font-size:9.8px;margin-bottom:4px;"><strong>Base:</strong> ${calc.base_reward_rate_pct}% · <strong>Peak:</strong> ${calc.accelerated_reward_rate_pct}% · <strong>Pt Value:</strong> ₹${calc.point_value_inr_default}</div>
        ${pvEntries.length ? `<div style="font-size:9px;color:#4B525C;margin-bottom:4px;"><strong>Redeem Matrix:</strong> ${escapeHtml(pvEntries.map(([k, v]) => `${k}: ${v}`).join(' · '))}</div>` : ''}
        ${(calc.monthly_capping_rules || []).length ? `<ul class="pc-list">${calc.monthly_capping_rules.slice(0, 4).map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
        ${(calc.excluded_categories || []).length ? `<div style="font-size:9px;color:#9A5B13;margin-top:4px;"><strong>0 Rewards On:</strong> ${escapeHtml(calc.excluded_categories.join(', '))}</div>` : ''}
      </div>
      <div class="panel">
        <div class="panel-title">Milestones, Transfers &amp; Eligibility</div>
        ${(ben.milestone_benefits || []).length ? `<ul class="pc-list">${ben.milestone_benefits.slice(0, 3).map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>` : ''}
        <div style="font-size:9.5px;margin-top:4px;"><strong>Partners:</strong> ${transferPartners.length ? escapeHtml(transferPartners.join(', ')) : 'Statement cash / rewards'}</div>
        <div style="font-size:9.5px;margin-top:4px;"><strong>Eligibility:</strong> ${elig.min_monthly_income_salaried_inr ? escapeHtml(formatInr(elig.min_monthly_income_salaried_inr)) + '/mo' : 'Variable'} · CIBIL ${elig.min_cibil_score}+ · APR ${fees.apr_monthly_pct}%/mo</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">Online Cardless Lounge &amp; Golf Claim Procedure</div>
      <div style="font-size:9.8px;line-height:1.42;">
        <strong>Domestic Criteria:</strong> ${escapeHtml(lng.domestic.spend_criteria || (lng.no_spend_domestic_lounge ? 'No Spend Condition' : 'Check quarterly spend'))} · <strong>Online Portals (No Physical Card Needed):</strong> Pre-generate QR at loungeone.ai, loungeaccess.travelfoodservices.com, or lms.hoi.in before terminal entry.<br/>
        <strong>Golf Desk:</strong> ${ben.golf_summary?.has_golf ? escapeHtml(ben.golf_summary.complimentary_access + ' · Book via RuPay Truztee / Mastercard 1800-102-6263 / Visa TeePass.') : 'Not included on this variant.'}
      </div>
    </div>

    <div class="grid-2">
      <div class="pros-box">
        <div style="color:#0F5C4D;font-weight:600;font-size:10.5px;margin-bottom:4px;">✓ What Works (Pros)</div>
        <ul class="pc-list">${(d.pros_and_cons.pros || []).map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
      </div>
      <div class="cons-box">
        <div style="color:#9A5B13;font-weight:600;font-size:10.5px;margin-bottom:4px;">⚠ Watch-Outs &amp; Restrictions</div>
        <ul class="pc-list">${[...(d.pros_and_cons.cons || []), ...(d.reddit_user_feedback.practical_community_warnings || [])].slice(0, 6).map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
      </div>
    </div>

    ${
      deval.devaluation_history.length || deval.watch_out_vectors.length
        ? `<div class="warn-box"><div style="font-size:10px;font-weight:600;color:#991B1B;margin-bottom:4px;">Devaluation Watch &amp; History (${escapeHtml(deval.last_devalued_on || 'Tracked')})</div><ul class="pc-list">${[...deval.devaluation_history, ...deval.watch_out_vectors].slice(0, 4).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`
        : ''
    }

    ${
      help
        ? `<div class="panel">
            <div class="panel-title">${escapeHtml(help.bank)} Support &amp; RBI Escalation (L1 → L2 → L3 PNO)</div>
            <div style="font-size:9.5px;line-height:1.42;">
              <strong>Helpline:</strong> ${escapeHtml(help.helplineTollFree)} · <strong>Block:</strong> ${escapeHtml(help.cardBlockNumber)}<br/>
              <strong>L1:</strong> ${escapeHtml(help.l1Email)} · <strong>L2 Nodal:</strong> ${escapeHtml(help.l2NodalEmail)} · <strong>L3 PNO:</strong> ${escapeHtml(help.l3PnoEmail)}
            </div>
          </div>`
        : ''
    }
    <div class="ftr"><span>CardLedger India · Dossier Report</span><span>Always verify final MITC before applying</span></div>`;

  const fileName = `${d.identity.card_slug}.pdf`;
  if (Platform.OS === 'ios' && CardLedgerPdf?.exportHtmlToPdf) {
    await CardLedgerPdf.exportHtmlToPdf(wrapHtml(body), fileName);
    return;
  }
  await shareCardSummary(d);
}

export async function shareCardSummary(d: MobileCardDossier): Promise<void> {
  const feeText = d.fees_and_charges_detailed.annual_fee_inr === 0
    ? '₹0 (Lifetime Free)'
    : `${formatInr(d.fees_and_charges_detailed.annual_fee_inr)}/yr`;
  const domQuota = formatLoungeQuota(d.lounge_access_detailed.domestic.visits_per_year, d.lounge_access_detailed.domestic.visits_per_quarter) || 'None';
  const prosTop = (d.pros_and_cons.pros || []).slice(0, 3).map((p) => `✓ ${p}`).join('\n');
  const consTop = (d.pros_and_cons.cons || []).slice(0, 2).map((c) => `⚠ ${c}`).join('\n');

  await Share.share({
    title: `${d.identity.card_name} (${d.identity.bank})`,
    message: `${d.identity.card_name} — ${d.identity.bank} (${d.identity.card_network})\nRating: ★ ${d.ratings.overall_market_rating.toFixed(2)}/5 · Annual Fee: ${feeText} · Lounge: ${domQuota} · Forex: ${d.fees_and_charges_detailed.forex_markup_pct}%\n\nPros:\n${prosTop}\n\nCons:\n${consTop}`,
  });
}

export async function shareComparisonSummary(dossiers: MobileCardDossier[]): Promise<void> {
  const summaryLines = dossiers.map((d) => {
    const fee = d.fees_and_charges_detailed.annual_fee_inr === 0 ? 'LTF' : formatInr(d.fees_and_charges_detailed.annual_fee_inr);
    const dom = formatLoungeQuota(d.lounge_access_detailed.domestic.visits_per_year, d.lounge_access_detailed.domestic.visits_per_quarter) || 'None';
    return `• ${d.identity.card_name} (${d.identity.bank}): Fee ${fee} · ★ ${d.ratings.overall_market_rating.toFixed(2)}/5 · Lounge: ${dom} · Forex: ${d.fees_and_charges_detailed.forex_markup_pct}%`;
  });
  await Share.share({
    title: `CardLedger Comparison (${dossiers.length} cards)`,
    message: `CardLedger Side-by-Side Comparison:\n\n${summaryLines.join('\n')}`,
  });
}
