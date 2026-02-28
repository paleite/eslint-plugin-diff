const OLD_ENV = process.env;
const importIndex = async () => import("./index.js");

beforeEach(() => {
  jest.resetModules();
  process.env = { ...OLD_ENV };
  delete process.env["CI"];
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe("plugin without CI", () => {
  it("exposes a flat/ci config", async () => {
    jest.doMock("./processors", () => ({
      ci: {},
      ciConfig: {},
      composeProcessor: jest.fn(),
      diff: {},
      diffConfig: {},
      staged: {},
      stagedConfig: {},
    }));

    let importedIndexModule!: Awaited<ReturnType<typeof importIndex>>;
    await jest.isolateModulesAsync(async () => {
      importedIndexModule = await importIndex();
    });

    const { configs } = importedIndexModule;
    const [flatCiConfig] = configs["flat/ci"];
    expect(flatCiConfig?.processor).toBe("diff/ci");
    expect(flatCiConfig?.plugins.diff).toBeDefined();
  });
});

export {};
