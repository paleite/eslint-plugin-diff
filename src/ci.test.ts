const OLD_ENV = process.env;

beforeEach(() => {
  jest.resetModules(); // Most important - it clears the cache
  process.env = { ...OLD_ENV }; // Make a copy
});

describe("guessBranch", () => {
  it("ensure the branch is guessed if ESLINT_PLUGIN_COMMIT is not already set", async () => {
    delete process.env.ESLINT_PLUGIN_COMMIT;
    const { guessBranch } = await import("./ci");
    expect(() => guessBranch()).not.toThrowError(/ESLINT_PLUGIN_COMMIT/u);
  });

  it("ensure the branch is not guessed if ESLINT_PLUGIN_COMMIT is already set", async () => {
    process.env.ESLINT_PLUGIN_COMMIT = "origin/main";
    const { guessBranch } = await import("./ci");
    expect(() => guessBranch()).toThrowError(/ESLINT_PLUGIN_COMMIT/u);
  });

  it("fails when too many providers were found as candidates", async () => {
    process.env.SYSTEM_PULLREQUEST_TARGETBRANCH = "CORRECT";
    process.env.bamboo_repository_pr_targetBranch = "CORRECT";
    process.env.BITBUCKET_PR_DESTINATION_BRANCH = "CORRECT";
    process.env.BUDDY_EXECUTION_PULL_REQUEST_BASE_BRANCH = "CORRECT";
    process.env.DRONE_TARGET_BRANCH = "CORRECT";
    process.env.GITHUB_BASE_REF = "CORRECT";
    process.env.APPVEYOR_PULL_REQUEST_NUMBER = "0";
    process.env.APPVEYOR_REPO_BRANCH = "CORRECT";
    process.env.CI_EXTERNAL_PULL_REQUEST_TARGET_BRANCH_NAME = "CORRECT";
    process.env.TRAVIS_BRANCH = "CORRECT";
    const { guessBranch } = await import("./ci");
    expect(() => guessBranch()).toThrowError(/Too many CI providers found/u);
  });
});

describe("simple supported providers", () => {
  it("AzurePipelines", async () => {
    process.env.SYSTEM_PULLREQUEST_TARGETBRANCH = "CORRECT";
    const { guessBranch } = await import("./ci");
    expect(guessBranch()).toBe("CORRECT");
  });

  it("Bamboo", async () => {
    process.env.bamboo_repository_pr_targetBranch = "CORRECT";
    const { guessBranch } = await import("./ci");
    expect(guessBranch()).toBe("CORRECT");
  });

  it("BitbucketPipelines", async () => {
    process.env.BITBUCKET_PR_DESTINATION_BRANCH = "CORRECT";
    const { guessBranch } = await import("./ci");
    expect(guessBranch()).toBe("CORRECT");
  });

  it("Buddy", async () => {
    process.env.BUDDY_EXECUTION_PULL_REQUEST_BASE_BRANCH = "CORRECT";
    const { guessBranch } = await import("./ci");
    expect(guessBranch()).toBe("CORRECT");
  });

  it("Drone", async () => {
    process.env.DRONE_TARGET_BRANCH = "CORRECT";
    const { guessBranch } = await import("./ci");
    expect(guessBranch()).toBe("CORRECT");
  });

  it("GitHubActions", async () => {
    process.env.GITHUB_BASE_REF = "CORRECT";
    const { guessBranch } = await import("./ci");
    expect(guessBranch()).toBe("CORRECT");
  });
});

describe("complex supported providers", () => {
  it("AppVeyor", async () => {
    // APPVEYOR_PULL_REQUEST_NUMBER is non-empty, so we can find the repo in
    // APPVEYOR_REPO_BRANCH
    process.env.APPVEYOR_PULL_REQUEST_NUMBER = "0";
    process.env.APPVEYOR_REPO_BRANCH = "CORRECT";

    const { guessBranch } = await import("./ci");
    expect(guessBranch()).toBe("CORRECT");
  });

  it("doesn't return the guessed branch when APPVEYOR_PULL_REQUEST_NUMBER is empty", async () => {
    // APPVEYOR_PULL_REQUEST_NUMBER is non-empty iff we're in a pull-request.
    delete process.env.APPVEYOR_PULL_REQUEST_NUMBER;
    // Scenario: A regular commit to main, not a pull-request.
    process.env.APPVEYOR_REPO_BRANCH = "main";

    const { guessBranch } = await import("./ci");
    expect(guessBranch()).toBe(undefined);
  });

  it("GitLab with CI_EXTERNAL_PULL_REQUEST_TARGET_BRANCH_NAME", async () => {
    delete process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME;
    process.env.CI_EXTERNAL_PULL_REQUEST_TARGET_BRANCH_NAME = "CORRECT";
    const { guessBranch } = await import("./ci");
    expect(guessBranch()).toBe("CORRECT");
  });

  it("GitLab with CI_MERGE_REQUEST_TARGET_BRANCH_NAME", async () => {
    delete process.env.CI_EXTERNAL_PULL_REQUEST_TARGET_BRANCH_NAME;
    process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME = "CORRECT";
    const { guessBranch } = await import("./ci");
    expect(guessBranch()).toBe("CORRECT");
  });

  it("Travis", async () => {
    delete process.env.TRAVIS_PULL_REQUEST;
    process.env.TRAVIS_BRANCH = "CORRECT";
    const { guessBranch } = await import("./ci");
    expect(guessBranch()).toBe("CORRECT");
  });

  it("doesn't return the guessed branch when TRAVIS_PULL_REQUEST is explicitly 'false'", async () => {
    process.env.TRAVIS_PULL_REQUEST = "false";
    process.env.TRAVIS_BRANCH = "CORRECT";
    const { guessBranch } = await import("./ci");
    expect(guessBranch()).toBe(undefined);
  });
});

export {};
