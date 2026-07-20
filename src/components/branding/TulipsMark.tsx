import type { CSSProperties } from "react";

// The Tulips Unified Admin Center mark: a single silhouette that reads as both a shield
// (security posture) and an abstracted tulip bud (brand origin), rather than two
// shapes stitched together. `detailed` etches a small monitored-network node
// cluster + rack-unit bars into it (large sizes only - see the brand identity
// artifact); the default simplified form is a solid badge + one status node, which
// is what stays legible at sidebar/favicon sizes.
const SHIELD_PATH =
  "M50,14 C55,14 60,18 61,27 C62,32 70,22 85,36 C92,43 88,54 74,62 C68,72 58,82 50,90 C42,82 32,72 26,62 C12,54 8,43 15,36 C30,22 38,32 39,27 C40,18 45,14 50,14 Z";

export function TulipsMark({
  size = 24,
  detailed = false,
  className,
  style,
}: {
  size?: number;
  detailed?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <path d={SHIELD_PATH} fill="#00C2FF" />
      {detailed && (
        <g stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={1.6} strokeLinecap="round">
          <line x1={38} y1={40} x2={50} y2={52} />
          <line x1={58} y1={36} x2={50} y2={52} />
          <line x1={50} y1={52} x2={66} y2={48} />
        </g>
      )}
      {detailed && (
        <>
          <circle cx={38} cy={40} r={2.6} fill="#FFFFFF" />
          <circle cx={58} cy={36} r={2.6} fill="#FFFFFF" />
          <circle cx={66} cy={48} r={2.6} fill="#FFFFFF" />
        </>
      )}
      <circle cx={50} cy={52} r={detailed ? 4 : 6} fill="#A3E635" />
    </svg>
  );
}
