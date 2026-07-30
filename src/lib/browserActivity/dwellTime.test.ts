import { describe, it, expect } from "vitest";
import { computeDwellSeconds } from "./dwellTime";

function visit(iso: string) {
  return { visitedAt: new Date(iso) };
}

describe("computeDwellSeconds", () => {
  it("returns an empty array for no visits", () => {
    expect(computeDwellSeconds([])).toEqual([]);
  });

  it("returns null for a single visit — no next timestamp to bound it", () => {
    expect(computeDwellSeconds([visit("2026-01-01T10:00:00Z")])).toEqual([null]);
  });

  it("computes the delta to the next chronological visit, in input order", () => {
    const visits = [visit("2026-01-01T10:00:00Z"), visit("2026-01-01T10:05:00Z"), visit("2026-01-01T10:07:00Z")];
    expect(computeDwellSeconds(visits)).toEqual([300, 120, null]);
  });

  it("sorts internally before computing, even if input order is out of order", () => {
    const visits = [visit("2026-01-01T10:07:00Z"), visit("2026-01-01T10:00:00Z"), visit("2026-01-01T10:05:00Z")];
    // index 0 (10:07) is most recent -> null; index 1 (10:00) -> 300s to 10:05; index 2 (10:05) -> 120s to 10:07
    expect(computeDwellSeconds(visits)).toEqual([null, 300, 120]);
  });

  it("caps a large gap at the configured cap rather than reporting it verbatim", () => {
    const visits = [visit("2026-01-01T10:00:00Z"), visit("2026-01-01T22:00:00Z")];
    expect(computeDwellSeconds(visits, 1800)).toEqual([1800, null]);
  });

  it("never returns a negative dwell even if two visits share the same timestamp", () => {
    const visits = [visit("2026-01-01T10:00:00Z"), visit("2026-01-01T10:00:00Z")];
    const result = computeDwellSeconds(visits);
    expect(result[0]).toBe(0);
    expect(result[1]).toBeNull();
  });
});
