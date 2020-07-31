import * as index from "./index";

describe("plugin", () => {
  it("should match expected export", () => {
    expect(index).toMatchSnapshot();
  });
});
