"use client";

import React, { useRef, useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "motion/react";
import { cardLocalImageUrl } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/mediaCdn";
import type { CardTheme } from "@/lib/types";

interface Interactive3DCardModelProps {
  localImagePath?: string | null;
  cardName: string;
  bank: string;
  network?: string;
  tier?: string;
  annualFeeLabel?: string;
  loungeLabel?: string;
  rewardHighlight?: string;
  cardTheme?: CardTheme | null;
  compact?: boolean;
  className?: string;
}

/**
 * Tactile 3D Perspective Credit Card Showcase:
 * Smooth pointer-driven 3D tilt, metallic depth rim, and specular sheen on card front artwork.
 */
export function Interactive3DCardModel({
  localImagePath,
  cardName,
  bank,
  cardTheme,
  compact = false,
  className = "",
}: Interactive3DCardModelProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const dragOriginRef = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  const src = resolveMediaUrl(cardLocalImageUrl(localImagePath));
  const rawRx = useMotionValue(3);
  const rawRy = useMotionValue(-5);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(35);

  const springRx = useSpring(rawRx, { stiffness: 210, damping: 24, mass: 0.6 });
  const springRy = useSpring(rawRy, { stiffness: 210, damping: 24, mass: 0.6 });

  const glareBg = useMotionTemplate`radial-gradient(280px circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.38), rgba(15,92,77,0.06) 45%, rgba(255,255,255,0) 72%)`;

  const primaryHex = cardTheme?.primary_hex || "#0F5C4D";
  const softBg = cardTheme?.soft_bg_hex || "#EEF5F2";
  const borderHex = cardTheme?.border_hex || "#C9D8D2";

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    dragOriginRef.current = {
      x: e.clientX,
      y: e.clientY,
      rx: rawRx.get(),
      ry: rawRy.get(),
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
    const py = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
    glareX.set(Math.max(5, Math.min(95, px)));
    glareY.set(Math.max(5, Math.min(95, py)));

    if (dragging && dragOriginRef.current) {
      const dx = e.clientX - dragOriginRef.current.x;
      const dy = e.clientY - dragOriginRef.current.y;
      const nextRy = Math.max(-28, Math.min(28, dragOriginRef.current.ry + dx * 0.25));
      const nextRx = Math.max(-20, Math.min(20, dragOriginRef.current.rx - dy * 0.2));
      rawRy.set(nextRy);
      rawRx.set(nextRx);
    } else {
      const normX = (e.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
      const normY = (e.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
      rawRy.set(normX * 18);
      rawRx.set(-normY * 14);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    dragOriginRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div className={`flex flex-col items-center w-full ${compact ? "max-w-[300px]" : "max-w-[336px]"} ${className}`}>
      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          if (!dragging) {
            rawRx.set(3);
            rawRy.set(-5);
            glareX.set(50);
            glareY.set(35);
          }
        }}
        className="relative w-full aspect-[1.586/1] select-none touch-none cursor-grab active:cursor-grabbing"
        style={{ perspective: 1200 }}
        aria-label={`${cardName} card artwork`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-3.5 inset-x-6 h-5 rounded-full blur-lg opacity-28"
          style={{ backgroundColor: primaryHex }}
        />

        <motion.div
          style={{
            rotateX: springRx,
            rotateY: springRy,
            transformStyle: "preserve-3d",
          }}
          className="relative w-full h-full"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              transform: "translateZ(-4px)",
              background: `linear-gradient(135deg, ${primaryHex}55, #C9C9C2 55%, ${primaryHex}44)`,
              border: `1px solid ${borderHex}`,
            }}
          />

          <div
            className="absolute inset-0 rounded-2xl overflow-hidden shadow-[0_18px_36px_rgba(26,29,33,0.16)] flex items-center justify-center"
            style={{
              backgroundColor: softBg,
              border: `1px solid ${borderHex}`,
              transform: "translateZ(2px)",
            }}
          >
            {src && !imgFailed ? (
              <img
                src={src}
                alt={`${cardName} front view`}
                draggable={false}
                onError={() => setImgFailed(true)}
                className="w-full h-full object-contain p-1.5"
              />
            ) : (
              <div className="w-full h-full p-4 flex flex-col justify-between text-[#1A1D21]">
                <span className="text-[11px] uppercase tracking-wider text-[#4B525C]">{bank}</span>
                <span className="text-[14px] font-medium">{cardName}</span>
              </div>
            )}

            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 mix-blend-soft-light"
              style={{ background: glareBg }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
