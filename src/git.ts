import * as child_process from "node:child_process";
import { resolve } from "node:path";

import { Range } from "./Range";

export type DiffType = "working" | "staged" | "committed";

const COMMAND = "git";
const OPTIONS = { maxBuffer: 1024 * 1024 * 100 };
const onlyStrings = (args: Array<string | false>): string[] =>
  args.filter((arg): arg is string => typeof arg === "string");

const getDiffForFile = (filePath: string, diffType: DiffType): string => {
  const args = onlyStrings([
    diffType === "committed" ? "diff-tree" : "diff",
    "--diff-algorithm=histogram",
    "--diff-filter=ACM",
    "--find-renames=100%",
    "--no-ext-diff",
    "--relative",
    diffType === "staged" && "--staged",
    diffType === "committed" && "-r",
    "--unified=0",
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] ?? "HEAD",
    diffType === "committed" && "HEAD",
    "--",
    resolve(filePath),
  ]);

  return child_process.execFileSync(COMMAND, args, OPTIONS).toString();
};

const getDiffFileList = (diffType: DiffType): string[] => {
  const args = onlyStrings([
    diffType === "committed" ? "diff-tree" : "diff",
    "--diff-algorithm=histogram",
    "--diff-filter=ACM",
    "--find-renames=100%",
    "--name-only",
    "--no-ext-diff",
    "--relative",
    diffType === "staged" && "--staged",
    diffType === "committed" && "-r",
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] ?? "HEAD",
    diffType === "committed" && "HEAD",
    "--",
  ]);

  return child_process
    .execFileSync(COMMAND, args, OPTIONS)
    .toString()
    .trim()
    .split("\n")
    .filter((filePath) => filePath.length > 0)
    .map((filePath) => resolve(filePath));
};

const hasCleanIndex = (filePath: string): boolean => {
  const args = [
    "diff",
    "--no-ext-diff",
    "--quiet",
    "--relative",
    "--unified=0",
    "--",
    resolve(filePath),
  ];

  try {
    child_process.execFileSync(COMMAND, args, OPTIONS);
  } catch {
    return false;
  }

  return true;
};

const hasCleanTree = (filePath: string): boolean => {
  const args = [
    "diff-index",
    "--no-ext-diff",
    "--quiet",
    "HEAD",
    "--",
    resolve(filePath),
  ];

  try {
    child_process.execFileSync(COMMAND, args, OPTIONS);
  } catch {
    return false;
  }

  return true;
};

const fetchFromOrigin = (branch: string) => {
  const args = ["fetch", "--quiet", "origin", branch];

  child_process.execFileSync(COMMAND, args, OPTIONS);
};

const getTrackedFileList = (): string[] => {
  const args = ["ls-files"];

  return child_process
    .execFileSync(COMMAND, args, OPTIONS)
    .toString()
    .trim()
    .split("\n")
    .filter((filePath) => filePath.length > 0)
    .map((filePath) => resolve(filePath));
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
  const match = rangeRE.exec(line);
  if (match?.groups === undefined) {
    throw new Error(`Couldn't match regex with line '${line}'`);
  }

  const {
    start: startStr,
    linesCountDelimiter,
    linesCount: linesCountStr,
  } = match.groups;

  const linesCount: number =
    linesCountDelimiter && linesCountStr !== undefined
      ? Number.parseInt(linesCountStr)
      : 1;

  const hasAddedLines = linesCount !== 0;
  const start: number = Number.parseInt(`${startStr}`);
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

    ranges.push(range);
    return ranges;
  }, []);

const readFileFromGit = (filePath: string): string => {
  const getBlobArgs = ["ls-tree", "--object-only", "HEAD", resolve(filePath)];
  const blob = child_process
    .execFileSync(COMMAND, getBlobArgs, OPTIONS)
    .toString()
    .trim();
  const catFileArgs = ["cat-file", "blob", blob];
  return child_process.execFileSync(COMMAND, catFileArgs, OPTIONS).toString();
};

export {
  fetchFromOrigin,
  getDiffFileList,
  getDiffForFile,
  getRangesForDiff,
  getTrackedFileList,
  hasCleanIndex,
  hasCleanTree,
  readFileFromGit,
};
