import type { Linter } from "eslint";

import { guessBranch } from "./ci";
import {
  fetchFromOrigin,
  getDiffFileList,
  getDiffForFile,
  getRangesForDiff,
  getUntrackedFileList,
  hasCleanIndex,
} from "./git";
import type { Range } from "./Range";

const getOriginTrackingRefForGuessedBranch = (
  guessedBranch: string,
): string => {
  const branchWithoutRemote = guessedBranch
    .replace(/^refs\/heads\//, "")
    .replace(/^refs\/remotes\/origin\//, "")
    .replace(/^origin\//, "");

  return `origin/${branchWithoutRemote}`;
};

if (process.env["CI"] !== undefined) {
  const providedCommit = process.env["ESLINT_PLUGIN_DIFF_COMMIT"];
  const guessedBranch =
    providedCommit === undefined ? guessBranch() : undefined;

  if (guessedBranch !== undefined) {
    const branchForDiff = getOriginTrackingRefForGuessedBranch(guessedBranch);
    const branchWithoutOrigin = branchForDiff.replace(/^origin\//, "");
    fetchFromOrigin(branchWithoutOrigin);

    // Make the guessed branch available to git diff calls without
    // changing explicitly provided values.
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] = branchForDiff;
  }
}

/**
 * Exclude unchanged files from being processed
 *
 * Since we're excluding unchanged files in the post-processor, we can exclude
 * them from being processed in the first place, as a performance optimization.
 * This is increasingly useful the more files there are in the repository.
 */
const getPreProcessor = (diffFileList: string[], staged: boolean) => {
  let diffFileListCache = diffFileList;
  let diffFileSetCache = new Set(diffFileListCache);

  return (text: string, filename: string) => {
    const isInDiffFileList = diffFileSetCache.has(filename);

    if (process.env["VSCODE_PID"] !== undefined && !isInDiffFileList) {
      // Editors can invoke ESLint before our initial diff snapshot includes the
      // latest edit. Refresh once to avoid "second edit" diagnostics.
      diffFileListCache = getDiffFileList(staged);
      diffFileSetCache = new Set(diffFileListCache);
    }

    let untrackedFileList = getUntrackedFileList(staged);
    let untrackedFileSet = new Set(untrackedFileList);
    const shouldRefresh =
      !diffFileSetCache.has(filename) && !untrackedFileSet.has(filename);
    if (shouldRefresh) {
      untrackedFileList = getUntrackedFileList(staged, true);
      untrackedFileSet = new Set(untrackedFileList);
    }

    const shouldBeProcessed =
      process.env["VSCODE_PID"] !== undefined ||
      diffFileSetCache.has(filename) ||
      untrackedFileSet.has(filename);

    return shouldBeProcessed ? [text] : [];
  };
};

const isLineWithinRange = (line: number) => (range: Range) =>
  range.isWithinRange(line);

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
  (staged: boolean) =>
  (
    messages: Linter.LintMessage[][],
    filename: string,
  ): Linter.LintMessage[] => {
    if (messages.length === 0) {
      // No need to filter, just return
      return [];
    }
    const untrackedFileSet = new Set(getUntrackedFileList(staged));
    if (untrackedFileSet.has(filename)) {
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
          isLineWithinRange(line),
        );

        return isLineWithinSomeRange;
      });

      return filteredMessage;
    });
  };

type ProcessorType = "diff" | "staged" | "ci";
type DiffProcessor = Linter.Processor &
  Required<
    Pick<Linter.Processor, "preprocess" | "postprocess" | "supportsAutofix">
  >;

const getProcessors = (processorType: ProcessorType): DiffProcessor => {
  const staged = processorType === "staged";
  const diffFileList = getDiffFileList(staged);

  return {
    preprocess: getPreProcessor(diffFileList, staged),
    postprocess: getPostProcessor(staged),
    supportsAutofix: true,
  };
};

const getNoOpProcessor = (): DiffProcessor => ({
  preprocess: (text: string) => [text],
  postprocess: (messages: Linter.LintMessage[][]) => messages.flat(),
  supportsAutofix: true,
});

const ci =
  process.env["CI"] !== undefined ? getProcessors("ci") : getNoOpProcessor();
const diff = getProcessors("diff");
const staged = getProcessors("staged");

const diffConfig: Linter.BaseConfig = {
  plugins: ["diff"],
  overrides: [
    {
      files: ["*"],
      processor: "diff/diff",
    },
  ],
};

const ciConfig: Linter.BaseConfig = {
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

export {
  ci,
  ciConfig,
  diff,
  diffConfig,
  getUnstagedChangesError,
  staged,
  stagedConfig,
};
