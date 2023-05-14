import type { Linter } from "eslint";
import type { Range } from "./Range";
import { guessBranch } from "./ci";
import {
  fetchFromOrigin,
  getDiffFileList,
  getDiffForFile,
  getRangesForDiff,
  getUntrackedFileList,
  hasCleanIndex,
} from "./git";
import { log } from "./logging";

const isCiEnvironment = process.env.CI !== undefined;
log("Are we in a CI env?", isCiEnvironment ? "Yes" : "No");
if (isCiEnvironment) {
  const branch = process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? guessBranch();
  const hasBranch = branch !== undefined;
  log("Is the branch defined?", hasBranch ? "Yes" : "No");
  if (hasBranch) {
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
  (diffFileList: string[], staged: boolean) =>
  (text: string, filename: string) => {
    let untrackedFileList = getUntrackedFileList(staged);
    const includedByDiffList = diffFileList.includes(filename);
    const includedByUntrackedList = untrackedFileList.includes(filename);
    const shouldRefresh = !includedByDiffList && !includedByUntrackedList;
    if (shouldRefresh) {
      log("Refreshing untracked file list");
      untrackedFileList = getUntrackedFileList(staged, true);
    }
    const isInDiffFileList = diffFileList.includes(filename);
    const isInUntrackedFileList = untrackedFileList.includes(filename);
    const shouldBeProcessed =
      process.env.VSCODE_CLI !== undefined ||
      isInDiffFileList ||
      isInUntrackedFileList;

    log(
      isInDiffFileList
        ? "Found changes in"
        : isInUntrackedFileList
        ? "Found untracked file"
        : "Found unchanged file",
      filename
    );

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

  log("File has unstaged changes");

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

const getPostProcessor = (staged = false) => {
  log(
    "Creating post-processor for",
    staged ? "staged files only" : "changed files"
  );

  return (
    messages: Linter.LintMessage[][],
    filename: string
  ): Linter.LintMessage[] => {
    log("Processing messages for", filename);
    if (messages.length === 0) {
      log("Skipping file because it has no messages");
      // No need to filter, just return
      return [];
    }

    const untrackedFileList = getUntrackedFileList(staged);
    if (untrackedFileList.includes(filename)) {
      log("Skipping file because it is untracked");
      // We don't need to filter the messages of untracked files because they
      // would all be kept anyway, so we return them as-is.
      return messages.flat();
    }

    if (staged && !hasCleanIndex(filename)) {
      log("Found a partially staged file");
      return getUnstagedChangesError(filename);
    }

    const rangesForDiff = getRangesForDiff(
      getDiffForFile(
        process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? "HEAD",
        filename,
        staged
      )
    );

    return messages.flatMap((message) => {
      const filteredMessage = message.filter(({ fatal, line }) => {
        if (fatal === true) {
          log("Found a fatal error-message");
          return true;
        }

        const isLineWithinSomeRange = rangesForDiff.some(
          isLineWithinRange(line)
        );

        log("Is the message for a changed line?", isLineWithinSomeRange);
        return isLineWithinSomeRange;
      });

      log("Removed", message.length - filteredMessage.length, "messages");
      return filteredMessage;
    });
  };
};

type ProcessorType = "diff" | "staged" | "ci";

const getProcessors = (
  processorType: ProcessorType
): Required<Linter.Processor> => {
  log("Creating config for processor type", JSON.stringify(processorType));
  const staged = processorType === "staged";
  const diffFileList = getDiffFileList(
    process.env.ESLINT_PLUGIN_DIFF_COMMIT ?? "HEAD",
    staged
  );

  return {
    preprocess: getPreProcessor(diffFileList, staged),
    postprocess: getPostProcessor(staged),
    supportsAutofix: true,
  };
};

const ci = isCiEnvironment ? getProcessors("ci") : {};
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

const ciConfig: Linter.BaseConfig = isCiEnvironment
  ? {
      plugins: ["diff"],
      overrides: [
        {
          files: ["*"],
          processor: "diff/ci",
        },
      ],
    }
  : {};

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
