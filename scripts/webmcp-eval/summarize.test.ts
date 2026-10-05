import { describe, expect, test } from "bun:test";
import { iqr, median } from "./summarize";

describe("median", () => {
  test("computes the median of an odd-length fixture", () => {
    // Arrange
    const xs = [3, 1, 2];
    // Act
    const m = median(xs);
    // Assert
    expect(m).toBe(2);
  });

  test("computes the midpoint median for an even-length fixture", () => {
    // Arrange
    const xs = [1, 2, 3, 4];
    // Act
    const m = median(xs);
    // Assert
    expect(m).toBe(2.5);
  });
});

describe("iqr", () => {
  test("returns first and third quartiles of a fixture array", () => {
    // Arrange
    const xs = [1, 2, 3, 4, 5];
    // Act
    const [q1, q3] = iqr(xs);
    // Assert
    expect(q1).toBe(2);
    expect(q3).toBe(4);
  });

  test("handles a single-value cell", () => {
    // Arrange
    const xs = [7];
    // Act
    const m = median(xs);
    const [q1, q3] = iqr(xs);
    // Assert
    expect(m).toBe(7);
    expect(q1).toBe(7);
    expect(q3).toBe(7);
  });
});
