import type { Linter } from "eslint";
import {
  getDiffFileList,
  getDiffForFile,
  getIgnorePatterns,
  getRangesForDiff,
  Range,
} from "./git";

const STAGED = true;

const isLineWithinRange = (line: number) => (range: Range) =>
  range.isWithinRange(line);

const diff = {
  postprocess: (
    messages: Linter.LintMessage[][],
    filename: string
  ): Linter.LintMessage[] => {
    if (!getDiffFileList().includes(filename)) {
      // console.log( "🧠  skipping " + JSON.stringify(filename) + " because it's not in the diff list" );
      return [];
    }
    const result = messages
      .map((message) => {
        // console.log("diff/diff", message, JSON.stringify(filename));
        return message.filter(({ fatal, line }) => {
          if (fatal) {
            // console.log("❌  fatal error in " + JSON.stringify(filename));
            return fatal;
          }

          if (
            !getRangesForDiff(getDiffForFile(filename)).some(
              isLineWithinRange(line)
            )
          ) {
            // console.log( "🔵  skipping " + JSON.stringify(filename) + " because it's not in the diff list" );
          }

          return (
            fatal ||
            getRangesForDiff(getDiffForFile(filename)).some(
              isLineWithinRange(line)
            )
          );
        });
      })
      .reduce((a, b) => a.concat(b), []);
    // console.log("diff kjrngkjsngksnj", { result, filename, messages });
    return result;
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
  preprocess: (
    text: string,
    filename: string
  ): ({ text: string; filename: string } & Record<any, any>)[] => {
    // console.log({ text: text, filename: filename, lol: "zooooooooooomg" });
    return getDiffFileList(STAGED).includes(filename)
      ? [{ text, filename }]
      : [];
  },

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
  ignorePatterns: getIgnorePatterns(STAGED),
};

export { diff, diffConfig, staged, stagedConfig };
