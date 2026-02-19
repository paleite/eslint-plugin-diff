jest.mock("./git", () => ({
  ...jest.requireActual<typeof git>("./git"),
  fetchFromOrigin: jest.fn(),
  getDiffFileList: jest.fn().mockReturnValue([]),
  getDiffForFile: jest.fn().mockReturnValue(""),
  getUntrackedFileList: jest.fn().mockReturnValue([]),
  hasCleanIndex: jest.fn().mockReturnValue(true),
}));

import type * as git from "./git";
const importGit = async (): Promise<typeof import("./git.js")> =>
  import("./git.js");
const importProcessors = async (): Promise<typeof import("./processors.js")> =>
  import("./processors.js");

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

    await importProcessors();

    const gitMocked: jest.MockedObjectDeep<typeof git> = jest.mocked(
      await importGit(),
    );
    expect(gitMocked.fetchFromOrigin).toHaveBeenCalledWith("main");
    expect(process.env["ESLINT_PLUGIN_DIFF_COMMIT"]).toBe("main");
  });

  it("preserves provided commit and skips origin fetch", async () => {
    process.env["CI"] = "true";
    process.env["GITHUB_BASE_REF"] = "main";
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] = "abc123";

    await importProcessors();

    const gitMocked: jest.MockedObjectDeep<typeof git> = jest.mocked(
      await importGit(),
    );
    expect(gitMocked.fetchFromOrigin).not.toHaveBeenCalled();
    expect(process.env["ESLINT_PLUGIN_DIFF_COMMIT"]).toBe("abc123");
  });
});
