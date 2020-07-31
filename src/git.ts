import * as child_process from "child_process";
import * as path from "path";
import { Range } from "./Range";

const getDiffForFile = (filePath: string, staged = false): string =>
  child_process
    .execSync(
      `git diff --diff-filter=ACM --unified=0 HEAD ${
        staged ? " --staged" : ""
      } -- ${path.resolve(filePath)}`
    )
    .toString();

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
    range.groups?.linesCountDelimiter && range.groups?.linesCount
      ? parseInt(range.groups.linesCount)
      : 1;
  const start: number = parseInt(range.groups?.start);
  const end = start + linesCount;

  return new Range(start, end);
};

const getRangesForDiff = (diff: string): Range[] => {
  return diff.split("\n").filter(isHunkHeader).map(getRangeForChangedLines);
};

export { getDiffForFile, getRangesForDiff };
export type { Range };
