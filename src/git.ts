import * as child_process from "node:child_process";
import { resolve } from "node:path";

import { Range } from "./Range";

const COMMAND = "git";
const OPTIONS = { maxBuffer: 1024 * 1024 * 100 };
const onlyStrings = (args: Array<string | false>): string[] =>
  args.filter((arg): arg is string => typeof arg === "string");

const getDiffForFile = (filePath: string, staged: boolean): string => {
  const args = onlyStrings([
    "diff",
    "--diff-algorithm=histogram",
    "--diff-filter=ACM",
    "--find-renames=100%",
    "--no-ext-diff",
    "--relative",
    staged && "--staged",
    "--unified=0",
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] ?? "HEAD",
    "--",
    resolve(filePath),
  ]);

  return child_process.execFileSync(COMMAND, args, OPTIONS).toString();
};

const getDiffFileList = (staged: boolean): string[] => {
  const args = onlyStrings([
    "diff",
    "--diff-algorithm=histogram",
    "--diff-filter=ACM",
    "--find-renames=100%",
    "--name-only",
    "--no-ext-diff",
    "--relative",
    staged && "--staged",
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] ?? "HEAD",
    "--",
  ]);

  return child_process
    .execFileSync(COMMAND, args, OPTIONS)
    .toString()
    .trim()
    .split("\n")
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

const fetchFromOrigin = (branch: string) => {
  const args = ["fetch", "--quiet", "origin", branch];

  child_process.execFileSync(COMMAND, args, OPTIONS);
};

let untrackedFileListCache: string[] | undefined;
const getUntrackedFileList = (
  staged: boolean,
  shouldRefresh = false,
): string[] => {
  if (staged) {
    return [];
  }

  if (untrackedFileListCache === undefined || shouldRefresh) {
    const args = ["ls-files", "--exclude-standard", "--others"];

    untrackedFileListCache = child_process
      .execFileSync(COMMAND, args, OPTIONS)
      .toString()
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

export {
  fetchFromOrigin,
  getDiffFileList,
  getDiffForFile,
  getRangesForDiff,
  getUntrackedFileList,
  hasCleanIndex,
};
