import * as child_process from "child_process";
import { resolve } from "path";
import { Range } from "./Range";

const COMMAND = "git";
const OPTIONS = { maxBuffer: 1024 * 1024 * 100 };

const getDiffForFile = (filePath: string, staged = false): string => {
  const args = [
    "diff",
    "--diff-algorithm=histogram",
    "--diff-filter=ACM",
    "--find-renames=100%",
    "--no-ext-diff",
    "--relative",
    staged && "--staged",
    "--unified=0",
    process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? "HEAD",
    "--",
    resolve(filePath),
  ].reduce<string[]>(
    (acc, cur) => (typeof cur === "string" ? [...acc, cur] : acc),
    []
  );

  return child_process.execFileSync(COMMAND, args, OPTIONS).toString();
};

const getDiffFileList = (staged = false): string[] => {
  const args = [
    "diff",
    "--diff-algorithm=histogram",
    "--diff-filter=ACM",
    "--find-renames=100%",
    "--name-only",
    "--no-ext-diff",
    "--relative",
    staged && "--staged",
    process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? "HEAD",
  ].reduce<string[]>(
    (acc, cur) => (typeof cur === "string" ? [...acc, cur] : acc),
    []
  );

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

  let result = true;
  try {
    child_process.execFileSync(COMMAND, args, OPTIONS).toString();
  } catch (err: unknown) {
    result = false;
  }

  return result;
};

const getUntrackedFileList = (staged = false): string[] => {
  if (staged) {
    return [];
  }

  const args = ["ls-files", "--exclude-standard", "--others"];

  const untrackedFileListCache = child_process
    .execFileSync(COMMAND, args, OPTIONS)
    .toString()
    .trim()
    .split("\n")
    .map((filePath) => resolve(filePath));

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

export {
  getDiffFileList,
  getDiffForFile,
  getRangesForDiff,
  getUntrackedFileList,
  hasCleanIndex,
};
