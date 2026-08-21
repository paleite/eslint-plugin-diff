import { resolveCiContext } from "./ci";

const cleanEnv = (): NodeJS.ProcessEnv => ({});

describe("resolveCiContext", () => {
  it("uses process.env when no environment object is provided", () => {
    const previous = process.env;
    process.env = { GITHUB_BASE_REF: "main" };
    try {
      expect(resolveCiContext()).toEqual({
        provider: "github",
        baseRef: "main",
      });
    } finally {
      process.env = previous;
    }
  });

  it("returns undefined outside pull-request context", () => {
    expect(resolveCiContext(cleanEnv())).toBeUndefined();
  });

  it("resolves GitHub Actions", () => {
    expect(
      resolveCiContext({
        GITHUB_BASE_REF: "main",
        GITHUB_HEAD_REF: "feature",
        GITHUB_REF: "refs/pull/12/merge",
        GITHUB_SHA: "abc123",
      }),
    ).toEqual({
      provider: "github",
      baseRef: "main",
      headRef: "refs/pull/12/merge",
      headSha: "abc123",
    });
  });

  it("falls back to GITHUB_HEAD_REF when GITHUB_REF is unavailable", () => {
    expect(
      resolveCiContext({
        GITHUB_BASE_REF: "main",
        GITHUB_HEAD_REF: "feature",
      }),
    ).toEqual({
      provider: "github",
      baseRef: "main",
      headRef: "feature",
    });
  });

  it("resolves GitLab and keeps exact diff base", () => {
    expect(
      resolveCiContext({
        CI_MERGE_REQUEST_TARGET_BRANCH_NAME: "main",
        CI_MERGE_REQUEST_DIFF_BASE_SHA: "abc123",
        CI_COMMIT_REF_NAME: "feature",
        CI_COMMIT_SHA: "def456",
      }),
    ).toEqual({
      provider: "gitlab",
      baseRef: "main",
      diffBaseSha: "abc123",
      headRef: "feature",
      headSha: "def456",
    });
  });

  it("resolves external GitLab pull requests", () => {
    expect(
      resolveCiContext({
        CI_EXTERNAL_PULL_REQUEST_TARGET_BRANCH_NAME: "main",
      }),
    ).toEqual({ provider: "gitlab", baseRef: "main" });
  });

  it("resolves Azure Pipelines", () => {
    expect(
      resolveCiContext({
        SYSTEM_PULLREQUEST_TARGETBRANCH: "refs/heads/main",
        SYSTEM_PULLREQUEST_SOURCEBRANCH: "refs/heads/feature",
        SYSTEM_PULLREQUEST_SOURCECOMMITID: "abc123",
      }),
    ).toEqual({
      provider: "azure",
      baseRef: "refs/heads/main",
      headRef: "refs/heads/feature",
      headSha: "abc123",
    });
  });

  it("resolves Bitbucket Pipelines without treating destination commit as diff base", () => {
    expect(
      resolveCiContext({
        BITBUCKET_PR_DESTINATION_BRANCH: "main",
        BITBUCKET_PR_DESTINATION_COMMIT: "base-tip",
        BITBUCKET_BRANCH: "feature",
        BITBUCKET_COMMIT: "head",
      }),
    ).toEqual({
      provider: "bitbucket",
      baseRef: "main",
      baseSha: "base-tip",
      headRef: "feature",
      headSha: "head",
    });
  });

  it("preserves supported legacy provider detection", () => {
    expect(
      resolveCiContext({ bamboo_repository_pr_targetBranch: "main" }),
    ).toEqual({ provider: "bamboo", baseRef: "main" });
  });

  it("throws when multiple provider families are detected", () => {
    expect(() =>
      resolveCiContext({
        GITHUB_BASE_REF: "main",
        BITBUCKET_PR_DESTINATION_BRANCH: "main",
      }),
    ).toThrow(/Too many CI providers/u);
  });
  it.each([
    [
      "appveyor",
      { APPVEYOR_PULL_REQUEST_NUMBER: "1", APPVEYOR_REPO_BRANCH: "main" },
    ],
    ["bamboo", { bamboo_repository_pr_targetBranch: "main" }],
    ["buddy", { BUDDY_EXECUTION_PULL_REQUEST_BASE_BRANCH: "main" }],
    ["drone", { DRONE_TARGET_BRANCH: "main" }],
    ["travis", { TRAVIS_PULL_REQUEST: "123", TRAVIS_BRANCH: "main" }],
  ] as const)("resolves legacy %s context", (provider, env) => {
    expect(resolveCiContext(env)).toEqual({ provider, baseRef: "main" });
  });

  it("ignores AppVeyor branch outside a pull request", () => {
    expect(
      resolveCiContext({
        APPVEYOR_PULL_REQUEST_NUMBER: "",
        APPVEYOR_REPO_BRANCH: "main",
      }),
    ).toBeUndefined();
  });

  it("ignores Travis branch when the pull-request flag is false", () => {
    expect(
      resolveCiContext({ TRAVIS_PULL_REQUEST: "false", TRAVIS_BRANCH: "main" }),
    ).toBeUndefined();
  });

  it("uses Azure build source version when the PR source commit is unavailable", () => {
    expect(
      resolveCiContext({
        SYSTEM_PULLREQUEST_TARGETBRANCH: "refs/heads/main",
        BUILD_SOURCEVERSION: "fallback-head",
      }),
    ).toEqual({
      provider: "azure",
      baseRef: "refs/heads/main",
      headSha: "fallback-head",
    });
  });

  it("accepts GitLab exact diff base without a target branch", () => {
    expect(
      resolveCiContext({ CI_MERGE_REQUEST_DIFF_BASE_SHA: "exact-base" }),
    ).toEqual({ provider: "gitlab", diffBaseSha: "exact-base" });
  });
});
