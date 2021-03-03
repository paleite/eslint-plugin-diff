import type { Linter } from "eslint";
import type { Range } from "./git";
import {
  getDiffFileList,
  getDiffForFile,
  getIgnorePatterns,
  getRangesForDiff,
} from "./git";

const STAGED = true;

const isLineWithinRange = (line: number) => (range: Range) =>
  range.isWithinRange(line);

const diff = {
  postprocess: (
    messages: Linter.LintMessage[][],
    filename: string
  ): Linter.LintMessage[] => {
    const shouldKeepFile = getDiffFileList().includes(filename);

    return shouldKeepFile
      ? messages
          .map((message) =>
            message.filter(({ fatal, line }) => {
              const shouldKeepLine = getRangesForDiff(
                getDiffForFile(filename)
              ).some(isLineWithinRange(line));

              return fatal ?? shouldKeepLine;
            })
          )
          .reduce((a, b) => a.concat(b), [])
      : [];
  },

  supportsAutofix: true,
};

const diffConfig = {
  plugins: ["diff"],
  overrides: [
    {
      files: ["*"],
      processor: "diff/diff",
    },
  ],
  ignorePatterns: getIgnorePatterns(),
};

const staged = {
  postprocess: (
    messages: Linter.LintMessage[][],
    filename: string
  ): Linter.LintMessage[] => {
    const shouldKeepFile = getDiffFileList().includes(filename);

    return shouldKeepFile
      ? messages
          .map((message) =>
            message.filter(({ fatal, line }) => {
              const shouldKeepLine = getRangesForDiff(
                getDiffForFile(filename, STAGED)
              ).some(isLineWithinRange(line));

              return fatal ?? shouldKeepLine;
            })
          )
          .reduce((a, b) => a.concat(b), [])
      : [];
  },

  supportsAutofix: true,
};

const stagedConfig = {
  plugins: ["diff"],
  overrides: [
    {
      files: ["*"],
      processor: "diff/staged",
    },
  ],
  ignorePatterns: getIgnorePatterns(STAGED),
};

export { diff, diffConfig, staged, stagedConfig };
