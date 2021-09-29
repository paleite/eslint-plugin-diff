import * as child_process from "child_process";
import * as path from "path";
import { Range } from "./Range";

const sanitizeFilePath = (filePath: string) =>
  JSON.stringify(path.resolve(filePath));

const diffCacheKey = (filePath: string, staged: boolean): string =>
  JSON.stringify([path.resolve(filePath), staged]);

const diffCache = new Map<string, string>();
const setCachedDiff = (filePath: string, staged: boolean, diff: string): void =>
  void diffCache.set(diffCacheKey(filePath, staged), diff);

const getCachedDiff = (filePath: string, staged: boolean) =>
  diffCache.get(diffCacheKey(filePath, staged));

const getDiffForFile = (filePath: string, staged = false): string => {
  let diff = getCachedDiff(filePath, staged);
  if (diff === undefined) {
    const command = [
      "git",
      "diff",
      "--diff-filter=ACM",
      "--relative",
      staged && "--staged",
      "--unified=0",
      JSON.stringify(process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? "HEAD"),
      "--",
      sanitizeFilePath(filePath),
    ]
      .filter(Boolean)
      .join(" ");

    const result = child_process.execSync(command).toString();
    setCachedDiff(filePath, staged, result);
    diff = result;
  }

  return diff;
};

let diffFileListCache: string[] | undefined;
const getDiffFileList = (staged = false): string[] => {
  if (diffFileListCache === undefined) {
    const command = [
      "git",
      "diff",
      "--diff-filter=ACM",
      "--name-only",
      "--relative",
      staged && "--staged",
      JSON.stringify(process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? "HEAD"),
    ]
      .filter(Boolean)
      .join(" ");

    diffFileListCache = child_process
      .execSync(command)
      .toString()
      .trim()
      .split("\n")
      .map((filePath) => path.resolve(filePath));
  }
  return diffFileListCache;
};

let gitFileListCache: string[] | undefined;
const getGitFileList = (): string[] => {
  if (gitFileListCache === undefined) {
    const command = ["git", "ls-files"].filter(Boolean).join(" ");

    gitFileListCache = child_process
      .execSync(command)
      .toString()
      .trim()
      .split("\n")
      .map((filePath) => path.resolve(filePath));
  }

  return gitFileListCache;
};

const hasCleanIndex = (filePath: string): boolean => {
  const command = [
    "git",
    "diff",
    "--quiet",
    "--relative",
    "--unified=0",
    "--",
    sanitizeFilePath(filePath),
  ].join(" ");

  let result = true;
  try {
    child_process.execSync(command).toString();
  } catch (err: unknown) {
    result = false;
  }

  return result;
};

let untrackedFileListCache: string[] | undefined;
const getUntrackedFileList = (staged = false): string[] => {
  if (staged) {
    untrackedFileListCache = [];
  } else if (untrackedFileListCache === undefined) {
    const command = ["git", "ls-files", "--exclude-standard", "--others"]
      .filter(Boolean)
      .join(" ");

    untrackedFileListCache = child_process
      .execSync(command)
      .toString()
      .trim()
      .split("\n")
      .map((filePath) => path.resolve(filePath));
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

export {
  getDiffFileList,
  getDiffForFile,
  getRangesForDiff,
  getGitFileList,
  getUntrackedFileList,
  hasCleanIndex,
};
export type { Range };
