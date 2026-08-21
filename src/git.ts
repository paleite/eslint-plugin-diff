import * as child_process from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

import type { PullRequestContext } from "./ci";
import { Range } from "./Range";

const COMMAND = "git";
const OPTIONS: child_process.ExecFileSyncOptionsWithStringEncoding = {
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 100,
  stdio: ["ignore", "pipe", "pipe"],
};

type GitComparison =
  | { kind: "working-tree"; baseCommit: string }
  | { kind: "index"; baseCommit: string }
  | { kind: "commit"; baseCommit: string; headCommit: string };

type ChangedFileStatus =
  "added" | "modified" | "renamed" | "copied" | "type-changed" | "untracked";

type ChangedFile = {
  status: ChangedFileStatus;
  filename: string;
  relativePath: string;
  previousFilename?: string;
  previousRelativePath?: string;
  similarity?: number;
  allLinesChanged: boolean;
};

type DiffSnapshot = {
  repositoryRoot: string;
  comparison: GitComparison;
  files: ReadonlyMap<string, ChangedFile>;
};

const execGit = (args: readonly string[], cwd?: string): string =>
  child_process.execFileSync(COMMAND, [...args], {
    ...OPTIONS,
    cwd,
  });

const tryGit = (args: readonly string[], cwd?: string): string | null => {
  try {
    return execGit(args, cwd);
  } catch {
    return null;
  }
};

const canonicalizeFilename = (filename: string): string => {
  const absolute = resolve(filename);
  try {
    return realpathSync.native(absolute);
  } catch {
    return resolve(absolute);
  }
};

const getRepositoryRoot = (): string => {
  const root = execGit(["rev-parse", "--show-toplevel"]).trim();
  if (root.length === 0) {
    throw new Error(
      "eslint-plugin-diff could not determine the Git repository root.",
    );
  }
  return canonicalizeFilename(root);
};

const parseNullDelimited = (output: string): string[] => {
  const tokens = output.split("\0");
  if (tokens.at(-1) === "") {
    tokens.pop();
  }
  return tokens;
};

const parseStatus = (
  rawStatus: string,
): { status: ChangedFileStatus | "deleted"; similarity?: number } => {
  const kind = rawStatus[0];
  if (kind === "A") return { status: "added" };
  if (kind === "M") return { status: "modified" };
  if (kind === "T") return { status: "type-changed" };
  if (kind === "D") return { status: "deleted" };
  if (kind === "R" || kind === "C") {
    const similarityText = rawStatus.slice(1);
    const similarity = Number.parseInt(similarityText, 10);
    if (!Number.isFinite(similarity)) {
      throw new Error(`Invalid Git similarity status '${rawStatus}'.`);
    }
    return {
      status: kind === "R" ? "renamed" : "copied",
      similarity,
    };
  }
  if (kind === "U" || kind === "X" || kind === "B") {
    throw new Error(
      `eslint-plugin-diff cannot determine changed-file scope for Git status '${rawStatus}'. Resolve the repository state and retry.`,
    );
  }
  throw new Error(`Unsupported Git diff status '${rawStatus}'.`);
};

const createChangedFile = (
  repositoryRoot: string,
  status: ChangedFileStatus,
  relativePath: string,
  options: {
    previousRelativePath?: string | undefined;
    similarity?: number | undefined;
    allLinesChanged?: boolean | undefined;
  } = {},
): ChangedFile => {
  const filename = canonicalizeFilename(resolve(repositoryRoot, relativePath));
  return {
    status,
    filename,
    relativePath,
    ...(options.previousRelativePath === undefined
      ? {}
      : {
          previousRelativePath: options.previousRelativePath,
          previousFilename: canonicalizeFilename(
            resolve(repositoryRoot, options.previousRelativePath),
          ),
        }),
    ...(options.similarity === undefined
      ? {}
      : { similarity: options.similarity }),
    allLinesChanged:
      options.allLinesChanged ?? (status === "added" || status === "untracked"),
  };
};

const parseNameStatusZ = (
  output: string,
  repositoryRoot: string,
): Map<string, ChangedFile> => {
  const tokens = parseNullDelimited(output);
  const files = new Map<string, ChangedFile>();

  for (let index = 0; index < tokens.length;) {
    const rawStatus = tokens[index++];
    if (rawStatus === undefined || rawStatus.length === 0) {
      throw new Error("Invalid empty Git name-status token.");
    }
    const parsed = parseStatus(rawStatus);

    if (parsed.status === "renamed" || parsed.status === "copied") {
      const previousRelativePath = tokens[index++];
      const relativePath = tokens[index++];
      if (previousRelativePath === undefined || relativePath === undefined) {
        throw new Error(
          `Incomplete Git ${parsed.status} status '${rawStatus}'.`,
        );
      }
      const changedFile = createChangedFile(
        repositoryRoot,
        parsed.status,
        relativePath,
        {
          previousRelativePath,
          similarity: parsed.similarity,
          allLinesChanged: false,
        },
      );
      files.set(changedFile.filename, changedFile);
      continue;
    }

    const relativePath = tokens[index++];
    if (relativePath === undefined) {
      throw new Error(`Incomplete Git status '${rawStatus}'.`);
    }
    if (parsed.status === "deleted") {
      continue;
    }
    const changedFile = createChangedFile(
      repositoryRoot,
      parsed.status,
      relativePath,
    );
    files.set(changedFile.filename, changedFile);
  }

  return files;
};

const getComparisonArgs = (comparison: GitComparison): string[] => {
  switch (comparison.kind) {
    case "working-tree":
      return [comparison.baseCommit];
    case "index":
      return ["--cached", comparison.baseCommit];
    case "commit":
      return [comparison.baseCommit, comparison.headCommit];
  }
};

const getDiffSnapshot = (
  comparison: GitComparison,
  options: { includeUntracked: boolean },
): DiffSnapshot => {
  const repositoryRoot = getRepositoryRoot();
  const diffOutput = execGit(
    [
      "diff",
      "--diff-algorithm=histogram",
      "--find-renames",
      "--name-status",
      "-z",
      "--no-ext-diff",
      "--relative",
      ...getComparisonArgs(comparison),
      "--",
    ],
    repositoryRoot,
  );
  const files = parseNameStatusZ(diffOutput, repositoryRoot);

  if (options.includeUntracked) {
    const untracked = parseNullDelimited(
      execGit(
        ["ls-files", "--others", "--exclude-standard", "-z"],
        repositoryRoot,
      ),
    );
    for (const relativePath of untracked) {
      const changedFile = createChangedFile(
        repositoryRoot,
        "untracked",
        relativePath,
        { allLinesChanged: true },
      );
      files.set(changedFile.filename, changedFile);
    }
  }

  return { repositoryRoot, comparison, files };
};

const isHunkHeader = (input: string): boolean => /^@@ [^@]* @@/u.test(input);

const getRangeForChangedLines = (line: string): Range | null => {
  const rangeRE =
    /^@@ .* \+(?<start>\d+)(?<linesCountDelimiter>,(?<linesCount>\d+))? @@/u;
  const match = rangeRE.exec(line);
  if (match?.groups === undefined) {
    throw new Error(`Couldn't match regex with line '${line}'`);
  }
  const start = Number.parseInt(String(match.groups["start"]), 10);
  const count =
    match.groups["linesCountDelimiter"] === undefined
      ? 1
      : Number.parseInt(String(match.groups["linesCount"]), 10);
  return count === 0 ? null : new Range(start, start + count);
};

const getRangesForDiff = (diff: string): Range[] =>
  diff.split("\n").flatMap((line) => {
    if (!isHunkHeader(line)) return [];
    const range = getRangeForChangedLines(line);
    return range === null ? [] : [range];
  });

const getChangedLineRanges = (
  snapshot: DiffSnapshot,
  changedFile: ChangedFile,
): Range[] => {
  if (changedFile.allLinesChanged) {
    return [];
  }

  const pathspec =
    changedFile.previousRelativePath === undefined
      ? [changedFile.relativePath]
      : [changedFile.previousRelativePath, changedFile.relativePath];
  const diff = execGit(
    [
      "diff",
      "--diff-algorithm=histogram",
      "--find-renames",
      "--no-ext-diff",
      "--relative",
      "--unified=0",
      ...getComparisonArgs(snapshot.comparison),
      "--",
      ...pathspec,
    ],
    snapshot.repositoryRoot,
  );
  return getRangesForDiff(diff);
};

const getUnstagedState = (
  repositoryRoot: string,
  relativePath: string,
): "clean" | "dirty" => {
  const result = child_process.spawnSync(
    COMMAND,
    ["diff", "--no-ext-diff", "--quiet", "--", relativePath],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status === 0) return "clean";
  if (result.status === 1) return "dirty";
  throw new Error(
    `git diff --quiet failed for '${relativePath}' with exit code ${String(result.status)}: ${result.stderr}`,
  );
};

const resolveCommitishLocally = (commitish: string): string | null => {
  const result = tryGit(["rev-parse", "--verify", `${commitish}^{commit}`]);
  return result === null ? null : result.trim() || null;
};

const isShallowRepository = (): boolean =>
  execGit(["rev-parse", "--is-shallow-repository"]).trim() === "true";

let privateRefCounter = 0;
const createPrivateRef = (kind: "base" | "head"): string => {
  privateRefCounter += 1;
  return `refs/eslint-plugin-diff/${process.pid}/${privateRefCounter}/${kind}`;
};

const deletePrivateRef = (ref: string): void => {
  const existing = tryGit(["show-ref", "--verify", "--quiet", ref]);
  if (existing !== null) {
    execGit(["update-ref", "-d", ref]);
  }
};

const cleanupPrivateRefs = (
  refs: readonly string[],
  primaryError: unknown,
): void => {
  const cleanupErrors: Error[] = [];

  for (const ref of refs) {
    try {
      deletePrivateRef(ref);
    } catch (error) {
      cleanupErrors.push(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  if (cleanupErrors.length === 0) {
    return;
  }

  const cleanupMessage = cleanupErrors.map((error) => error.message).join("; ");

  if (primaryError instanceof Error) {
    primaryError.message = `${primaryError.message} Private-ref cleanup also failed: ${cleanupMessage}`;
    return;
  }

  throw new Error(
    `eslint-plugin-diff could not clean up its private Git refs: ${cleanupMessage}`,
    { cause: cleanupErrors[0] },
  );
};

const normalizeRemoteSource = (ref: string): string => {
  if (/^[0-9a-f]{7,40}$/iu.test(ref)) return ref;
  if (
    ref.startsWith("refs/heads/") ||
    ref.startsWith("refs/pull/") ||
    ref.startsWith("refs/merge-requests/")
  ) {
    return ref;
  }
  if (ref.startsWith("refs/remotes/origin/")) {
    return `refs/heads/${ref.slice("refs/remotes/origin/".length)}`;
  }
  if (ref.startsWith("origin/")) {
    return `refs/heads/${ref.slice("origin/".length)}`;
  }
  if (ref.startsWith("refs/")) return ref;
  return `refs/heads/${ref}`;
};

const fetchToPrivateRef = (
  source: string,
  destination: string,
  options: { deepen?: number; depth?: number; normalizeSource?: boolean },
): void => {
  const remoteSource =
    options.normalizeSource === false ? source : normalizeRemoteSource(source);
  execGit([
    "fetch",
    "--quiet",
    "--no-tags",
    "--no-write-fetch-head",
    ...(options.depth === undefined ? [] : [`--depth=${options.depth}`]),
    ...(options.deepen === undefined ? [] : [`--deepen=${options.deepen}`]),
    "origin",
    `${remoteSource}:${destination}`,
  ]);
};

const fetchExactCommitishToPrivateRef = (
  commitish: string,
  destination: string,
  options: { depth?: number },
): void => {
  const candidates = [commitish, normalizeRemoteSource(commitish)].filter(
    (candidate, index, all) => all.indexOf(candidate) === index,
  );
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      fetchToPrivateRef(candidate, destination, {
        ...options,
        normalizeSource: false,
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Git could not fetch exact comparison point '${commitish}'.`);
};

const tryMergeBase = (left: string, right: string): string | null => {
  const result = tryGit(["merge-base", left, right]);
  return result === null ? null : result.trim() || null;
};

const reachableCount = (refs: readonly string[]): number => {
  const result = execGit(["rev-list", "--count", ...refs]).trim();
  return Number.parseInt(result, 10);
};

const resolveExactBase = (commitish: string, allowNetwork: boolean): string => {
  const local = resolveCommitishLocally(commitish);
  if (local !== null) return local;
  if (!allowNetwork) {
    throw new Error(
      `eslint-plugin-diff could not resolve exact Git comparison point '${commitish}'. Fetch the required ref or history and retry.`,
    );
  }

  const privateRef = createPrivateRef("base");
  let primaryError: unknown;
  try {
    fetchExactCommitishToPrivateRef(
      commitish,
      privateRef,
      isShallowRepository() ? { depth: 1 } : {},
    );
    const resolved = resolveCommitishLocally(privateRef);
    if (resolved === null) {
      throw new Error(
        `Fetched '${commitish}' but could not resolve it as a commit.`,
      );
    }
    return resolved;
  } catch (error) {
    const wrappedError = new Error(
      `eslint-plugin-diff could not resolve exact CI comparison point '${commitish}'.`,
      { cause: error },
    );
    primaryError = wrappedError;
    throw wrappedError;
  } finally {
    cleanupPrivateRefs([privateRef], primaryError);
  }
};

const resolveExactCommitFromHistory = (
  exactCommit: string,
  historyRef: string,
): string => {
  const local = resolveCommitishLocally(exactCommit);
  if (local !== null) {
    return local;
  }

  const privateRef = createPrivateRef("base");
  let primaryError: unknown;

  try {
    const shallowAtStart = isShallowRepository();
    fetchToPrivateRef(
      historyRef,
      privateRef,
      shallowAtStart ? { depth: 1 } : {},
    );

    let resolved = resolveCommitishLocally(exactCommit);
    let deepenBy = 32;

    while (resolved === null) {
      if (!isShallowRepository()) {
        throw new Error(
          `Exact commit '${exactCommit}' is not reachable from '${historyRef}'.`,
        );
      }

      const before = reachableCount([privateRef]);
      fetchToPrivateRef(historyRef, privateRef, { deepen: deepenBy });
      const after = reachableCount([privateRef]);
      if (after <= before) {
        throw new Error(
          `Git history did not deepen while resolving exact commit '${exactCommit}' from '${historyRef}'.`,
        );
      }

      resolved = resolveCommitishLocally(exactCommit);
      deepenBy *= 2;
    }

    return resolved;
  } catch (error) {
    const wrappedError = new Error(
      `eslint-plugin-diff could not resolve exact CI diff base '${exactCommit}' from '${historyRef}'.`,
      { cause: error },
    );
    primaryError = wrappedError;
    throw wrappedError;
  } finally {
    cleanupPrivateRefs([privateRef], primaryError);
  }
};

const getLocalBaseCommit = (context: PullRequestContext): string | null => {
  const candidates = [context.baseSha, context.baseRef].filter(
    (candidate): candidate is string => candidate !== undefined,
  );

  for (const candidate of candidates) {
    const direct = resolveCommitishLocally(candidate);
    if (direct !== null) {
      return direct;
    }

    if (!candidate.startsWith("refs/") && !candidate.startsWith("origin/")) {
      const remoteTracking = resolveCommitishLocally(`origin/${candidate}`);
      if (remoteTracking !== null) {
        return remoteTracking;
      }
    }
  }

  return null;
};

const resolveCiBase = (context: PullRequestContext): string => {
  if (context.diffBaseSha !== undefined) {
    return context.baseRef === undefined
      ? resolveExactBase(context.diffBaseSha, true)
      : resolveExactCommitFromHistory(context.diffBaseSha, context.baseRef);
  }

  const baseFetchSource = context.baseRef ?? context.baseSha;
  if (baseFetchSource === undefined) {
    throw new Error(
      `eslint-plugin-diff could not determine the ${context.provider} pull-request base side.`,
    );
  }

  const localBaseCommit = getLocalBaseCommit(context);
  if (localBaseCommit !== null) {
    const localMergeBase = tryMergeBase("HEAD", localBaseCommit);
    if (localMergeBase !== null) {
      return localMergeBase;
    }
    if (!isShallowRepository()) {
      throw new Error(
        `eslint-plugin-diff could not establish a reliable ${context.provider} pull-request diff base: no merge base exists between HEAD and '${baseFetchSource}'.`,
      );
    }
  }

  const privateBase = createPrivateRef("base");
  const privateHead = createPrivateRef("head");
  const refsToCleanup = [privateBase, privateHead];
  let primaryError: unknown;

  try {
    const shallowAtStart = isShallowRepository();
    fetchToPrivateRef(
      baseFetchSource,
      privateBase,
      shallowAtStart ? { depth: 1 } : {},
    );

    const headSource = context.headRef;
    let fetchedHeadRef = false;
    if (headSource !== undefined) {
      try {
        fetchToPrivateRef(
          headSource,
          privateHead,
          shallowAtStart ? { depth: 1 } : {},
        );
        fetchedHeadRef = true;
      } catch {
        // The checked-out HEAD remains the authoritative head endpoint. A
        // fetchable source ref is only used to obtain missing ancestry. This
        // commonly fails for fork PRs whose source branch is not on origin.
      }
    }

    const getBaseEndpoint = (): string | null =>
      context.baseSha === undefined
        ? resolveCommitishLocally(privateBase)
        : resolveCommitishLocally(context.baseSha);

    let baseEndpoint = getBaseEndpoint();
    let mergeBase =
      baseEndpoint === null ? null : tryMergeBase("HEAD", baseEndpoint);
    let deepenBy = 32;

    while (mergeBase === null) {
      if (!isShallowRepository()) {
        if (baseEndpoint === null && context.baseSha !== undefined) {
          throw new Error(
            `The ${context.provider} target commit '${context.baseSha}' is not reachable from fetched base ref '${baseFetchSource}'.`,
          );
        }
        throw new Error(
          `No merge base exists between the checked-out head and ${context.provider} base '${baseFetchSource}'.`,
        );
      }

      const refs = [
        "HEAD",
        privateBase,
        ...(fetchedHeadRef ? [privateHead] : []),
      ];
      const before = reachableCount(refs);
      fetchToPrivateRef(baseFetchSource, privateBase, { deepen: deepenBy });
      if (headSource !== undefined && fetchedHeadRef) {
        fetchToPrivateRef(headSource, privateHead, { deepen: deepenBy });
      }
      const after = reachableCount(refs);
      if (after <= before) {
        throw new Error(
          `Git history did not deepen while resolving ${context.provider} merge base '${baseFetchSource}'.`,
        );
      }

      baseEndpoint = getBaseEndpoint();
      mergeBase =
        baseEndpoint === null ? null : tryMergeBase("HEAD", baseEndpoint);
      deepenBy *= 2;
    }

    return mergeBase;
  } catch (error) {
    const wrappedError = new Error(
      `eslint-plugin-diff could not establish a reliable ${context.provider} pull-request diff base.`,
      { cause: error },
    );
    primaryError = wrappedError;
    throw wrappedError;
  } finally {
    cleanupPrivateRefs(refsToCleanup, primaryError);
  }
};

export type { ChangedFile, ChangedFileStatus, DiffSnapshot, GitComparison };
export {
  canonicalizeFilename,
  getChangedLineRanges,
  getDiffSnapshot,
  getRangesForDiff,
  getRepositoryRoot,
  getUnstagedState,
  parseNameStatusZ,
  resolveCiBase,
  resolveCommitishLocally,
  resolveExactBase,
};
