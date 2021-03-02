import { Range } from "./Range";

describe("range", () => {
  it("should instantiate with correct parameters", () => {
    const range: Range = new Range(0, 1);
    expect(range).toBeInstanceOf(Range);
  });

  it("should throw TypeError when parameters are flipped", () => {
    expect(() => new Range(1, 0)).toThrowErrorMatchingSnapshot();
  });
});
