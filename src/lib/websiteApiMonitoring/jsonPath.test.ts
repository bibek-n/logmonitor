import { describe, it, expect } from "vitest";
import { resolveJsonPath } from "./jsonPath";

describe("resolveJsonPath", () => {
  const data = { status: "ok", data: { items: [{ id: 1, name: "first" }, { id: 2, name: "second" }], count: 2 }, flags: { active: true } };

  it("resolves a simple top-level key", () => {
    expect(resolveJsonPath(data, "status")).toBe("ok");
  });

  it("resolves a nested dot path", () => {
    expect(resolveJsonPath(data, "data.count")).toBe(2);
  });

  it("strips a leading $. prefix", () => {
    expect(resolveJsonPath(data, "$.data.count")).toBe(2);
  });

  it("resolves a bracketed array index", () => {
    expect(resolveJsonPath(data, "data.items[0].id")).toBe(1);
    expect(resolveJsonPath(data, "data.items[1].name")).toBe("second");
  });

  it("resolves a quoted bracket key", () => {
    expect(resolveJsonPath(data, "flags['active']")).toBe(true);
  });

  it("returns undefined for a missing path", () => {
    expect(resolveJsonPath(data, "data.items[5].id")).toBeUndefined();
    expect(resolveJsonPath(data, "nope.nested")).toBeUndefined();
  });

  it("returns the whole document for an empty/root path", () => {
    expect(resolveJsonPath(data, "$")).toBe(data);
    expect(resolveJsonPath(data, "")).toBe(data);
  });
});
