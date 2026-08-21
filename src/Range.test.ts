import { Range } from "./Range";

describe("range", () => {
  it("should instantiate with correct parameters", () => {
    const range: Range = new Range(0, 1);
    expect(range).toBeInstanceOf(Range);
  });

  it("should include lower bound and exclude upper bound", () => {
    const range: Range = new Range(3, 6);

    expect(range.isWithinRange(3)).toBe(true);
    expect(range.isWithinRange(4)).toBe(true);
    expect(range.isWithinRange(5)).toBe(true);
    expect(range.isWithinRange(6)).toBe(false);
    expect(range.isWithinRange(2)).toBe(false);
  });

  it("should detect interval intersection", () => {
    const range: Range = new Range(3, 6);

    expect(range.intersects(1, 3)).toBe(false);
    expect(range.intersects(2, 4)).toBe(true);
    expect(range.intersects(5, 7)).toBe(true);
    expect(range.intersects(6, 8)).toBe(false);
  });

  it("should throw TypeError when parameters are flipped", () => {
    expect(() => new Range(1, 0)).toThrowErrorMatchingSnapshot();
  });

  it("should throw TypeError when parameters are equal", () => {
    expect(() => new Range(1, 1)).toThrow(TypeError);
  });
});
