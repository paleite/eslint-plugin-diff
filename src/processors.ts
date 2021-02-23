import type { Linter } from "eslint";
import type { Range } from "./git";
import { getDiffFileList, getDiffForFile, getRangesForDiff } from "./git";

const STAGED = true;

const isLineWithinRange = (line: number) => (range: Range) =>
  range.isWithinRange(line);

const diff = {
  preprocess: (
    text: string,
    filename: string
  ): { text: string; filename: string }[] =>
    getDiffFileList().includes(filename) ? [{ text, filename }] : [],

  postprocess: (
    messages: Linter.LintMessage[][],
    filename: string
  ): Linter.LintMessage[] =>
    messages
      .map((message) =>
        message.filter(({ line }) =>
          getRangesForDiff(getDiffForFile(filename)).some(
            isLineWithinRange(line)
          )
        )
      )
      .reduce((a, b) => a.concat(b), []),

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
};

const staged = {
  preprocess: (
    text: string,
    filename: string
  ): { text: string; filename: string }[] =>
    getDiffFileList(STAGED).includes(filename) ? [{ text, filename }] : [],

  postprocess: (
    messages: Linter.LintMessage[][],
    filename: string
  ): Linter.LintMessage[] =>
    messages
      .map((message) =>
        message.filter(({ line }) =>
          getRangesForDiff(getDiffForFile(filename, STAGED)).some(
            isLineWithinRange(line)
          )
        )
      )
      .reduce((a, b) => a.concat(b), []),

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
};

export { diff, diffConfig, staged, stagedConfig };
