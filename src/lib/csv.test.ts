import { describe, it, expect } from "vitest";
import { parseCsv, rowsToCsv, csvRowsToRecords } from "./csv";

describe("parseCsv", () => {
  it("parses a simple comma-separated file", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("handles quoted fields containing commas", () => {
    expect(parseCsv('Title,Notes\n"Login, then logout",ok\n')).toEqual([
      ["Title", "Notes"],
      ["Login, then logout", "ok"],
    ]);
  });

  it("handles doubled-quote escaping inside a quoted field", () => {
    expect(parseCsv('Field\n"He said ""hi"""\n')).toEqual([["Field"], ['He said "hi"']]);
  });

  it("handles embedded newlines inside a quoted field", () => {
    expect(parseCsv('Steps\n"Step 1\nStep 2"\n')).toEqual([["Steps"], ["Step 1\nStep 2"]]);
  });

  it("strips \\r from CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("ignores a trailing blank line", () => {
    expect(parseCsv("a,b\n1,2\n\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("rowsToCsv", () => {
  it("joins headers and rows with CRLF", () => {
    expect(rowsToCsv(["A", "B"], [[1, "x"], [2, "y"]])).toBe("A,B\r\n1,x\r\n2,y");
  });

  it("quotes values containing commas, quotes, or newlines", () => {
    const csv = rowsToCsv(["Title"], [["has, comma"], ['has "quote"'], ["has\nnewline"]]);
    expect(csv).toBe('Title\r\n"has, comma"\r\n"has ""quote"""\r\n"has\nnewline"');
  });

  it("renders null/undefined as an empty field", () => {
    expect(rowsToCsv(["A"], [[null], [undefined]])).toBe("A\r\n\r\n");
  });

  it("round-trips through parseCsv", () => {
    const original = [["Plain", "with, comma", 'with "quote"', "with\nnewline"]];
    const csv = rowsToCsv(["H1", "H2", "H3", "H4"], original);
    const [, dataRow] = parseCsv(csv);
    expect(dataRow).toEqual(original[0]);
  });
});

describe("csvRowsToRecords", () => {
  it("maps rows to header-keyed objects", () => {
    const rows = [["Title", "Priority"], ["Login works", "High"], ["Logout works", "Low"]];
    expect(csvRowsToRecords(rows)).toEqual([
      { Title: "Login works", Priority: "High" },
      { Title: "Logout works", Priority: "Low" },
    ]);
  });

  it("strips a byte-order-mark from the first header", () => {
    const rows = [["﻿Title", "Priority"], ["Case A", "Medium"]];
    expect(csvRowsToRecords(rows)[0]).toEqual({ Title: "Case A", Priority: "Medium" });
  });

  it("trims whitespace in header and cell values", () => {
    const rows = [[" Title ", " Priority "], [" Case A ", " High "]];
    expect(csvRowsToRecords(rows)[0]).toEqual({ Title: "Case A", Priority: "High" });
  });

  it("fills missing trailing cells with an empty string", () => {
    const rows = [["Title", "Priority", "Severity"], ["Case A"]];
    expect(csvRowsToRecords(rows)[0]).toEqual({ Title: "Case A", Priority: "", Severity: "" });
  });

  it("returns an empty array when there is no header row", () => {
    expect(csvRowsToRecords([])).toEqual([]);
  });
});
