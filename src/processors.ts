import type { Linter } from "eslint";
import { guessBranch } from "./ci";
import type { DiffType } from "./git";
import {
  fetchFromOrigin,
  getDiffFileList,
  getDiffForFile,
  getRangesForDiff,
  getUntrackedFileList,
  hasCleanIndex,
  hasCleanTree,
  readFileFromGit,
} from "./git";
import type { Range } from "./Range";

if (process.env.CI !== undefined) {
  const branch = process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? guessBranch();
  if (branch !== undefined) {
    const branchWithoutOrigin = branch.replace(/^origin\//, "");
    const branchWithOrigin = `origin/${branchWithoutOrigin}`;
    fetchFromOrigin(branchWithoutOrigin);
    process.env.ESLINT_PLUGIN_DIFF_COMMIT = branchWithOrigin;
  }
}

/**
 * Exclude unchanged files from being processed
 *
 * Since we're excluding unchanged files in the post-processor, we can exclude
 * them from being processed in the first place, as a performance optimization.
 * This is increasingly useful the more files there are in the repository.
 */
const getPreProcessor =
  (diffFileList: string[], diffType: DiffType) =>
  (text: string, filename: string) => {
    let untrackedFileList = getUntrackedFileList(diffType);
    const shouldRefresh =
      diffType === "working" &&
      !diffFileList.includes(filename) &&
      !untrackedFileList.includes(filename);
    if (shouldRefresh) {
      untrackedFileList = getUntrackedFileList(diffType, true);
    }
    const shouldBeProcessed =
      process.env.VSCODE_PID !== undefined ||
      diffFileList.includes(filename) ||
      untrackedFileList.includes(filename);

    if (
      diffType === "committed" &&
      shouldBeProcessed &&
      !hasCleanTree(filename)
    ) {
      return [readFileFromGit(filename)];
    }

    return shouldBeProcessed ? [text] : [];
  };

const isLineWithinRange = (line: number) => (range: Range) =>
  range.isWithinRange(line);

/**
 * @internal
 */
const getUnstagedChangesError = (filename: string): [Linter.LintMessage] => {
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
};

const getPostProcessor =
  (diffType: DiffType) =>
  (
    messages: Linter.LintMessage[][],
    filename: string
  ): Linter.LintMessage[] => {
    if (messages.length === 0) {
      // No need to filter, just return
      return [];
    }
    const untrackedFileList = getUntrackedFileList(diffType);
    if (untrackedFileList.includes(filename)) {
      // We don't need to filter the messages of untracked files because they
      // would all be kept anyway, so we return them as-is.
      return messages.flat();
    }

    if (diffType === "staged" && !hasCleanIndex(filename)) {
      return getUnstagedChangesError(filename);
    }

    const rangesForDiff = getRangesForDiff(getDiffForFile(filename, diffType));

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

type ProcessorType = "diff" | "committed" | "staged" | "ci";

const getProcessors = (
  processorType: ProcessorType
): Required<Linter.Processor> => {
  const diffType =
    processorType === "staged" || processorType === "committed"
      ? processorType
      : "working";
  const diffFileList = getDiffFileList(diffType);

  return {
    preprocess: getPreProcessor(diffFileList, diffType),
    postprocess: getPostProcessor(diffType),
    supportsAutofix: processorType !== "committed",
  };
};

const ci = process.env.CI !== undefined ? getProcessors("ci") : {};
const diff = getProcessors("diff");
const staged = getProcessors("staged");
const committed = getProcessors("committed");

const diffConfig: Linter.BaseConfig = {
  plugins: ["diff"],
  overrides: [
    {
      files: ["*"],
      processor: "diff/diff",
    },
  ],
};

const ciConfig: Linter.BaseConfig =
  process.env.CI === undefined
    ? {}
    : {
        plugins: ["diff"],
        overrides: [
          {
            files: ["*"],
            processor: "diff/ci",
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

const committedConfig: Linter.BaseConfig = {
  plugins: ["diff"],
  overrides: [
    {
      files: ["*"],
      processor: "diff/committed",
    },
  ],
};

export {
  ci,
  ciConfig,
  diff,
  diffConfig,
  staged,
  stagedConfig,
  committed,
  committedConfig,
  getUnstagedChangesError,
};
