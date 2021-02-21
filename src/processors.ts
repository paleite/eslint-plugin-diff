import type { Range } from "./git";
import { getDiffForFile, getRangesForDiff, getDiffFileList } from "./git";
import type { Linter } from "eslint";

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
    ([] as Linter.LintMessage[]).concat(
      ...messages.map((message) =>
        message.filter(({ line }) =>
          getRangesForDiff(getDiffForFile(filename)).some(
            isLineWithinRange(line)
          )
        )
      )
    ),

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
    ([] as Linter.LintMessage[]).concat(
      ...messages.map((message) =>
        message.filter(({ line }) =>
          getRangesForDiff(getDiffForFile(filename, STAGED)).some(
            isLineWithinRange(line)
          )
        )
      )
    ),
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
