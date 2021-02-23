import * as child_process from "child_process";
import * as path from "path";
import { Range } from "./Range";

const sanitizeFilePath = (filePath: string) =>
  JSON.stringify(path.resolve(filePath));

const diffCacheKey = (filePath: string, staged: boolean): string =>
  JSON.stringify([path.resolve(filePath), staged]);

const setCachedDiff = (filePath: string, staged: boolean, diff: string): void =>
  void diffCache.set(diffCacheKey(filePath, staged), diff);

const getCachedDiff = (filePath: string, staged: boolean) =>
  diffCache.get(diffCacheKey(filePath, staged));

const diffCache = new Map<string, string>();
const getDiffForFile = (filePath: string, staged = false): string => {
  let diff = getCachedDiff(filePath, staged);
  if (diff === undefined) {
    const command = [
      "git",
      "diff",
      "--diff-filter=ACM",
      staged && "--staged",
      "--unified=0",
      process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? "HEAD",
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

let diffFileListCache: string[];
const getDiffFileList = (staged = false): string[] => {
  if (diffFileListCache === undefined) {
    const command = [
      "git",
      "diff",
      "--diff-filter=ACM",
      "--name-only",
      staged && "--staged",
      process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? "HEAD",
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

const isHunkHeader = (input: string) => {
  const hunkHeaderRE = new RegExp(/^@@ .* @@/g);
  return input.match(hunkHeaderRE);
};

const getRangeForChangedLines = (line: string) => {
  const rangeRE = new RegExp(
    /^@@ .* \+(?<start>\d+)(?<linesCountDelimiter>,(?<linesCount>\d+))? @@/
  );
  const range = rangeRE.exec(line);
  if (range === null) {
    throw Error(`Couldn't match regex with line '${line}'`);
  }
  if (range.groups?.start === undefined) {
    /*
     * NOTE: Never happens, because RegExp requires start to be a
     * required number
     */
    throw Error("Couldn't match regex to find start");
  }

  const linesCount: number =
    range.groups.linesCountDelimiter && range.groups.linesCount
      ? parseInt(range.groups.linesCount)
      : 1;

  const hasAddedLines = linesCount !== 0;
  const start: number = parseInt(range.groups.start);
  const end = start + linesCount;

  return hasAddedLines ? new Range(start, end) : null;
};

const removeNullRanges = (r: Range | null): r is Range => r !== null;

const getRangesForDiff = (diff: string): Range[] => {
  return diff
    .split("\n")
    .filter(isHunkHeader)
    .map(getRangeForChangedLines)
    .filter(removeNullRanges);
};

export { getDiffForFile, getRangesForDiff, getDiffFileList };
export type { Range };
