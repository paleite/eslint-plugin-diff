jest.mock("./git", () => ({
  ...jest.requireActual<typeof git>("./git"),
  fetchFromOrigin: jest.fn(),
  getDiffFileList: jest.fn().mockReturnValue([]),
  getDiffForFile: jest.fn().mockReturnValue(""),
  getUntrackedFileList: jest.fn().mockReturnValue([]),
  hasCleanIndex: jest.fn().mockReturnValue(true),
}));

import type * as git from "./git";

const OLD_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  process.env = { ...OLD_ENV };

  delete process.env["ESLINT_PLUGIN_DIFF_COMMIT"];
  delete process.env["GITHUB_BASE_REF"];
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe("CI initialization", () => {
  it("uses guessed branch and fetches from origin when commit is not provided", async () => {
    process.env["CI"] = "true";
    process.env["GITHUB_BASE_REF"] = "main";

    await import("./processors");

    const gitMocked: jest.MockedObjectDeep<typeof git> = jest.mocked(
      await import("./git"),
    );
    expect(gitMocked.fetchFromOrigin).toHaveBeenCalledWith("main");
    expect(process.env["ESLINT_PLUGIN_DIFF_COMMIT"]).toBe("main");
  });

  it("preserves provided commit and skips origin fetch", async () => {
    process.env["CI"] = "true";
    process.env["GITHUB_BASE_REF"] = "main";
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] = "abc123";

    await import("./processors");

    const gitMocked: jest.MockedObjectDeep<typeof git> = jest.mocked(
      await import("./git"),
    );
    expect(gitMocked.fetchFromOrigin).not.toHaveBeenCalled();
    expect(process.env["ESLINT_PLUGIN_DIFF_COMMIT"]).toBe("abc123");
  });
});
