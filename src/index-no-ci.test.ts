const OLD_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...OLD_ENV };
  delete process.env.CI;
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe("plugin without CI", () => {
  it("exposes a flat/ci config", async () => {
    jest.doMock("./processors", () => ({
      ci: {},
      ciConfig: {},
      diff: {},
      diffConfig: {},
      staged: {},
      stagedConfig: {},
    }));

    let importedIndexModule!: typeof import("./index");
    await jest.isolateModulesAsync(async () => {
      importedIndexModule = await import("./index");
    });

    const { configs } = importedIndexModule;
    const [flatCiConfig] = configs["flat/ci"];
    expect(flatCiConfig?.processor).toBe("diff/ci");
    expect(flatCiConfig?.plugins.diff).toBeDefined();
  });
});

export {};
