"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  adToBs,
  buildBsMonthGrid,
  toDevanagariDigits,
  BS_MONTHS_NP,
  BS_MONTHS_EN,
  WEEKDAYS_NP,
} from "@/lib/bsCalendar";

const KATHMANDU_TZ = "Asia/Kathmandu";

const navBtnStyle: CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--surface)",
  borderRadius: 6,
  padding: "0.25rem 0.4rem",
  cursor: "pointer",
  color: "var(--ink)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export function NepaliCalendarCard() {
  const [now, setNow] = useState<Date | null>(null);
  const [viewYear, setViewYear] = useState<number | null>(null);
  const [viewMonth, setViewMonth] = useState<number | null>(null);

  useEffect(() => {
    const d = new Date();
    setNow(d);
    const bs = adToBs(d);
    setViewYear(bs.year);
    setViewMonth(bs.month);
  }, []);

  if (!now || viewYear === null || viewMonth === null) {
    return (
      <Card>
        <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Loading calendar…</div>
      </Card>
    );
  }

  const todayBs = adToBs(now);
  const grid = buildBsMonthGrid(viewYear, viewMonth, todayBs);
  const isViewingCurrentMonth = viewYear === todayBs.year && viewMonth === todayBs.month;

  function goPrev() {
    if (viewMonth === 0) {
      setViewYear((y) => (y ?? 0) - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => (m ?? 0) - 1);
    }
  }

  function goNext() {
    if (viewMonth === 11) {
      setViewYear((y) => (y ?? 0) + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => (m ?? 0) + 1);
    }
  }

  function goToday() {
    setViewYear(todayBs.year);
    setViewMonth(todayBs.month);
  }

  return (
    <Card>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.75rem" }}>
        <div>
          <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--ink)" }}>
            {toDevanagariDigits(todayBs.day)} {BS_MONTHS_NP[todayBs.month]} {toDevanagariDigits(todayBs.year)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
            {now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: KATHMANDU_TZ })}
          </div>
        </div>
        <CalendarDays size={18} style={{ color: "var(--ink-muted)" }} />
      </div>

      <div className="flex items-center justify-between" style={{ marginBottom: "0.5rem" }}>
        <button type="button" onClick={goPrev} aria-label="Previous month" style={navBtnStyle}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)" }}>
            {BS_MONTHS_NP[viewMonth]} {toDevanagariDigits(viewYear)}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--ink-muted)" }}>
            {BS_MONTHS_EN[viewMonth]} {viewYear}
          </div>
        </div>
        <button type="button" onClick={goNext} aria-label="Next month" style={navBtnStyle}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7" style={{ marginBottom: "0.15rem" }}>
        {WEEKDAYS_NP.map((wd, i) => (
          <div
            key={wd}
            style={{
              textAlign: "center",
              fontSize: "0.65rem",
              color: i === 6 ? "var(--danger)" : "var(--ink-muted)",
              padding: "0.15rem 0",
            }}
          >
            {wd}
          </div>
        ))}
      </div>

      {grid.weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((cell, ci) => (
            <div
              key={ci}
              style={{
                textAlign: "center",
                padding: "0.3rem 0.1rem",
                borderRadius: 6,
                background: cell.isToday ? "var(--primary)" : "transparent",
                visibility: cell.isCurrentMonth ? "visible" : "hidden",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: cell.isToday ? 700 : 500,
                  color: cell.isToday ? "#fff" : ci === 6 ? "var(--danger)" : "var(--ink)",
                  lineHeight: 1.2,
                }}
              >
                {toDevanagariDigits(cell.bsDay)}
              </div>
              <div
                style={{
                  fontSize: "0.6rem",
                  color: cell.isToday ? "rgba(255,255,255,0.85)" : "var(--ink-muted)",
                  lineHeight: 1.2,
                }}
              >
                {cell.adDate?.toLocaleDateString("en-US", { day: "numeric", timeZone: KATHMANDU_TZ }) ?? ""}
              </div>
            </div>
          ))}
        </div>
      ))}

      {!isViewingCurrentMonth && (
        <button
          type="button"
          onClick={goToday}
          style={{ ...navBtnStyle, width: "100%", marginTop: "0.6rem", fontSize: "0.75rem", padding: "0.35rem 0" }}
        >
          Today / आज
        </button>
      )}
    </Card>
  );
}
