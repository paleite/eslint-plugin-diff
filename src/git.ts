import * as child_process from "child_process";
import * as path from "path";
import { Range } from "./Range";

const RUNNING_INSIDE_VSCODE = process.env.VSCODE_CLI !== undefined;
const COMMAND = "git";

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
  if (RUNNING_INSIDE_VSCODE || diff === undefined) {
    const args = [
      "diff",
      "--diff-algorithm=histogram",
      "--diff-filter=ACM",
      "-M100%",
      "--relative",
      staged && "--staged",
      "--unified=0",
      JSON.stringify(process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? "HEAD"),
      "--",
      sanitizeFilePath(filePath),
    ].reduce<string[]>(
      (acc, cur) => (typeof cur === "string" ? [...acc, cur] : acc),
      []
    );

    const result = child_process.execFileSync(COMMAND, args).toString();
    setCachedDiff(filePath, staged, result);
    diff = result;
  }

  return diff;
};

let diffFileListCache: string[] | undefined;
const getDiffFileList = (): string[] => {
  if (RUNNING_INSIDE_VSCODE || diffFileListCache === undefined) {
    const args = [
      "diff",
      "--diff-algorithm=histogram",
      "--diff-filter=ACM",
      "-M100%",
      "--name-only",
      "--relative",
      "--staged",
      JSON.stringify(process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? "HEAD"),
    ];

    diffFileListCache = child_process
      .execFileSync(COMMAND, args)
      .toString()
      .trim()
      .split("\n")
      .map((filePath) => path.resolve(filePath));
  }

  return diffFileListCache;
};

let gitFileListCache: string[] | undefined;
const getGitFileList = (): string[] => {
  if (RUNNING_INSIDE_VSCODE || gitFileListCache === undefined) {
    const args = ["ls-files"];

    gitFileListCache = child_process
      .execFileSync(COMMAND, args)
      .toString()
      .trim()
      .split("\n")
      .map((filePath) => path.resolve(filePath));
  }

  return gitFileListCache;
};

const hasCleanIndex = (filePath: string): boolean => {
  const args = [
    "diff",
    "--quiet",
    "--relative",
    "--unified=0",
    "--",
    sanitizeFilePath(filePath),
  ];

  let result = true;
  try {
    child_process.execFileSync(COMMAND, args).toString();
  } catch (err: unknown) {
    result = false;
  }

  return result;
};

let untrackedFileListCache: string[] | undefined;
const getUntrackedFileList = (staged = false): string[] => {
  if (staged) {
    untrackedFileListCache = [];
  } else if (RUNNING_INSIDE_VSCODE || untrackedFileListCache === undefined) {
    const args = ["ls-files", "--exclude-standard", "--others"];

    untrackedFileListCache = child_process
      .execFileSync(COMMAND, args)
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
