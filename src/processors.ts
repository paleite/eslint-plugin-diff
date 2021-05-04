import type { Linter } from "eslint";
import type { Range } from "./git";
import {
  getDiffFileList,
  getDiffForFile,
  getRangesForDiff,
  hasCleanIndex,
} from "./git";

const STAGED = true;

/**
 * Exclude unchanged files from being processed
 *
 * Since we're excluding unchanged files in the post-processor, we can exclude
 * them from being processed in the first place, as a performance optimization.
 * This is increasingly useful the more files there are in the repository.
 */
const getPreProcessor = (staged = false) => (
  text: string,
  filename: string
) => {
  const shouldBeProcessed = getDiffFileList(staged).includes(filename);

  return shouldBeProcessed ? [text] : [];
};

const isLineWithinRange = (line: number) => (range: Range) =>
  range.isWithinRange(line);

const getPostProcessor = (staged = false) => (
  messages: Linter.LintMessage[][],
  filename: string
): Linter.LintMessage[] => {
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
      const filteredMessage = message.reduce<Linter.LintMessage[]>((acc, m) => {
        const { fatal, line } = m;
        if (fatal === true) {
          return [...acc, m];
        }
        const isLineWithinSomeRange = getRangesForDiff(
          getDiffForFile(filename, staged)
        ).some(isLineWithinRange(line));

        const decreasedSeverity: Linter.Severity = m.severity === 2 ? 1 : 0;
        if (!isLineWithinSomeRange && m.severity === 0) {
          return acc;
        }

        const nextSeverity: Linter.Severity = isLineWithinSomeRange
          ? m.severity
          : decreasedSeverity;

        return [...acc, { ...m, severity: nextSeverity }];
      }, []);

      return filteredMessage;
    })
    .reduce((a, b) => a.concat(b), []);
};

const getProcessors = (staged = false) => ({
  preprocess: getPreProcessor(staged),
  postprocess: getPostProcessor(staged),
  supportsAutofix: true,
});

const diff = getProcessors();
const staged = getProcessors(STAGED);

const diffConfig = {
  plugins: ["diff"],
  overrides: [
    {
      files: ["*"],
      processor: "diff/diff",
    },
  ],
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
