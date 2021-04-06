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
    const isFilenameExcluded = !getDiffFileList().includes(filename);

    if (isFilenameExcluded) {
      return [];
    }

    return messages
      .map((message) => {
        const filteredMessage = message.filter(({ fatal, line }) => {
          if (fatal === true) {
            return true;
          }

          const isLineWithinSomeRange = getRangesForDiff(
            getDiffForFile(filename)
          ).some(isLineWithinRange(line));

          return isLineWithinSomeRange;
        });

        return filteredMessage;
      })
      .reduce((a, b) => a.concat(b), []);
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
    const isFilenameExcluded = !getDiffFileList().includes(filename);

    if (isFilenameExcluded) {
      return [];
    }

    return messages
      .map((message) => {
        const filteredMessage = message.filter(({ fatal, line }) => {
          if (fatal === true) {
            return true;
          }

          const isLineWithinSomeRange = getRangesForDiff(
            getDiffForFile(filename, STAGED)
          ).some(isLineWithinRange(line));

          return isLineWithinSomeRange;
        });

        return filteredMessage;
      })
      .reduce((a, b) => a.concat(b), []);
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
