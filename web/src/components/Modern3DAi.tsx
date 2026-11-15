"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";

/**
 * Ambient AI sparkle particles canvas adapted for warm editorial CardLedger surfaces.
 */
export function SparklesField({
  density = 28,
  color = "#0F5C4D",
  secondaryColor = "#9A5B13",
  className = "",
}: {
  density?: number;
  color?: string;
  secondaryColor?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let width = (canvas.width = canvas.parentElement?.offsetWidth || 640);
    let height = (canvas.height = canvas.parentElement?.offsetHeight || 240);

    const onResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.offsetWidth;
      height = canvas.height = canvas.parentElement.offsetHeight;
    };
    window.addEventListener("resize", onResize);

    const count = Math.max(12, Math.min(48, Math.floor((width * height) / 14000 * (density / 24))));
    const particles = Array.from({ length: count }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.9 + Math.random() * 1.7,
      vy: (Math.random() - 0.5) * 0.25,
      vx: (Math.random() - 0.5) * 0.14,
      alpha: 0.15 + Math.random() * 0.45,
      dAlpha: (Math.random() - 0.5) * 0.012,
      col: idx % 4 === 0 ? secondaryColor : color,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.alpha += p.dAlpha;
        if (p.alpha <= 0.1 || p.alpha >= 0.65) p.dAlpha = -p.dAlpha;
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        ctx.fillStyle = p.col;
        ctx.globalAlpha = Math.max(0.08, Math.min(0.65, p.alpha));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      rafId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, [density, color, secondaryColor]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}

/**
 * Soft radial diagonal spotlight beam (inspired by Aceternity/Cogify Spotlight).
 */
export function SpotlightBeam({ className = "" }: { className?: string }) {
  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 0.9, scale: 1 }}
      transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      className={`pointer-events-none absolute inset-x-0 -top-28 h-[320px] flex justify-center overflow-hidden ${className}`}
    >
      <div
        className="w-[720px] h-[280px] rounded-full blur-3xl opacity-55"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(15,92,77,0.16) 0%, rgba(16,185,129,0.08) 40%, rgba(250,249,246,0) 75%)",
        }}
      />
    </motion.div>
  );
}

/**
 * 3D Volumetric AI Neural Orb with rotating orbital rings & specular glass core.
 */
export function AiOrb3D({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const px = size === "sm" ? 28 : size === "lg" ? 56 : 40;
  return (
    <div
      className={`relative shrink-0 inline-flex items-center justify-center select-none ${className}`}
      style={{ width: px, height: px, perspective: "480px" }}
      aria-hidden="true"
    >
      {/* Ambient pulsing glow halo */}
      <motion.span
        animate={{ scale: [0.94, 1.12, 0.94], opacity: [0.38, 0.68, 0.38] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-full blur-[6px]"
        style={{
          background:
            "radial-gradient(circle, rgba(16,185,129,0.5) 0%, rgba(15,92,77,0.22) 60%, transparent 100%)",
        }}
      />

      {/* Primary 3D orbital ring */}
      <span
        className="animate-ledger-orbit absolute inset-0 rounded-full border border-[#0F5C4D]/45"
        style={{ transformStyle: "preserve-3d" }}
      >
        <span className="absolute -top-[2.5px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
      </span>

      {/* Counter-rotating 3D ring */}
      <span
        className="animate-ledger-orbit-rev absolute inset-[2px] rounded-full border border-[#9A5B13]/35"
        style={{ transformStyle: "preserve-3d" }}
      >
        <span className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-[4px] h-[4px] rounded-full bg-[#D97706]" />
      </span>

      {/* 3D Iridescent glass sphere core */}
      <span
        className="animate-ledger-float-3d relative rounded-full shadow-[inset_0_-3px_6px_rgba(7,46,38,0.45),0_4px_12px_rgba(15,92,77,0.28)]"
        style={{
          width: Math.round(px * 0.56),
          height: Math.round(px * 0.56),
          background:
            "radial-gradient(circle at 32% 28%, #E6FFF5 0%, #34D399 28%, #0F5C4D 68%, #09352C 100%)",
        }}
      >
        <span
          className="absolute top-[16%] left-[20%] w-[32%] h-[22%] rounded-full bg-white/75 blur-[0.4px]"
          style={{ transform: "rotate(-28deg)" }}
        />
      </span>
    </div>
  );
}

/**
 * Traveling SVG luminous border highlight around AI actions / featured pills (Cogify pattern).
 */
export function MovingBorderPill({
  children,
  duration = 3200,
  borderRadius = "999px",
  className = "",
}: {
  children: React.ReactNode;
  duration?: number;
  borderRadius?: string;
  className?: string;
}) {
  const pathRef = useRef<SVGRectElement>(null);
  const progress = useMotionValue<number>(0);

  useAnimationFrame((time) => {
    const length = pathRef.current?.getTotalLength();
    if (length) {
      progress.set(((time / duration) * length) % length);
    }
  });

  const x = useTransform(progress, (v) => pathRef.current?.getPointAtLength(v)?.x ?? 0);
  const y = useTransform(progress, (v) => pathRef.current?.getPointAtLength(v)?.y ?? 0);
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  return (
    <div
      className={`relative inline-flex p-[1.5px] overflow-hidden ${className}`}
      style={{ borderRadius }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ borderRadius }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          width="100%"
          height="100%"
        >
          <rect ref={pathRef} fill="none" width="100%" height="100%" rx="24" ry="24" />
        </svg>
        <motion.div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform,
          }}
        >
          <div
            className="h-14 w-14 opacity-90"
            style={{
              background:
                "radial-gradient(#10B981 30%, rgba(15,92,77,0.45) 55%, transparent 75%)",
            }}
          />
        </motion.div>
      </div>
      <div
        className="relative z-10 w-full h-full flex items-center"
        style={{ borderRadius: `calc(${borderRadius} - 1px)` }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Interactive 3D perspective card tilt with cursor-tracked specular sheen.
 */
export function Card3DTilt({
  children,
  maxTilt = 10,
  className = "",
  glare = true,
}: {
  children: React.ReactNode;
  maxTilt?: number;
  className?: string;
  glare?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const [hovered, setHovered] = useState(false);

  const rotateX = useSpring(rawX, { stiffness: 260, damping: 22, mass: 0.65 });
  const rotateY = useSpring(rawY, { stiffness: 260, damping: 22, mass: 0.65 });
  const gx = useSpring(glareX, { stiffness: 220, damping: 25 });
  const gy = useSpring(glareY, { stiffness: 220, damping: 25 });
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.10) 38%, transparent 72%)`;

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rawY.set((px - 0.5) * maxTilt * 2);
    rawX.set(-(py - 0.5) * maxTilt * 2);
    glareX.set(px * 100);
    glareY.set(py * 100);
  };

  const reset = () => {
    setHovered(false);
    rawX.set(0);
    rawY.set(0);
    glareX.set(50);
    glareY.set(50);
  };

  return (
    <div style={{ perspective: "1050px" }} className={className}>
      <motion.div
        ref={boxRef}
        onMouseEnter={() => setHovered(true)}
        onMouseMove={handleMove}
        onMouseLeave={reset}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative w-full h-full will-change-transform"
      >
        {children}
        {glare && (
          <motion.div
            aria-hidden="true"
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute inset-0 rounded-[inherit] z-20"
            style={{ background: glareBackground }}
          />
        )}
      </motion.div>
    </div>
  );
}
