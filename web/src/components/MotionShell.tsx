"use client";

import React from "react";
import { MotionConfig } from "motion/react";
import { CompareProvider } from "./CompareContext";
import { CompareTray } from "./CompareTray";
import { NavigationProgress } from "./NavigationProgress";

export function MotionShell({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <CompareProvider>
        <NavigationProgress />
        {children}
        <CompareTray />
      </CompareProvider>
    </MotionConfig>
  );
}
