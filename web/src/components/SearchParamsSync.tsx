"use client";

import { Suspense, useEffect } from "react";
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation";

function InnerSearchParamsSync({
  onParams,
}: {
  onParams: (sp: ReadonlyURLSearchParams) => void;
}) {
  const sp = useSearchParams();

  useEffect(() => {
    onParams(sp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  return null;
}

/**
 * Isolates `useSearchParams()` inside a tiny null-fallback Suspense boundary so parent
 * pages statically pre-render their full SSR HTML (H1, content, links) instead of bailing out.
 */
export function SearchParamsSync({
  onParams,
}: {
  onParams: (sp: ReadonlyURLSearchParams) => void;
}) {
  return (
    <Suspense fallback={null}>
      <InnerSearchParamsSync onParams={onParams} />
    </Suspense>
  );
}
