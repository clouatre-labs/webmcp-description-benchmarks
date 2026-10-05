import { describe, expect, test } from "bun:test";
import {
  bootstrapMedianDiffCI,
  compositeScore,
  mannWhitneyExact,
  mulberry32,
  parseChecks,
} from "./compare";

describe("parseChecks", () => {
  test("parses true/false pairs from a rubric detail string", () => {
    // Arrange
    const detail = "claim quoted verbatim: true; used page traversal: false";
    // Act
    const checks = parseChecks(detail);
    // Assert
    expect(checks).toEqual([true, false]);
  });

  test("returns empty list for detail without check pairs", () => {
    // Arrange
    const detail = "not run";
    // Act
    const checks = parseChecks(detail);
    // Assert
    expect(checks).toEqual([]);
  });
});

describe("compositeScore", () => {
  test("computes fraction of true checks", () => {
    // Arrange
    const detail = "claim quoted verbatim: true; used page traversal: false";
    // Act
    const score = compositeScore(detail);
    // Assert
    expect(score).toBe(0.5);
  });

  test("excludes 'not run' as null", () => {
    // Arrange
    const detail = "not run";
    // Act
    const score = compositeScore(detail);
    // Assert
    expect(score).toBeNull();
  });
});

describe("mannWhitneyExact", () => {
  test("matches hand-computed p-value on a tiny known input", () => {
    // Arrange: x = [1,2,3,4,5], y = [6,7,8,9,10]; perfect separation.
    // U for x = 0; under H0, P(U <= 0) = 1/252, two-sided p = 2/252.
    const x = [1, 2, 3, 4, 5];
    const y = [6, 7, 8, 9, 10];
    // Act
    const res = mannWhitneyExact(x, y);
    // Assert
    expect(res.u).toBe(0);
    expect(res.p).toBeCloseTo(2 / 252, 12);
  });

  test("gives p = 1 for identical samples", () => {
    // Arrange
    const x = [1, 2, 3];
    const y = [1, 2, 3];
    // Act
    const res = mannWhitneyExact(x, y);
    // Assert
    expect(res.p).toBe(1);
  });
});

describe("rank-biserial r", () => {
  test("perfect separation gives |r| = 1", () => {
    // Arrange
    const x = [1, 2, 3, 4, 5];
    const y = [6, 7, 8, 9, 10];
    // Act
    const res = mannWhitneyExact(x, y);
    // Assert
    expect(Math.abs(res.r)).toBe(1);
  });

  test("interleaved samples give |r| < 1", () => {
    // Arrange
    const x = [1, 3, 5, 7, 9];
    const y = [2, 4, 6, 8, 10];
    // Act
    const res = mannWhitneyExact(x, y);
    // Assert
    expect(Math.abs(res.r)).toBeLessThan(1);
  });
});

describe("mulberry32", () => {
  test("is deterministic for a fixed seed", () => {
    // Act
    const a = mulberry32(42)();
    const b = mulberry32(42)();
    // Assert
    expect(a).toBe(b);
  });

  test("produces values in [0, 1)", () => {
    // Arrange
    const rng = mulberry32(42);
    // Act
    const vals = Array.from({ length: 100 }, () => rng());
    // Assert
    expect(vals.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe("bootstrapMedianDiffCI", () => {
  test("is deterministic and brackets the observed median difference", () => {
    // Arrange
    const x = [10, 12, 14, 16, 18];
    const y = [1, 2, 3, 4, 5];
    // Act
    const ci1 = bootstrapMedianDiffCI(x, y);
    const ci2 = bootstrapMedianDiffCI(x, y);
    // Assert
    expect(ci1).toEqual(ci2);
    expect(ci1[0]).toBeLessThanOrEqual(13);
    expect(ci1[1]).toBeGreaterThanOrEqual(13);
  });

  test("CI covers zero when samples are identical", () => {
    // Arrange
    const x = [5, 5, 5, 5, 5];
    // Act
    const ci = bootstrapMedianDiffCI(x, [...x]);
    // Assert
    expect(ci[0]).toBe(0);
    expect(ci[1]).toBe(0);
  });
});
