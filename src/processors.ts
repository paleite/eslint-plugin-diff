import type { Linter } from "eslint";
import type { Range } from "./git";
import {
  getDiffFileList,
  getDiffForFile,
  getRangesForDiff,
  getUntrackedFileList,
  hasCleanIndex,
} from "./git";

const STAGED = true;

/**
 * Returns a boolean whether we are in the context
 * of a Vscode plugin or not.
 */
const isVsCodePluginContext = (): boolean =>
  process.env.VSCODE_PID !== undefined;

/**
 * Exclude unchanged files from being processed
 *
 * Since we're excluding unchanged files in the post-processor, we can exclude
 * them from being processed in the first place, as a performance optimization.
 * This is increasingly useful the more files there are in the repository.
 */
const getPreProcessor =
  (staged = false) =>
  (text: string, filename: string) => {
    const shouldBeProcessed =
      process.env.VSCODE_CLI !== undefined ||
      isVsCodePluginContext() ||
      !staged ||
      getDiffFileList().includes(filename);
    return shouldBeProcessed ? [text] : [];
  };

const isLineWithinRange = (line: number) => (range: Range) => {
  return range.isWithinRange(line);
};

const getPostProcessor =
  (staged = false) =>
  (
    messages: Linter.LintMessage[][],
    filename: string
  ): Linter.LintMessage[] => {
    if (!staged && getUntrackedFileList(staged).includes(filename)) {
      return messages.flat();
    }

    if (staged && !hasCleanIndex(filename)) {
      const fatal = true;
      const message = `${filename} has unstaged changes. Please stage or remove the changes.`;
      const severity: Linter.Severity = 2;
      const fatalError: Linter.LintMessage = {
        fatal,
        message,
        severity,
        column: 0,
        line: 0,
        ruleId: null,
      };
      return [fatalError];
    }

    return messages
      .map((message) => {
        const filteredMessage = message.filter(({ fatal, line }) => {
          if (fatal === true) {
            return true;
          }

          const isLineWithinSomeRange = getRangesForDiff(
            getDiffForFile(filename, staged)
          ).some(isLineWithinRange(line));

          return isLineWithinSomeRange;
        });

        return filteredMessage;
      })
      .reduce((a, b) => a.concat(b), []);
  };

const getProcessors = (staged = false): Linter.Processor => ({
  preprocess: getPreProcessor(staged),
  postprocess: getPostProcessor(staged),
  supportsAutofix: true,
});

const diff = getProcessors();
const staged = getProcessors(STAGED);

const diffConfig: Linter.BaseConfig = {
  plugins: ["diff"],
  overrides: [
    {
      files: ["*"],
      processor: "diff/diff",
    },
  ],
};

const stagedConfig: Linter.BaseConfig = {
  plugins: ["diff"],
  overrides: [
    {
      files: ["*"],
      processor: "diff/staged",
    },
  ],
};

export { diff, diffConfig, staged, stagedConfig };
