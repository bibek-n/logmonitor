import NepaliDate from "nepali-date-converter";

export const BS_MONTHS_NP = [
  "बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
  "कार्तिक", "मंसिर", "पुष", "माघ", "फागुन", "चैत",
];

export const BS_MONTHS_EN = [
  "Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

export const WEEKDAYS_NP = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"];
export const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEV_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

export function toDevanagariDigits(n: number): string {
  return String(n)
    .split("")
    .map((c) => (c >= "0" && c <= "9" ? DEV_DIGITS[Number(c)] : c))
    .join("");
}

export interface BsDate {
  year: number;
  month: number; // 0-indexed
  day: number;
  weekday: number; // 0=Sun..6=Sat
}

export function adToBs(date: Date): BsDate {
  const nd = new NepaliDate(date);
  return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate(), weekday: nd.getDay() };
}

function daysInBsMonth(bsYear: number, bsMonth: number): number {
  const first = new NepaliDate(bsYear, bsMonth, 1).toJsDate();
  const nextMonth = bsMonth === 11 ? 0 : bsMonth + 1;
  const nextYear = bsMonth === 11 ? bsYear + 1 : bsYear;
  const firstNext = new NepaliDate(nextYear, nextMonth, 1).toJsDate();
  return Math.round((firstNext.getTime() - first.getTime()) / 86400000);
}

export interface BsCalendarCell {
  bsDay: number;
  adDate: Date | null;
  isToday: boolean;
  isCurrentMonth: boolean;
}

export interface BsMonthGrid {
  bsYear: number;
  bsMonth: number;
  weeks: BsCalendarCell[][];
  daysInMonth: number;
}

export function buildBsMonthGrid(bsYear: number, bsMonth: number, todayBs: BsDate): BsMonthGrid {
  const daysInMonth = daysInBsMonth(bsYear, bsMonth);
  const firstWeekday = new NepaliDate(bsYear, bsMonth, 1).getDay();

  const cells: BsCalendarCell[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ bsDay: 0, adDate: null, isToday: false, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      bsDay: d,
      adDate: new NepaliDate(bsYear, bsMonth, d).toJsDate(),
      isToday: bsYear === todayBs.year && bsMonth === todayBs.month && d === todayBs.day,
      isCurrentMonth: true,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ bsDay: 0, adDate: null, isToday: false, isCurrentMonth: false });
  }

  const weeks: BsCalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { bsYear, bsMonth, weeks, daysInMonth };
}
