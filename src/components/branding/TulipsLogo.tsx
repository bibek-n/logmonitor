import type { CSSProperties } from "react";

// The real Tulips Technologies company logo (public/branding/tulips-technologies-logo.png,
// 738x210, opaque WHITE background baked into the file - not transparent). On the marketing
// site's own fixed light palette it drops in directly; everywhere else (dashboard sidebar,
// login screen) surfaces are theme-dependent and often dark, so `padded` wraps it in a white
// rounded box so the logo's white background always reads as intentional instead of a broken
// image box. TulipsMark (the flat SVG shield/tulip icon) is still used standalone for
// compact/icon-only contexts - the collapsed sidebar rail, the favicon - where this wide
// wordmark lockup wouldn't fit.
export function TulipsLogo({
  height = 32,
  padded = false,
  style,
}: {
  height?: number;
  padded?: boolean;
  style?: CSSProperties;
}) {
  const img = (
    <img
      src="/branding/tulips-technologies-logo.png"
      alt="Tulips Technologies"
      style={{ height, width: "auto", display: "block", ...style }}
    />
  );

  if (!padded) return img;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "#fff",
        borderRadius: 8,
        padding: "0.4rem 0.65rem",
      }}
    >
      {img}
    </span>
  );
}
