import plugin, { composeProcessor, createProcessor } from "./index";

describe("v3 public API", () => {
  it("exports only processor factories at runtime", () => {
    expect(Object.keys(plugin).sort()).toEqual([
      "composeProcessor",
      "createProcessor",
    ]);
    expect(plugin.createProcessor).toBe(createProcessor);
    expect(plugin.composeProcessor).toBe(composeProcessor);
    expect("configs" in plugin).toBe(false);
    expect("processors" in plugin).toBe(false);
  });
});
