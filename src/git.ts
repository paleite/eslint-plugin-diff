import * as child_process from "child_process";
import * as path from "path";
import { Range } from "./Range";

const COMMAND = "git";

const sanitizeFilePath = (filePath: string) =>
  JSON.stringify(path.resolve(filePath));

const getDiffForFile = (filePath: string, staged = false): string => {
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

  return child_process.execFileSync(COMMAND, args).toString();
};

const getDiffFileList = (): string[] => {
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

  return child_process
    .execFileSync(COMMAND, args)
    .toString()
    .trim()
    .split("\n")
    .map((filePath) => path.resolve(filePath));
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

const getUntrackedFileList = (staged = false): string[] => {
  if (staged) {
    return [];
  }

  const args = ["ls-files", "--exclude-standard", "--others"];

  const untrackedFileListCache = child_process
    .execFileSync(COMMAND, args)
    .toString()
    .trim()
    .split("\n")
    .map((filePath) => path.resolve(filePath));

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
