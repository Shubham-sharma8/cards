import React from "react";
import { safeJsonLd } from "@/lib/security";

export function JsonLd({ data }: { data: unknown }) {
  const normalized = Array.isArray(data)
    ? { "@context": "https://schema.org", "@graph": data }
    : data && typeof data === "object" && !("@context" in data)
      ? { "@context": "https://schema.org", ...data }
      : data;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(normalized) }}
    />
  );
}
