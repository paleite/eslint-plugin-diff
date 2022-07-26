import type { Linter } from "eslint";
import {
  getDiffFileList,
  getDiffForFile,
  getRangesForDiff,
  getUntrackedFileList,
  hasCleanIndex,
} from "./git";
import type { Range } from "./Range";

const STAGED = true;

/**
 * Exclude unchanged files from being processed
 *
 * Since we're excluding unchanged files in the post-processor, we can exclude
 * them from being processed in the first place, as a performance optimization.
 * This is increasingly useful the more files there are in the repository.
 */
const getPreProcessor = (staged = false) => {
  const untrackedFileList = getUntrackedFileList(staged);
  const diffFileList = getDiffFileList(staged);

  return (text: string, filename: string) => {
    const shouldBeProcessed =
      process.env.VSCODE_CLI !== undefined ||
      diffFileList.includes(filename) ||
      untrackedFileList.includes(filename);

    return shouldBeProcessed ? [text] : [];
  };
};

const isLineWithinRange = (line: number) => (range: Range) =>
  range.isWithinRange(line);

function getUnstagedChangesError(filename: string) {
  // When we only want to diff staged files, but the file is partially
  // staged, the ranges of the staged diff might not match the ranges of the
  // unstaged diff and could cause a conflict, so we return a fatal
  // error-message instead.

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

const getPostProcessor = (staged = false) => {
  const untrackedFileList = getUntrackedFileList(staged);

  return (
    messages: Linter.LintMessage[][],
    filename: string
  ): Linter.LintMessage[] => {
    if (messages.length === 0) {
      // No need to filter, just return
      return [];
    }

    if (untrackedFileList.includes(filename)) {
      // We don't need to filter the messages of untracked files because they
      // would all be kept anyway, so we return them as-is.
      return messages.flat();
    }

    if (staged && !hasCleanIndex(filename)) {
      return getUnstagedChangesError(filename);
    }

    const rangesForDiff = getRangesForDiff(getDiffForFile(filename, staged));

    return messages.flatMap((message) => {
      const filteredMessage = message.filter(({ fatal, line }) => {
        if (fatal === true) {
          return true;
        }

        const isLineWithinSomeRange = rangesForDiff.some(
          isLineWithinRange(line)
        );

        return isLineWithinSomeRange;
      });

      return filteredMessage;
    });
  };
};

const getProcessors = (staged = false): Required<Linter.Processor> => ({
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
