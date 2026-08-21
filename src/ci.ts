type OfficialProvider = "github" | "gitlab" | "azure" | "bitbucket";
type LegacyProvider = "appveyor" | "bamboo" | "buddy" | "drone" | "travis";

type PullRequestContext = {
  provider: OfficialProvider | LegacyProvider;
  baseRef?: string | undefined;
  baseSha?: string | undefined;
  diffBaseSha?: string | undefined;
  headRef?: string | undefined;
  headSha?: string | undefined;
};

type Environment = NodeJS.ProcessEnv;

type Candidate = PullRequestContext & { signal: string };

const nonEmpty = (value: string | undefined): string | undefined =>
  value === undefined || value.length === 0 ? undefined : value;

const getOfficialCandidates = (env: Environment): Candidate[] => {
  const candidates: Candidate[] = [];

  const githubBase = nonEmpty(env["GITHUB_BASE_REF"]);
  if (githubBase !== undefined) {
    candidates.push({
      provider: "github",
      signal: "GITHUB_BASE_REF",
      baseRef: githubBase,
      headRef: nonEmpty(env["GITHUB_REF"]) ?? nonEmpty(env["GITHUB_HEAD_REF"]),
      headSha: nonEmpty(env["GITHUB_SHA"]),
    });
  }

  const gitlabBase =
    nonEmpty(env["CI_MERGE_REQUEST_TARGET_BRANCH_NAME"]) ??
    nonEmpty(env["CI_EXTERNAL_PULL_REQUEST_TARGET_BRANCH_NAME"]);
  const gitlabDiffBase = nonEmpty(env["CI_MERGE_REQUEST_DIFF_BASE_SHA"]);
  if (gitlabBase !== undefined || gitlabDiffBase !== undefined) {
    candidates.push({
      provider: "gitlab",
      signal:
        gitlabDiffBase !== undefined
          ? "CI_MERGE_REQUEST_DIFF_BASE_SHA"
          : "CI_MERGE_REQUEST_TARGET_BRANCH_NAME",
      baseRef: gitlabBase,
      diffBaseSha: gitlabDiffBase,
      headRef: nonEmpty(env["CI_COMMIT_REF_NAME"]),
      headSha: nonEmpty(env["CI_COMMIT_SHA"]),
    });
  }

  const azureBase = nonEmpty(env["SYSTEM_PULLREQUEST_TARGETBRANCH"]);
  if (azureBase !== undefined) {
    candidates.push({
      provider: "azure",
      signal: "SYSTEM_PULLREQUEST_TARGETBRANCH",
      baseRef: azureBase,
      headRef: nonEmpty(env["SYSTEM_PULLREQUEST_SOURCEBRANCH"]),
      headSha:
        nonEmpty(env["SYSTEM_PULLREQUEST_SOURCECOMMITID"]) ??
        nonEmpty(env["BUILD_SOURCEVERSION"]),
    });
  }

  const bitbucketBase = nonEmpty(env["BITBUCKET_PR_DESTINATION_BRANCH"]);
  if (bitbucketBase !== undefined) {
    candidates.push({
      provider: "bitbucket",
      signal: "BITBUCKET_PR_DESTINATION_BRANCH",
      baseRef: bitbucketBase,
      baseSha: nonEmpty(env["BITBUCKET_PR_DESTINATION_COMMIT"]),
      headRef: nonEmpty(env["BITBUCKET_BRANCH"]),
      headSha: nonEmpty(env["BITBUCKET_COMMIT"]),
    });
  }

  return candidates;
};

const getLegacyCandidates = (env: Environment): Candidate[] => {
  const candidates: Candidate[] = [];
  const add = (
    provider: LegacyProvider,
    signal: string,
    baseRef: string | undefined,
  ) => {
    if (baseRef !== undefined) {
      candidates.push({ provider, signal, baseRef });
    }
  };

  if (nonEmpty(env["APPVEYOR_PULL_REQUEST_NUMBER"]) !== undefined) {
    add(
      "appveyor",
      "APPVEYOR_REPO_BRANCH",
      nonEmpty(env["APPVEYOR_REPO_BRANCH"]),
    );
  }
  add(
    "bamboo",
    "bamboo_repository_pr_targetBranch",
    nonEmpty(env["bamboo_repository_pr_targetBranch"]),
  );
  add(
    "buddy",
    "BUDDY_EXECUTION_PULL_REQUEST_BASE_BRANCH",
    nonEmpty(env["BUDDY_EXECUTION_PULL_REQUEST_BASE_BRANCH"]),
  );
  add("drone", "DRONE_TARGET_BRANCH", nonEmpty(env["DRONE_TARGET_BRANCH"]));
  if (env["TRAVIS_PULL_REQUEST"] !== "false") {
    add("travis", "TRAVIS_BRANCH", nonEmpty(env["TRAVIS_BRANCH"]));
  }

  return candidates;
};

const resolveCiContext = (
  env: Environment = process.env,
): PullRequestContext | undefined => {
  const candidates = [
    ...getOfficialCandidates(env),
    ...getLegacyCandidates(env),
  ];

  if (candidates.length > 1) {
    throw new Error(
      `Too many CI providers found (${candidates
        .map(({ provider, signal }) => `${provider}:${signal}`)
        .join(
          ", ",
        )}). Set ESLINT_PLUGIN_DIFF_COMMIT to an exact comparison point.`,
    );
  }

  const candidate = candidates[0];
  if (candidate === undefined) {
    return undefined;
  }

  const { signal: _signal, ...context } = candidate;
  return context;
};

export type { PullRequestContext };
export { resolveCiContext };
