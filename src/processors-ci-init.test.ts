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
  delete process.env["SYSTEM_PULLREQUEST_TARGETBRANCH"];
  delete process.env["bamboo_repository_pr_targetBranch"];
  delete process.env["BITBUCKET_PR_DESTINATION_BRANCH"];
  delete process.env["BUDDY_EXECUTION_PULL_REQUEST_BASE_BRANCH"];
  delete process.env["DRONE_TARGET_BRANCH"];
  delete process.env["GITHUB_BASE_REF"];
  delete process.env["APPVEYOR_PULL_REQUEST_NUMBER"];
  delete process.env["APPVEYOR_REPO_BRANCH"];
  delete process.env["CI_EXTERNAL_PULL_REQUEST_TARGET_BRANCH_NAME"];
  delete process.env["CI_MERGE_REQUEST_TARGET_BRANCH_NAME"];
  delete process.env["TRAVIS_PULL_REQUEST"];
  delete process.env["TRAVIS_BRANCH"];
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe("CI initialization", () => {
  it("does not fetch on import and fetches on first processor invocation", async () => {
    process.env["CI"] = "true";
    process.env["GITHUB_BASE_REF"] = "main";

    const gitMocked: jest.MockedObjectDeep<typeof git> = jest.mocked(
      await importGit(),
    );
    const { ci } = await importProcessors();

    expect(gitMocked.fetchFromOrigin).not.toHaveBeenCalled();
    ci.preprocess("/** Some source code */", "file.ts");

    expect(gitMocked.fetchFromOrigin).toHaveBeenCalledWith("main");
    expect(process.env["ESLINT_PLUGIN_DIFF_COMMIT"]).toBe("origin/main");

    ci.postprocess([], "file.ts");
    expect(gitMocked.fetchFromOrigin).toHaveBeenCalledTimes(1);
  });

  it("normalizes refs/heads/* guessed branches to origin/*", async () => {
    process.env["CI"] = "true";
    process.env["SYSTEM_PULLREQUEST_TARGETBRANCH"] = "refs/heads/main";

    const gitMocked: jest.MockedObjectDeep<typeof git> = jest.mocked(
      await importGit(),
    );
    const { ci } = await importProcessors();
    ci.preprocess("/** Some source code */", "file.ts");

    expect(gitMocked.fetchFromOrigin).toHaveBeenCalledWith("main");
    expect(process.env["ESLINT_PLUGIN_DIFF_COMMIT"]).toBe("origin/main");
  });

  it("preserves provided commit and skips origin fetch", async () => {
    process.env["CI"] = "true";
    process.env["GITHUB_BASE_REF"] = "main";
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] = "abc123";

    const gitMocked: jest.MockedObjectDeep<typeof git> = jest.mocked(
      await importGit(),
    );
    const { ci } = await importProcessors();
    ci.preprocess("/** Some source code */", "file.ts");

    expect(gitMocked.fetchFromOrigin).not.toHaveBeenCalled();
    expect(process.env["ESLINT_PLUGIN_DIFF_COMMIT"]).toBe("abc123");
  });
});
