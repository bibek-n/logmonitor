"use client";

// Pure SVG, no dependency — hand rotations are plain CSS transforms driven by the current
// time, recomputed every render (the parent already ticks a `now` state every second).
export default function AnalogClock({ date, size = 34 }: { date: Date; size?: number }) {
  const seconds = date.getSeconds();
  const minutes = date.getMinutes();
  const hours = date.getHours() % 12;

  const secondDeg = seconds * 6;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = hours * 30 + minutes * 0.5;

  return (
    <svg width={size} height={size} viewBox="0 0 34 34" style={{ flexShrink: 0 }} aria-label="Analog clock">
      <circle cx="17" cy="17" r="16" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="1" />
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const major = i % 3 === 0;
        const x1 = 17 + 12.5 * Math.sin(angle);
        const y1 = 17 - 12.5 * Math.cos(angle);
        const x2 = 17 + (major ? 14.5 : 15) * Math.sin(angle);
        const y2 = 17 - (major ? 14.5 : 15) * Math.cos(angle);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-muted)" strokeWidth={major ? 1.3 : 0.6} strokeLinecap="round" />;
      })}
      <line x1="17" y1="17" x2="17" y2="9.5" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" transform={`rotate(${hourDeg} 17 17)`} />
      <line x1="17" y1="17" x2="17" y2="6.5" stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" transform={`rotate(${minuteDeg} 17 17)`} />
      <line x1="17" y1="17" x2="17" y2="4.5" stroke="var(--primary)" strokeWidth="0.8" strokeLinecap="round" transform={`rotate(${secondDeg} 17 17)`} />
      <circle cx="17" cy="17" r="1.3" fill="var(--primary)" />
    </svg>
  );
}
