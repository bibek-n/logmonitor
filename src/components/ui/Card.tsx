"use client";

import { HTMLAttributes, ReactNode, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hoverLift?: boolean;
  glass?: boolean;
  tilt3d?: boolean;
}

// Shared glassmorphism surface used across the redesigned Overview page. `hoverLift` adds
// the Framer Motion lift-on-hover used by KPI cards; static panels (charts, tables) pass
// hoverLift={false} since a table shouldn't visually "jump" on mouseover. `tilt3d` layers a
// mouse-tracking 3D perspective tilt on top of that (card leans toward the cursor) - opt-in
// per card, not on by default, since a data table full of rows tilting would be distracting.
// The cursor-glow overlay is plain CSS custom properties set via a ref in the pointer handler
// (not a second framer-motion value combination) - deliberately the simplest mechanism that
// gets the effect, after an earlier attempt using framer-motion's multi-value useTransform
// shipped with a bug that crashed the page; this version has a much smaller failure surface.
export function Card({ children, className, hoverLift = false, glass = true, tilt3d = false, style, ...rest }: CardProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const rotateX = useSpring(rawRotateX, { stiffness: 220, damping: 22 });
  const rotateY = useSpring(rawRotateY, { stiffness: 220, damping: 22 });

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!tilt3d || reduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height;
    const maxTilt = 6; // degrees - subtle, not a gimmick
    rawRotateY.set((px - 0.5) * maxTilt * 2);
    rawRotateX.set((0.5 - py) * maxTilt * 2);
    overlayRef.current?.style.setProperty("--glow-x", `${px * 100}%`);
    overlayRef.current?.style.setProperty("--glow-y", `${py * 100}%`);
  }

  function handlePointerLeave() {
    rawRotateX.set(0);
    rawRotateY.set(0);
    overlayRef.current?.style.setProperty("--glow-x", "50%");
    overlayRef.current?.style.setProperty("--glow-y", "50%");
  }

  const content = (
    <div
      className={cn("rounded-2xl border p-5", className)}
      style={{
        background: glass ? "color-mix(in srgb, var(--surface) 88%, transparent)" : "var(--surface)",
        // var(--border) alone is only ~8% opaque on the light theme - nearly invisible against
        // a near-white page background, which is why the first version of this elevation
        // effect didn't actually read as "3D" there even though the shadow was technically
        // rendering (confirmed live: visible on zoom, invisible at a glance). A stronger,
        // theme-independent border color on top of the shadow fixes that for every theme, not
        // just the dark ones var(--border) happens to already contrast well against.
        borderColor: tilt3d || hoverLift ? "color-mix(in srgb, var(--ink) 14%, var(--border))" : "var(--border)",
        backdropFilter: glass ? "blur(10px)" : undefined,
        position: "relative",
        overflow: tilt3d ? "hidden" : undefined,
        // A resting elevation shadow so the "3D" look reads immediately on page load, not only
        // once the cursor happens to hover a card. Noticeably stronger than a typical subtle
        // card shadow - the first attempt at this (rgba 0.35/0.18) was confirmed live to be
        // too faint to notice at a glance, especially on the light theme's near-white surface.
        // Pure black, not a theme-tinted navy - the dark "midnight" theme's own background
        // (#090d1a) is itself a near-black navy, so a shadow color anywhere close to it would
        // blend straight into the page there and disappear, the same invisibility problem this
        // whole fix exists to solve. Pure black at high opacity keeps real contrast against
        // every theme's surface color, light or dark.
        boxShadow: tilt3d || hoverLift ? "0 24px 48px -12px rgba(0, 0, 0, 0.5), 0 8px 20px -6px rgba(0, 0, 0, 0.35)" : undefined,
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
        ...style,
      }}
      {...rest}
    >
      {tilt3d && !reduceMotion && (
        <div
          ref={overlayRef}
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            borderRadius: "inherit",
            background: "radial-gradient(circle at var(--glow-x, 50%) var(--glow-y, 50%), color-mix(in srgb, var(--primary) 16%, transparent), transparent 60%)",
          }}
        />
      )}
      {children}
    </div>
  );

  if (!hoverLift && !tilt3d) return content;

  return (
    <motion.div
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      whileHover={hoverLift ? { y: -5 } : undefined}
      transition={{ duration: 0.15 }}
      style={tilt3d && !reduceMotion ? { rotateX, rotateY, transformPerspective: 800 } : undefined}
    >
      {content}
    </motion.div>
  );
}
