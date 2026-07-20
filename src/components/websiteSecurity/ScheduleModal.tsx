"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

const MODE_TABS = [
  { label: "Automatic", value: "default" as const, color: "#16a34a", description: "Runs automatically every day at 2:00 AM Nepal time. No setup needed — this is the default for every website." },
  { label: "Schedule", value: "custom" as const, color: "#d97706", description: "Set a custom frequency, time(s) of day, or a repeat-every-N-days cadence for this website." },
  { label: "Disabled", value: "disabled" as const, color: "#dc2626", description: "No automatic scans at all for this website — only manual “Scan now” will trigger a scan." },
];
const SCHEDULE_TYPE_OPTIONS = [
  { label: "Daily", value: "Daily" },
  { label: "Weekly", value: "Weekly" },
  { label: "Monthly", value: "Monthly" },
  { label: "Yearly", value: "Yearly" },
];
const DAY_OF_WEEK_OPTIONS = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
  { label: "Tuesday", value: "2" },
  { label: "Wednesday", value: "3" },
  { label: "Thursday", value: "4" },
  { label: "Friday", value: "5" },
  { label: "Saturday", value: "6" },
];
const MONTH_OPTIONS = [
  { label: "January", value: "1" }, { label: "February", value: "2" }, { label: "March", value: "3" },
  { label: "April", value: "4" }, { label: "May", value: "5" }, { label: "June", value: "6" },
  { label: "July", value: "7" }, { label: "August", value: "8" }, { label: "September", value: "9" },
  { label: "October", value: "10" }, { label: "November", value: "11" }, { label: "December", value: "12" },
];
const TIMES_PER_DAY_OPTIONS = [
  { label: "1 time a day", value: "1" },
  { label: "2 times a day", value: "2" },
  { label: "3 times a day", value: "3" },
  { label: "4 times a day", value: "4" },
];

interface ScheduleData {
  ScheduleType: string;
  TimesPerDay: number;
  ScanTimes: string;
  RepeatIntervalDays: number | null;
  DayOfWeek: number | null;
  DayOfMonth: number | null;
  MonthOfYear: number | null;
  LastRunAt: string | null;
}

export function ScheduleModal({ websiteId, websiteName, onClose }: { websiteId: number; websiteName: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCustomSchedule, setHasCustomSchedule] = useState(false);
  const [mode, setMode] = useState<"default" | "custom" | "disabled">("default");
  const [scheduleType, setScheduleType] = useState("Daily");
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [scanTimes, setScanTimes] = useState<string[]>(["02:00"]);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatIntervalDays, setRepeatIntervalDays] = useState(2);
  const [dayOfWeek, setDayOfWeek] = useState("0");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [monthOfYear, setMonthOfYear] = useState("1");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/admin/website-security/schedule/${websiteId}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.ok && data.schedule) {
          const s: ScheduleData = data.schedule;
          setHasCustomSchedule(true);
          if (s.ScheduleType === "Disabled") {
            setMode("disabled");
          } else {
            setMode("custom");
            setScheduleType(s.ScheduleType);
            setTimesPerDay(s.TimesPerDay);
            const times = s.ScanTimes.split(",").map((t) => t.trim()).filter(Boolean);
            setScanTimes(times.length > 0 ? times : ["02:00"]);
            setRepeatEnabled(s.RepeatIntervalDays != null);
            if (s.RepeatIntervalDays != null) setRepeatIntervalDays(s.RepeatIntervalDays);
            if (s.DayOfWeek != null) setDayOfWeek(String(s.DayOfWeek));
            if (s.DayOfMonth != null) setDayOfMonth(s.DayOfMonth);
            if (s.MonthOfYear != null) setMonthOfYear(String(s.MonthOfYear));
          }
        }
      } catch {
        setError("Failed to load current schedule.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [websiteId]);

  function setTimesPerDayAndResize(n: number) {
    setTimesPerDay(n);
    setScanTimes((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push("02:00");
      return next;
    });
  }

  function updateTime(index: number, value: string) {
    setScanTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (mode === "default") {
        if (hasCustomSchedule) {
          const res = await fetch(`/api/admin/website-security/schedule/${websiteId}/reset`, { method: "POST" });
          const data = await res.json();
          if (!data.ok) throw new Error(data.error ?? "Failed to reset schedule");
        }
        onClose();
        return;
      }

      const res = await fetch(`/api/admin/website-security/schedule/${websiteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          mode === "disabled"
            ? JSON.stringify({ scheduleType: "Disabled", timesPerDay: 1, scanTimes: ["00:00"] })
            : JSON.stringify({
                scheduleType,
                timesPerDay,
                scanTimes,
                repeatIntervalDays: repeatEnabled ? repeatIntervalDays : null,
                dayOfWeek: scheduleType === "Weekly" ? Number(dayOfWeek) : undefined,
                dayOfMonth: scheduleType === "Monthly" || scheduleType === "Yearly" ? dayOfMonth : undefined,
                monthOfYear: scheduleType === "Yearly" ? Number(monthOfYear) : undefined,
              }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to save schedule");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetToDefault() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/website-security/schedule/${websiteId}/reset`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to reset schedule");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset schedule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Scan Schedule — ${websiteName}`}
      footer={
        <>
          {hasCustomSchedule && (
            <Button variant="ghost" onClick={handleResetToDefault} disabled={saving}>
              Reset to default
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save schedule"}
          </Button>
        </>
      }
    >
      {loading ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              {MODE_TABS.map((tab) => {
                const active = mode === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setMode(tab.value)}
                    className="flex items-center gap-2"
                    style={{
                      padding: "0.55rem 0.9rem",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: active ? 700 : 500,
                      color: active ? tab.color : "var(--ink-muted)",
                      borderBottom: active ? `2px solid ${tab.color}` : "2px solid transparent",
                      marginBottom: -1,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: tab.color, flexShrink: 0 }} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)", margin: 0 }}>
            {MODE_TABS.find((t) => t.value === mode)?.description}
          </p>

          {mode === "custom" && (
          <>
          <div>
            <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" }}>Frequency</label>
            <Select value={scheduleType} onChange={setScheduleType} options={SCHEDULE_TYPE_OPTIONS} />
          </div>

          {scheduleType === "Weekly" && (
            <div>
              <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" }}>Day of week</label>
              <Select value={dayOfWeek} onChange={setDayOfWeek} options={DAY_OF_WEEK_OPTIONS} />
            </div>
          )}

          {(scheduleType === "Monthly" || scheduleType === "Yearly") && (
            <div className="grid gap-3" style={{ gridTemplateColumns: scheduleType === "Yearly" ? "1fr 1fr" : "1fr" }}>
              <div>
                <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" }}>Day of month</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                  style={{ width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" }}
                />
              </div>
              {scheduleType === "Yearly" && (
                <div>
                  <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" }}>Month</label>
                  <Select value={monthOfYear} onChange={setMonthOfYear} options={MONTH_OPTIONS} />
                </div>
              )}
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" }}>How many times a day</label>
            <Select value={String(timesPerDay)} onChange={(v) => setTimesPerDayAndResize(Number(v))} options={TIMES_PER_DAY_OPTIONS} />
          </div>

          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
            {scanTimes.map((t, i) => (
              <div key={i}>
                <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" }}>
                  {timesPerDay > 1 ? `Time ${i + 1}` : "Time"}
                </label>
                <input
                  type="time"
                  value={t}
                  onChange={(e) => updateTime(i, e.target.value)}
                  style={{ width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" }}
                />
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <label className="flex items-center gap-2" style={{ fontSize: "0.85rem", color: "var(--ink)", marginBottom: repeatEnabled ? "0.6rem" : 0 }}>
              <input type="checkbox" checked={repeatEnabled} onChange={(e) => setRepeatEnabled(e.target.checked)} />
              Repeat every N days instead (overrides the frequency above)
            </label>
            {repeatEnabled && (
              <div style={{ maxWidth: 200 }}>
                <Select
                  value={String(repeatIntervalDays)}
                  onChange={(v) => setRepeatIntervalDays(Number(v))}
                  options={[2, 3, 4, 5, 6, 7, 10, 14, 30].map((n) => ({ label: `Every ${n} days`, value: String(n) }))}
                />
              </div>
            )}
          </div>
          </>
          )}

          {error && <div className="error">{error}</div>}
        </div>
      )}
    </Modal>
  );
}
