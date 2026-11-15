"use client";

import React from "react";
import { MotionConfig } from "motion/react";
import { CompareProvider } from "./CompareContext";
import { CompareTray } from "./CompareTray";
import { NavigationProgress } from "./NavigationProgress";
import { ExpandableCardProvider } from "./ui/expandable-card";

export function MotionShell({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <CompareProvider>
        <ExpandableCardProvider>
          <NavigationProgress />
          {children}
          <CompareTray />
        </ExpandableCardProvider>
      </CompareProvider>
    </MotionConfig>
  );
}
