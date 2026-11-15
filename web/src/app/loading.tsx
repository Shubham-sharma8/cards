import React from "react";
import { GreenCirclesLoader } from "@/components/GreenCirclesLoader";

export default function GlobalLoading() {
  return <GreenCirclesLoader fullScreen label="Calculating card benefits & reward caps…" size="lg" />;
}
