import {
  getDiffForFile,
  getRangesForDiff,
  getDiffFileList,
  Range,
} from "./git";
import { Linter } from "eslint";

const STAGED = true;

const isLineWithinRange = (line: number) => (range: Range) =>
  range.isWithinRange(line);
let fileList: string[];

const diff = {
  preprocess: (
    text: string,
    filename: string
  ): { text: string; filename: string }[] => {
    if (
      (fileList ? fileList : (fileList = getDiffFileList())).includes(filename)
    ) {
      return [{ text, filename }];
    } else {
      return [];
    }
  },

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
  preprocess: (
    text: string,
    filename: string
  ): { text: string; filename: string }[] => {
    if (
      (fileList ? fileList : (fileList = getDiffFileList(true))).includes(
        filename
      )
    ) {
      return [{ text, filename }];
    } else {
      return [];
    }
  },
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
