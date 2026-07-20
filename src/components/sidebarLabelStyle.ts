import type { CSSProperties } from "react";

// Shared fade+shrink transition for sidebar labels/chevrons — always rendered, never
// unmounted, so opacity and width animate smoothly instead of popping in/out abruptly.
export function labelStyle(collapsed: boolean, extra?: CSSProperties): CSSProperties {
  return {
    opacity: collapsed ? 0 : 1,
    maxWidth: collapsed ? 0 : 220,
    overflow: "hidden",
    whiteSpace: "nowrap",
    transition: "opacity 200ms ease, max-width 250ms ease",
    ...extra,
  };
}
