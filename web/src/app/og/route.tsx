import { ImageResponse } from "next/og";
import {
  getCardDossierAsync,
  getCardsByIdsAsync,
  getDevaluationTrackerAsync,
  getLoungeAccessMasterAsync,
  getSearchIndexAsync,
  getSiteCounts,
} from "@/lib/data";
import {
  SPEND_CATEGORY_KEYS,
  cardLocalImageUrl,
  formatInr,
  formatLoungeQuota,
} from "@/lib/format";
import { isValidSlug, sanitizeCardIdList, sanitizeHexColor } from "@/lib/security";

const R2_BASE = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim() ||
  "https://pub-8a560aaca6404206b9adcd66799b1cee.r2.dev"
).replace(/\/+$/, "");

async function fetchR2RasterDataUri(relUrl: string | null | undefined): Promise<string | null> {
  if (!relUrl) return null;
  const clean = relUrl.replace(/^\/+/, "");
  const lower = clean.toLowerCase();
  if (!lower.endsWith(".png") && !lower.endsWith(".jpg") && !lower.endsWith(".jpeg")) {
    return null;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1600);
    const res = await fetch(`${R2_BASE}/${clean}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const mime = lower.endsWith(".png") ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

async function loadCardArtDataUri(
  localImagePath: string | null | undefined
): Promise<string | null> {
  return fetchR2RasterDataUri(cardLocalImageUrl(localImagePath));
}

async function loadBankLogoDataUri(bankSlug: string): Promise<string | null> {
  if (!isValidSlug(bankSlug)) return null;
  return fetchR2RasterDataUri(`logos/banks/${bankSlug}.png`);
}

const OG_HEADERS = {
  "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
  "X-Robots-Tag": "noindex",
};

function BrandHeaderPill({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "#0F5C4D",
            color: "#FFFFFF",
            fontSize: 19,
            fontWeight: 700,
          }}
        >
          C
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#1A1D21", letterSpacing: -0.5 }}>
              Cards
            </span>
            <span style={{ fontSize: 15, fontWeight: 500, color: "#0F5C4D" }}>
              by cogify
            </span>
          </div>
          <span style={{ fontSize: 13, color: "#5C6470" }}>
            card.cogify.me · A product of cogify.me
          </span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 16px",
          borderRadius: 999,
          background: "#EEF5F2",
          border: "1px solid #C5DFD6",
          color: "#0F5C4D",
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") || "home").trim().toLowerCase();

  // 1. Single Card Dossier Preview (with R2 PNG logo + vector/raster card artwork)
  if (type === "card") {
    const bank = searchParams.get("bank")?.trim() ?? "";
    const card = searchParams.get("card")?.trim() ?? "";
    if (isValidSlug(bank) && isValidSlug(card)) {
      const dossier = await getCardDossierAsync(bank, card);
      if (dossier) {
        const {
          identity,
          visual_assets: art,
          fees_and_charges_detailed: fees,
          ratings,
          lounge_access_detailed: lounge,
          reward_calculator_model: calc,
          pros_and_cons: pc,
        } = dossier;

        const [cardArtUri, bankLogoUri] = await Promise.all([
          loadCardArtDataUri(art.local_image_path),
          loadBankLogoDataUri(identity.bank_slug),
        ]);

        const peakReturn = Math.max(
          0,
          ...SPEND_CATEGORY_KEYS.map((k) => calc.effective_return_pct_by_category?.[k] ?? 0)
        );
        const domQuota =
          formatLoungeQuota(
            lounge.domestic.visits_per_year,
            lounge.domestic.visits_per_quarter
          ) || (lounge.has_domestic_lounge ? "Included" : "None");
        const intlQuota =
          formatLoungeQuota(lounge.international.visits_per_year, null) ||
          (lounge.has_international_lounge ? "Included" : "None");
        const feeText = fees.annual_fee_inr === 0 ? "₹0 (LTF)" : formatInr(fees.annual_fee_inr);
        const rawSummary = (
          pc.editorial_summary ||
          pc.verdict ||
          `${identity.primary_category} credit card`
        ).trim();
        const capped = rawSummary.charAt(0).toUpperCase() + rawSummary.slice(1);
        const summary = capped.slice(0, 128) + (capped.length > 128 ? "…" : "");

        const softBg = sanitizeHexColor(art.card_theme?.soft_bg_hex, "#F5F2EA");
        const borderHex = sanitizeHexColor(art.card_theme?.border_hex, "#DDD9CF");

        return new ImageResponse(
          (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "38px 46px",
                background: "linear-gradient(135deg, #FAF9F6 0%, #F2EFE6 100%)",
                color: "#1A1D21",
                fontFamily: "sans-serif",
              }}
            >
              <BrandHeaderPill label={`${identity.primary_category} · ${identity.card_network}`} />

              <div style={{ display: "flex", alignItems: "center", gap: 36, marginTop: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {bankLogoUri ? (
                      <img
                        src={bankLogoUri}
                        width={36}
                        height={36}
                        style={{ borderRadius: 8, objectFit: "contain", background: "#FFF" }}
                        alt=""
                      />
                    ) : null}
                    <span style={{ fontSize: 20, fontWeight: 600, color: "#0F5C4D" }}>
                      {identity.bank}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      fontSize: identity.card_name.length > 34 ? 38 : 44,
                      fontWeight: 700,
                      lineHeight: 1.12,
                      letterSpacing: -1,
                      color: "#1A1D21",
                    }}
                  >
                    {identity.card_name}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      fontSize: 19,
                      lineHeight: 1.4,
                      color: "#4B525C",
                    }}
                  >
                    {summary}
                  </div>
                </div>

                <div
                  style={{
                    width: 440,
                    height: 282,
                    borderRadius: 22,
                    background: softBg,
                    border: `2px solid ${borderHex}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 18,
                    boxShadow: "0 16px 36px rgba(26,29,33,0.10)",
                  }}
                >
                  {cardArtUri ? (
                    <img
                      src={cardArtUri}
                      width={396}
                      height={244}
                      style={{ objectFit: "contain" }}
                      alt=""
                    />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        width: "100%",
                        height: "100%",
                        borderRadius: 16,
                        padding: 24,
                        background: "#0F5C4D",
                        color: "#FFFFFF",
                      }}
                    >
                      <span style={{ fontSize: 18, opacity: 0.85 }}>{identity.bank}</span>
                      <span style={{ fontSize: 26, fontWeight: 700 }}>{identity.card_name}</span>
                      <span style={{ fontSize: 16, opacity: 0.8 }}>{identity.card_network}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 16, width: "100%" }}>
                {[
                  { label: "Annual Fee", value: feeText, accent: fees.annual_fee_inr === 0 },
                  {
                    label: "Peak Reward",
                    value: `${peakReturn.toFixed(1)}% real`,
                    accent: peakReturn >= 4,
                  },
                  {
                    label: "Dom / Intl Lounge",
                    value: `${domQuota} · ${intlQuota}`,
                    accent: false,
                  },
                  {
                    label: "Market Rating",
                    value: `${ratings.overall_market_rating.toFixed(2)} / 5`,
                    accent: true,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      background: stat.accent ? "#EEF5F2" : "#FFFFFF",
                      border: stat.accent ? "1px solid #C5DFD6" : "1px solid #E4E4DF",
                      borderRadius: 14,
                      padding: "13px 16px",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "#68707C", fontWeight: 500 }}>
                      {stat.label}
                    </span>
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: stat.accent ? "#0F5C4D" : "#1A1D21",
                      }}
                    >
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ),
          { width: 1200, height: 630, headers: OG_HEADERS }
        );
      }
    }
  }

  // 2. Side-by-Side Comparison Preview (?type=compare&cards=id1,id2,id3)
  if (type === "compare") {
    const ids = sanitizeCardIdList(searchParams.get("cards"), 3);
    const dossiers = ids.length > 0 ? await getCardsByIdsAsync(ids) : [];
    const idxPayload = await getSearchIndexAsync();
    const displayCards =
      dossiers.length > 0
        ? dossiers
        : await getCardsByIdsAsync(
            (idxPayload.cards || [])
              .slice()
              .sort((a, b) => b.overall_rating - a.overall_rating)
              .slice(0, 3)
              .map((c) => c.card_id)
          );

    const artUris = await Promise.all(
      displayCards.map((d) => loadCardArtDataUri(d.visual_assets.local_image_path))
    );

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "38px 46px",
            background: "linear-gradient(135deg, #FAF9F6 0%, #F1EFE6 100%)",
            color: "#1A1D21",
            fontFamily: "sans-serif",
          }}
        >
          <BrandHeaderPill label={`Side-by-Side Comparison · ${displayCards.length} Cards`} />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.8, color: "#1A1D21" }}>
              {displayCards.map((d) => d.identity.card_name).join(" vs ")}
            </span>
            <span style={{ fontSize: 18, color: "#4B525C" }}>
              Fees, Real Category Cashback %, Lounge Quotas, Forex &amp; Pros vs Cons
            </span>
          </div>

          <div style={{ display: "flex", gap: 18, width: "100%" }}>
            {displayCards.map((d, idx) => {
              const peak = Math.max(
                0,
                ...SPEND_CATEGORY_KEYS.map(
                  (k) => d.reward_calculator_model.effective_return_pct_by_category?.[k] ?? 0
                )
              );
              const dom =
                formatLoungeQuota(
                  d.lounge_access_detailed.domestic.visits_per_year,
                  d.lounge_access_detailed.domestic.visits_per_quarter
                ) || "None";
              const fee =
                d.fees_and_charges_detailed.annual_fee_inr === 0
                  ? "₹0 (LTF)"
                  : formatInr(d.fees_and_charges_detailed.annual_fee_inr);
              return (
                <div
                  key={d.identity.card_id}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    background: "#FFFFFF",
                    border: "1px solid #DCDAD0",
                    borderRadius: 18,
                    padding: 18,
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      height: 152,
                      borderRadius: 12,
                      background: sanitizeHexColor(d.visual_assets.card_theme?.soft_bg_hex, "#F8F6F0"),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 10,
                    }}
                  >
                    {artUris[idx] ? (
                      <img
                        src={artUris[idx]!}
                        width={224}
                        height={136}
                        style={{ objectFit: "contain" }}
                        alt=""
                      />
                    ) : (
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#0F5C4D" }}>
                        {d.identity.bank}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 13, color: "#68707C" }}>{d.identity.bank}</span>
                    <span style={{ fontSize: 19, fontWeight: 700, color: "#1A1D21" }}>
                      {d.identity.card_name}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: "1px solid #EFEFE9",
                      paddingTop: 10,
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: "#4B525C" }}>Fee: {fee}</span>
                    <span style={{ color: "#0F5C4D", fontWeight: 700 }}>
                      {peak.toFixed(1)}% · {d.ratings.overall_market_rating.toFixed(1)}/5
                    </span>
                  </div>
                  <span style={{ fontSize: 13, color: "#5C6470" }}>Lounge: {dom}</span>
                </div>
              );
            })}
          </div>
        </div>
      ),
      { width: 1200, height: 630, headers: OG_HEADERS }
    );
  }

  // 3. Hub / Tool Pages (home, lounge, calculator, advisor, devaluations, categories, banks, cards, my-cards)
  const [idxData, loungeMaster, devalTracker] = await Promise.all([
    getSearchIndexAsync(),
    getLoungeAccessMasterAsync(),
    getDevaluationTrackerAsync(),
  ]);
  const cards = idxData.cards || [];
  const counts = getSiteCounts();
  const cardCountDisplay = cards.length || counts.totalCards;
  const bankCountDisplay = counts.totalBanks;
  const airportCount = new Set(
    (loungeMaster.participating_indian_airport_lounges || []).map((s) => s.airport_code)
  ).size || 42;
  const loungeCount = loungeMaster.participating_indian_airport_lounges_count || 90;
  const devalCount = (devalTracker.timeline_2024_2026 || []).length || 13;

  const sectionMeta: Record<
    string,
    { pill: string; headline: string; sub: string; badges: Array<[string, string]> }
  > = {
    home: {
      pill: `${cardCountDisplay} Cards · ${bankCountDisplay} Banks`,
      headline: "Clear Math for Indian Credit Cards.",
      sub: "Calculate real post-cap rupee cashback, verify 42+ airport terminal lounges & golf access, and inspect issuer MITC & devaluations.",
      badges: [
        ["Cards Indexed", `${cardCountDisplay} Active`],
        ["Lifetime Free", `${cards.filter((c) => c.filter_tags.is_ltf).length || 140} Cards`],
        ["Airport Lounges", `${loungeCount}+ (${airportCount} Cities)`],
        ["Verified Sources", "Bank MITC + T&C"],
      ],
    },
    lounge: {
      pill: "Airport Lounge, Golf & Rail Directory",
      headline: "Airport Lounges, Golf & Cardless QR Claim Guides",
      sub: `Search ${loungeCount}+ Indian airport terminal lounges across ${airportCount} cities, online QR claim portals (LoungeOne, Hoi, TFS), and spend rules.`,
      badges: [
        ["Terminal Lounges", `${loungeCount} (${airportCount} Cities)`],
        ["No-Spend Lounge", `${cards.filter((c) => c.filter_tags.no_spend_domestic_lounge).length || 45} Cards`],
        ["Golf Enabled", `${cards.filter((c) => c.filter_tags.has_golf).length || 55} Cards`],
        ["Claim Portals", "LoungeOne · Hoi · TFS"],
      ],
    },
    calculator: {
      pill: "12-Category Spend Engine",
      headline: "Real Annual Cashback Calculator — After Caps & GST",
      sub: "Model your actual monthly spend across Amazon/Flipkart, dining, UPI, utilities, fuel, and forex to rank net rupee value.",
      badges: [
        ["Spend Categories", "12 Verticals"],
        ["Capping Aware", "Monthly + Pooled"],
        ["Transfer Modes", "Cash · Flights · Accor"],
        ["Coverage", `${cardCountDisplay} Cards`],
      ],
    },
    advisor: {
      pill: "Eligibility & 2-Card Combo Builder",
      headline: "Personalized Credit Card Advisor & Wallet Optimizer",
      sub: "Match cards by salary, ITR & CIBIL threshold, verify fee-waiver fit, and optimize a 2-card swipe pair.",
      badges: [
        ["Eligibility Check", "Income + CIBIL"],
        ["2-Card Combos", "Category Split"],
        ["Fee Waiver Math", "Auto-Checked"],
        ["Zero Bias", "Math-Only Rank"],
      ],
    },
    devaluations: {
      pill: "2024–2026 Issuer Audit",
      headline: "Indian Credit Card Devaluation Tracker",
      sub: "Track verified 2024–2026 reward cuts, spend-linked lounge changes, and bank-by-bank risk scores before applying.",
      badges: [
        ["Timeline Events", `${devalCount} Verified`],
        ["Risk Scores", `${bankCountDisplay} Banks`],
        ["Watch Vectors", "Caps · Rent · Lounge"],
        ["Card Alerts", "Instant Click"],
      ],
    },
    categories: {
      pill: "18 Category Benchmark Tables",
      headline: "Best Credit Cards by Spend Category — Live Study Tables",
      sub: "Up-to-date benchmark tables for Insurance, Utilities, Golf, Travel, Lounge, Cashback, Dining, Fuel, RuPay UPI, and Zero Forex.",
      badges: [
        ["Study Verticals", "18 Tables"],
        ["Table Exports", "PNG + PDF"],
        ["Live Updates", "Card Data Synced"],
        ["Verified Links", `All ${cardCountDisplay} Cards`],
      ],
    },
  };

  const cfg = sectionMeta[type] || sectionMeta.home;

  const top3Cards = cards
    .slice()
    .sort((a, b) => b.overall_rating - a.overall_rating)
    .slice(0, 3);
  const top3Arts = await Promise.all(
    top3Cards.map((c) => loadCardArtDataUri(c.local_image_path))
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "40px 48px",
          background: "linear-gradient(135deg, #FAF9F6 0%, #EFECE1 100%)",
          color: "#1A1D21",
          fontFamily: "sans-serif",
        }}
      >
        <BrandHeaderPill label={cfg.pill} />

        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 14 }}>
            <span
              style={{
                fontSize: 44,
                fontWeight: 700,
                lineHeight: 1.12,
                letterSpacing: -1,
                color: "#1A1D21",
              }}
            >
              {cfg.headline}
            </span>
            <span style={{ fontSize: 20, lineHeight: 1.45, color: "#4B525C" }}>
              {cfg.sub}
            </span>
          </div>

          <div
            style={{
              width: 340,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {top3Cards.map((c, idx) => (
              <div
                key={c.card_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "#FFFFFF",
                  border: "1px solid #DFDDD3",
                  borderRadius: 14,
                  padding: "10px 14px",
                  boxShadow: "0 8px 20px rgba(26,29,33,0.06)",
                }}
              >
                {top3Arts[idx] ? (
                  <img
                    src={top3Arts[idx]!}
                    width={78}
                    height={50}
                    style={{ objectFit: "contain", borderRadius: 6 }}
                    alt=""
                  />
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <span style={{ fontSize: 12, color: "#68707C" }}>{c.bank}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1A1D21" }}>
                    {c.card_name}
                  </span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0F5C4D" }}>
                  {c.overall_rating.toFixed(1)}/5
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, width: "100%" }}>
          {cfg.badges.map(([lbl, val], i) => (
            <div
              key={lbl}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                background: i === 0 ? "#EEF5F2" : "#FFFFFF",
                border: i === 0 ? "1px solid #C5DFD6" : "1px solid #E4E4DF",
                borderRadius: 14,
                padding: "13px 16px",
              }}
            >
              <span style={{ fontSize: 13, color: "#68707C" }}>{lbl}</span>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: i === 0 ? "#0F5C4D" : "#1A1D21",
                }}
              >
                {val}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: OG_HEADERS }
  );
}
