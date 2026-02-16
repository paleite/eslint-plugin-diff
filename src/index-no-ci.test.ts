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
  it("exposes a flat/ci config", () => {
    jest.doMock("./processors", () => ({
      ci: {},
      ciConfig: {},
      diff: {},
      diffConfig: {},
      staged: {},
      stagedConfig: {},
    }));

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { configs } = require("./index");
      expect(configs["flat/ci"]).toEqual([
        { plugins: { diff: expect.any(Object) }, processor: "diff/ci" },
      ]);
    });
  });
});

export {};
