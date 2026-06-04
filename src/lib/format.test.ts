import { describe, expect, it } from "vitest";
import { formatRub, formatPercent, discountPercent } from "./format";

describe("format helpers", () => {
  it("formats rubles for integers", () => {
    expect(formatRub(1500).replace(/\u00A0/g, " ")).toBe("1 500 ₽");
  });

  it("formats rubles with cents", () => {
    expect(formatRub(1234.5).replace(/\u00A0/g, " ")).toMatch(/^1 234,5(?:0)? ₽$/);
  });

  it("returns dash for invalid values", () => {
    expect(formatRub(null)).toBe("—");
    expect(formatRub(undefined)).toBe("—");
    expect(formatRub("not-a-number")).toBe("—");
  });

  it("formats percent values with minus sign", () => {
    expect(formatPercent(12.4)).toBe("−12%");
  });

  it("calculates discount percent for valid old and new prices", () => {
    expect(discountPercent(200, 150)).toBeCloseTo(25);
  });

  it("returns null when old price is missing or no discount exists", () => {
    expect(discountPercent(null, 150)).toBeNull();
    expect(discountPercent(100, 100)).toBeNull();
    expect(discountPercent(80, 100)).toBeNull();
  });
});
