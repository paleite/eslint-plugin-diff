import type { Linter } from "eslint";
import { guessBranch } from "./ci";
import { PLUGIN_VERSION } from "./version";
import {
  fetchFromOrigin,
  getDiffFileList,
  getDiffForFile,
  getRangesForDiff,
  getUntrackedFileList,
  hasCleanIndex,
} from "./git";
import type { Range } from "./Range";

/**
 * Determines if a git ref looks like a branch name that should be fetched from origin.
 * Returns false for:
 * - Commit SHAs (7-40 hex characters)
 * - Relative refs (HEAD~n, HEAD^, etc.)
 * - Refs already prefixed with origin/
 */
const isBranchName = (ref: string): boolean => {
  // Already has origin/ prefix
  if (ref.startsWith("origin/")) {
    return false;
  }

  // Looks like a commit SHA (7-40 hex characters only)
  if (/^[0-9a-f]{7,40}$/i.test(ref)) {
    return false;
  }

  // Relative refs like HEAD~5, HEAD^, HEAD^^, HEAD~2^, etc.
  if (/^HEAD[~^]/i.test(ref)) {
    return false;
  }

  // HEAD by itself
  if (ref.toUpperCase() === "HEAD") {
    return false;
  }

  // Everything else is treated as a branch name
  return true;
};

if (process.env.CI !== undefined) {
  const ref = process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? guessBranch();
  if (ref !== undefined) {
    if (isBranchName(ref)) {
      // It's a branch name - fetch from origin and use origin/<branch>
      const branchWithoutOrigin = ref.replace(/^origin\//, "");
      const branchWithOrigin = `origin/${branchWithoutOrigin}`;
      fetchFromOrigin(branchWithoutOrigin);
      process.env.ESLINT_PLUGIN_DIFF_COMMIT = branchWithOrigin;
    }
    // For SHAs, relative refs, etc. - leave ESLINT_PLUGIN_DIFF_COMMIT unchanged
    // The git diff command will use it directly
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
  (diffFileList: string[], staged: boolean) =>
  (text: string, filename: string) => {
    let untrackedFileList = getUntrackedFileList(staged);
    const shouldRefresh =
      !diffFileList.includes(filename) && !untrackedFileList.includes(filename);
    if (shouldRefresh) {
      untrackedFileList = getUntrackedFileList(staged, true);
    }
    const shouldBeProcessed =
      process.env.VSCODE_PID !== undefined ||
      diffFileList.includes(filename) ||
      untrackedFileList.includes(filename);

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
  (staged: boolean) =>
  (
    messages: Linter.LintMessage[][],
    filename: string
  ): Linter.LintMessage[] => {
    if (messages.length === 0) {
      // No need to filter, just return
      return [];
    }
    const untrackedFileList = getUntrackedFileList(staged);
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

type ProcessorType = "diff" | "staged" | "ci";

const getProcessors = (processorType: ProcessorType): Linter.Processor => {
  const staged = processorType === "staged";
  const diffFileList = getDiffFileList(staged);

  return {
    meta: {
      name: `diff/${processorType}`,
      version: PLUGIN_VERSION,
    },
    preprocess: getPreProcessor(diffFileList, staged),
    postprocess: getPostProcessor(staged),
    supportsAutofix: true,
  };
};

const ci = process.env.CI !== undefined ? getProcessors("ci") : {};
const diff = getProcessors("diff");
const staged = getProcessors("staged");

export { ci, diff, staged, getUnstagedChangesError };
