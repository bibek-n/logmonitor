"use client";

import { useEffect, useState, useCallback, CSSProperties } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MKT } from "@/lib/marketingTheme";

export interface SlideData {
  id: number;
  title: string | null;
  subtitle: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  imagePath: string;
}

const AUTOPLAY_MS = 6000;

function arrowStyle(side: "left" | "right"): CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    [side]: 16,
    transform: "translateY(-50%)",
    background: "rgba(15,23,42,0.45)",
    border: "none",
    borderRadius: "50%",
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    cursor: "pointer",
  };
}

export function Slider({ slides }: { slides: SlideData[] }) {
  const [index, setIndex] = useState(0);

  const next = useCallback(() => setIndex((i) => (i + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(next, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [next, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl h-64 sm:h-80 md:h-[420px] lg:h-[480px]">
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          style={{
            position: "absolute",
            inset: 0,
            opacity: i === index ? 1 : 0,
            transition: "opacity 0.6s ease",
            backgroundImage: `linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.55)), url(${slide.imagePath})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "2rem",
            color: "#fff",
            pointerEvents: i === index ? "auto" : "none",
          }}
        >
          {slide.title && (
            <h2 style={{ fontSize: "1.8rem", fontWeight: 700, maxWidth: 600, marginBottom: "0.6rem" }}>{slide.title}</h2>
          )}
          {slide.subtitle && (
            <p style={{ fontSize: "1rem", maxWidth: 540, marginBottom: "1.1rem", color: "#E2E8F0" }}>{slide.subtitle}</p>
          )}
          {slide.buttonText && slide.buttonUrl && (
            <Link
              href={slide.buttonUrl}
              style={{ background: MKT.primary, color: "#fff", padding: "0.6rem 1.3rem", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}
            >
              {slide.buttonText}
            </Link>
          )}
        </div>
      ))}

      {slides.length > 1 && (
        <>
          <button onClick={prev} aria-label="Previous slide" style={arrowStyle("left")}>
            <ChevronLeft size={22} />
          </button>
          <button onClick={next} aria-label="Next slide" style={arrowStyle("right")}>
            <ChevronRight size={22} />
          </button>
          <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 8 }}>
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  background: i === index ? "#fff" : "rgba(255,255,255,0.45)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
