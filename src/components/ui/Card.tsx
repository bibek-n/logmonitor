"use client";

import { HTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hoverLift?: boolean;
  glass?: boolean;
}

// Shared glassmorphism surface used across the redesigned Overview page. `hoverLift` adds
// the Framer Motion lift-on-hover used by KPI cards; static panels (charts, tables) pass
// hoverLift={false} since a table shouldn't visually "jump" on mouseover.
export function Card({ children, className, hoverLift = false, glass = true, style, ...rest }: CardProps) {
  const content = (
    <div
      className={cn("rounded-2xl border p-5", className)}
      style={{
        background: glass ? "color-mix(in srgb, var(--surface) 88%, transparent)" : "var(--surface)",
        borderColor: "var(--border)",
        backdropFilter: glass ? "blur(10px)" : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );

  if (!hoverLift) return content;

  return (
    <motion.div whileHover={{ y: -3, boxShadow: "0 12px 28px rgba(0,0,0,0.25)" }} transition={{ duration: 0.15 }}>
      {content}
    </motion.div>
  );
}
