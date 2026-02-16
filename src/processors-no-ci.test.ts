const OLD_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...OLD_ENV };
  delete process.env.CI;
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe("processors without CI", () => {
  it("exports empty CI processor and config", async () => {
    jest.doMock("./git", () => ({
      ...jest.requireActual<typeof import("./git")>("./git"),
      getDiffFileList: jest.fn(() => []),
      getUntrackedFileList: jest.fn(() => []),
      getDiffForFile: jest.fn(() => ""),
      hasCleanIndex: jest.fn(() => true),
    }));

    const { ci, ciConfig } = await import("./processors");

    expect(ci).toEqual({});
    expect(ciConfig).toEqual({});
  });
});
