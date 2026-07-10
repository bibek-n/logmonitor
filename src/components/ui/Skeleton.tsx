interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function Skeleton({ width = "100%", height = 16, className }: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius: 6,
        background: "linear-gradient(90deg, var(--surface-2) 25%, var(--border) 37%, var(--surface-2) 63%)",
        backgroundSize: "400% 100%",
        animation: "settings-skeleton-shimmer 1.4s ease infinite",
      }}
    />
  );
}
