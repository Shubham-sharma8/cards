import { NextRequest, NextResponse } from "next/server";
import { getCardDossierAsync, getCardsByIdsAsync } from "@/lib/data";
import { isValidSlug, sanitizeCardIdList } from "@/lib/security";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  if (idsParam !== null) {
    if (idsParam.length > 500) {
      return NextResponse.json({ error: "Too many card identifiers" }, { status: 400 });
    }
    const ids = sanitizeCardIdList(idsParam, 3);
    const cards = await getCardsByIdsAsync(ids);
    return NextResponse.json(
      { cards },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
          "X-Robots-Tag": "noindex, nofollow",
        },
      }
    );
  }

  const bank = searchParams.get("bank")?.trim() ?? "";
  const card = searchParams.get("card")?.trim() ?? "";
  if (!isValidSlug(bank) || !isValidSlug(card)) {
    return NextResponse.json({ error: "Invalid bank or card parameter" }, { status: 400 });
  }

  const dossier = await getCardDossierAsync(bank, card);
  if (!dossier) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  return NextResponse.json(dossier, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
