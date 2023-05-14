import { log } from "./logging";

type CiProviderCommon<T extends CiProviderName> = { name: T };

type CiProvider<T extends CiProviderName = CiProviderName> =
  CiProviderCommon<T> &
    (
      | { isSupported: false }
      | { isSupported: true; diffBranch: string | undefined }
    );

const PROVIDERS = {
  AppVeyor: {
    name: "AppVeyor",
    isSupported: true,
    diffBranch:
      (process.env.APPVEYOR_PULL_REQUEST_NUMBER ?? "") !== ""
        ? "APPVEYOR_REPO_BRANCH"
        : undefined,
  },
  AzurePipelines: {
    name: "AzurePipelines",
    isSupported: true,
    diffBranch: "SYSTEM_PULLREQUEST_TARGETBRANCH",
  },
  Bamboo: {
    name: "Bamboo",
    isSupported: true,
    diffBranch: "bamboo_repository_pr_targetBranch",
  },
  BitbucketPipelines: {
    name: "BitbucketPipelines",
    isSupported: true,
    diffBranch: "BITBUCKET_PR_DESTINATION_BRANCH",
  },
  Buddy: {
    name: "Buddy",
    isSupported: true,
    diffBranch: "BUDDY_EXECUTION_PULL_REQUEST_BASE_BRANCH",
  },
  Drone: {
    name: "Drone",
    isSupported: true,
    diffBranch: "DRONE_TARGET_BRANCH",
  },
  GitHubActions: {
    name: "GitHubActions",
    isSupported: true,
    diffBranch: "GITHUB_BASE_REF",
  },
  GitLab: {
    name: "GitLab",
    isSupported: true,
    diffBranch:
      (process.env.CI_EXTERNAL_PULL_REQUEST_TARGET_BRANCH_NAME ?? "") !== ""
        ? "CI_EXTERNAL_PULL_REQUEST_TARGET_BRANCH_NAME"
        : "CI_MERGE_REQUEST_TARGET_BRANCH_NAME",
  },
  Travis: {
    name: "Travis",
    isSupported: true,
    diffBranch:
      (process.env.TRAVIS_PULL_REQUEST ?? "") !== "false"
        ? "TRAVIS_BRANCH"
        : undefined,
  },
  AwsCodeBuild: { name: "AwsCodeBuild", isSupported: false },
  Circle: { name: "Circle", isSupported: false },
  Codeship: { name: "Codeship", isSupported: false },
  Continuousphp: { name: "Continuousphp", isSupported: false },
  Jenkins: { name: "Jenkins", isSupported: false },
  SourceHut: { name: "SourceHut", isSupported: false },
  TeamCity: { name: "TeamCity", isSupported: false },
  Wercker: { name: "Wercker", isSupported: false },
} as const;

type CiProviderName = keyof typeof PROVIDERS;

const guessProviders = () => {
  log("Guessing CI providers");

  return Object.values(PROVIDERS).reduce<
    { name: CiProviderName; branch: string }[]
  >((acc, { name, ...cur }) => {
    if (!cur.isSupported || cur.diffBranch === undefined) {
      return acc;
    }

    const branch = process.env[cur.diffBranch] ?? "";
    if (branch === "") {
      return acc;
    }

    return [...acc, { name, branch }];
  }, []);
};

const guessBranch = (): string | undefined => {
  log("Guessing branch");

  if ((process.env.ESLINT_PLUGIN_COMMIT ?? "").length > 0) {
    throw Error("ESLINT_PLUGIN_COMMIT already set");
  }

  const guessedProviders = guessProviders();
  if (guessedProviders.length > 1) {
    throw Error(
      `Too many CI providers found (${guessedProviders
        .map(({ name }) => name)
        .join(
          ", "
        )}). Please specify your target branch explicitly instead, e.g. ESLINT_PLUGIN_COMMIT="main"`
    );
  }

  return guessedProviders[0]?.branch;
};

export type { CiProvider, CiProviderName };
export { guessBranch, PROVIDERS };
