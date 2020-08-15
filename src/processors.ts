import { getDiffForFile, getRangesForDiff, Range } from "./git";
import { Linter } from "eslint";

const STAGED = true;

const isLineWithinRange = (line: number) => (range: Range) =>
  range.isWithinRange(line);

const diff = {
  postprocess: (
    messages: Linter.LintMessage[][],
    filename: string
  ): Linter.LintMessage[] =>
    messages
      .map((message) =>
        message.filter((message) =>
          getRangesForDiff(getDiffForFile(filename)).some(
            isLineWithinRange(message.line)
          )
        )
      )
      .flat(),

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
  postprocess: (
    messages: Linter.LintMessage[][],
    filename: string
  ): Linter.LintMessage[] =>
    messages
      .map((message) =>
        message.filter((message) =>
          getRangesForDiff(getDiffForFile(filename, STAGED)).some(
            isLineWithinRange(message.line)
          )
        )
      )
      .flat(),

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
