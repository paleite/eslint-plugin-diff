import * as child_process from "child_process";
import { resolve } from "path";
import { Range } from "./Range";

export type DiffType = "staged" | "committed" | "working";

const COMMAND = "git";
const OPTIONS = { encoding: "utf8" as const, maxBuffer: 1024 * 1024 * 100 };

const getDiffForFile = (filePath: string, diffType: DiffType): string => {
  const args = [
    diffType === "committed" ? "diff-tree" : "diff-index",
    "--diff-algorithm=histogram",
    "--diff-filter=ACM",
    "--find-renames=100%",
    "--no-ext-diff",
    "--relative",
    diffType === "staged" && "--cached",
    "--unified=0",
    process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? "HEAD",
    diffType === "committed" && "HEAD",
    "--",
    resolve(filePath),
  ].filter((cur): cur is string => typeof cur === "string");

  return child_process.execFileSync(COMMAND, args, OPTIONS);
};

const getDiffFileList = (diffType: DiffType): string[] => {
  const args = [
    diffType === "committed" ? "diff-tree" : "diff-index",
    "--diff-algorithm=histogram",
    "--diff-filter=ACM",
    "--find-renames=100%",
    "--name-only",
    "--no-ext-diff",
    "--relative",
    diffType === "staged" && "--cached",
    process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? "HEAD",
    diffType === "committed" && "HEAD",
    "--",
  ].filter((cur): cur is string => typeof cur === "string");

  return child_process
    .execFileSync(COMMAND, args, OPTIONS)
    .trim()
    .split("\n")
    .map((filePath) => resolve(filePath));
};

const hasCleanIndex = (filePath: string): boolean => {
  const args = [
    "diff-files",
    "--no-ext-diff",
    "--quiet",
    "--relative",
    "--unified=0",
    "--",
    resolve(filePath),
  ];

  try {
    child_process.execFileSync(COMMAND, args, OPTIONS);
  } catch (err: unknown) {
    return false;
  }

  return true;
};

const hasCleanTree = (filePath: string): boolean => {
  const args = [
    "diff-index",
    "--no-ext-diff",
    "--quiet",
    "--relative",
    "--unified=0",
    "HEAD",
    "--",
    resolve(filePath),
  ];

  try {
    child_process.execFileSync(COMMAND, args, OPTIONS);
  } catch (err: unknown) {
    return false;
  }

  return true;
};

const fetchFromOrigin = (branch: string) => {
  const args = ["fetch", "--quiet", "origin", branch];

  child_process.execFileSync(COMMAND, args, OPTIONS);
};

let untrackedFileListCache: string[] | undefined;
const getUntrackedFileList = (
  diffType: DiffType,
  shouldRefresh = false
): string[] => {
  if (diffType !== "working") {
    return [];
  }

  if (untrackedFileListCache === undefined || shouldRefresh) {
    const args = ["ls-files", "--exclude-standard", "--others"];

    untrackedFileListCache = child_process
      .execFileSync(COMMAND, args, OPTIONS)
      .trim()
      .split("\n")
      .map((filePath) => resolve(filePath));
  }

  return untrackedFileListCache;
};

const isHunkHeader = (input: string) => {
  const hunkHeaderRE = /^@@ [^@]* @@/u;

  return hunkHeaderRE.exec(input);
};

const getRangeForChangedLines = (line: string) => {
  /**
   * Example values of the RegExp's group:
   *
   * start: '7',
   * linesCountDelimiter: ',2',
   * linesCount: '2',
   */
  const rangeRE =
    /^@@ .* \+(?<start>\d+)(?<linesCountDelimiter>,(?<linesCount>\d+))? @@/u;
  const range = rangeRE.exec(line);
  if (range === null) {
    throw Error(`Couldn't match regex with line '${line}'`);
  }

  const groups = {
    // Fallback value to ensure hasAddedLines resolves to false
    start: "0",
    linesCountDelimiter: ",0",
    linesCount: "0",
    ...range.groups,
  };

  const linesCount: number =
    groups.linesCountDelimiter && groups.linesCount
      ? parseInt(groups.linesCount)
      : 1;

  const hasAddedLines = linesCount !== 0;
  const start: number = parseInt(groups.start);
  const end = start + linesCount;

  return hasAddedLines ? new Range(start, end) : null;
};

const getRangesForDiff = (diff: string): Range[] =>
  diff.split("\n").reduce<Range[]>((ranges, line) => {
    if (!isHunkHeader(line)) {
      return ranges;
    }

    const range = getRangeForChangedLines(line);
    if (range === null) {
      return ranges;
    }

    return [...ranges, range];
  }, []);

const readFileFromGit = (filePath: string) => {
  const getBlob = ["ls-tree", "--object-only", "HEAD", resolve(filePath)];
  const blob = child_process.execFileSync(COMMAND, getBlob, OPTIONS).trim();
  const catFile = ["cat-file", "blob", blob];
  return child_process.execFileSync(COMMAND, catFile, OPTIONS);
};

export {
  fetchFromOrigin,
  getDiffFileList,
  getDiffForFile,
  getRangesForDiff,
  getUntrackedFileList,
  hasCleanIndex,
  hasCleanTree,
  readFileFromGit,
};
