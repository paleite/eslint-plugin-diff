import type { Linter } from "eslint";

import { resolveCiContext } from "./ci";
import type { ChangedFile, DiffSnapshot, GitComparison } from "./git";
import {
  canonicalizeFilename,
  getChangedLineRanges,
  getDiffSnapshot,
  getUnstagedState,
  resolveCiBase,
  resolveExactBase,
} from "./git";
import type { Range } from "./Range";
import type { DiffProcessor, ProcessorMode, ProcessorOptions } from "./types";

const VALID_MODES = new Set<ProcessorMode>(["diff", "ci", "staged"]);

type NormalizedProcessorOptions = {
  mode: ProcessorMode;
  rulesReportedOutsideChangedLines: ReadonlySet<string>;
};

type ResolvedMode =
  | { kind: "noop" }
  | {
      kind: "active";
      comparison: GitComparison;
      includeUntracked: boolean;
    };

const normalizeProcessorOptions = (
  options: ProcessorOptions,
): NormalizedProcessorOptions => {
  if (typeof options !== "object" || options === null) {
    throw new TypeError(
      "eslint-plugin-diff processor options must be an object.",
    );
  }
  if (!VALID_MODES.has(options.mode)) {
    throw new TypeError(
      `eslint-plugin-diff processor mode must be one of: diff, ci, staged. Received '${String(options.mode)}'.`,
    );
  }

  const rules = options.rulesReportedOutsideChangedLines ?? [];
  if (!Array.isArray(rules)) {
    throw new TypeError(
      "rulesReportedOutsideChangedLines must be an array of non-empty rule IDs.",
    );
  }
  for (const ruleId of rules) {
    if (typeof ruleId !== "string" || ruleId.length === 0) {
      throw new TypeError(
        "rulesReportedOutsideChangedLines must contain only non-empty strings.",
      );
    }
  }

  return {
    mode: options.mode,
    rulesReportedOutsideChangedLines: new Set(rules),
  };
};

const resolveMode = (mode: ProcessorMode): ResolvedMode => {
  if (mode === "ci" && process.env["CI"] === undefined) {
    return { kind: "noop" };
  }

  const explicitBase = process.env["ESLINT_PLUGIN_DIFF_COMMIT"];

  if (mode === "diff") {
    return {
      kind: "active",
      comparison: {
        kind: "working-tree",
        baseCommit: resolveExactBase(explicitBase ?? "HEAD", false),
      },
      includeUntracked: true,
    };
  }

  if (mode === "staged") {
    return {
      kind: "active",
      comparison: {
        kind: "index",
        baseCommit: resolveExactBase(explicitBase ?? "HEAD", false),
      },
      includeUntracked: false,
    };
  }

  if (explicitBase !== undefined && explicitBase.length > 0) {
    return {
      kind: "active",
      comparison: {
        kind: "commit",
        baseCommit: resolveExactBase(explicitBase, true),
        headCommit: "HEAD",
      },
      includeUntracked: true,
    };
  }

  const context = resolveCiContext();
  if (context === undefined) {
    return { kind: "noop" };
  }

  return {
    kind: "active",
    comparison: {
      kind: "commit",
      baseCommit: resolveCiBase(context),
      headCommit: "HEAD",
    },
    includeUntracked: true,
  };
};

const getUnstagedChangesError = (filename: string): Linter.LintMessage => ({
  fatal: true,
  message: `${filename} has unstaged changes. Please stage or remove the changes.`,
  severity: 2,
  column: 0,
  line: 0,
  ruleId: null,
});

const shouldKeepMessage = (
  message: Linter.LintMessage,
  changedFile: ChangedFile,
  changedRanges: readonly Range[],
  rulesReportedOutsideChangedLines: ReadonlySet<string>,
  includeFixes: boolean,
): boolean => {
  if (message.fatal === true) {
    return true;
  }
  if (includeFixes && message.fix !== undefined) {
    return true;
  }
  if (
    message.ruleId !== null &&
    rulesReportedOutsideChangedLines.has(message.ruleId)
  ) {
    return true;
  }
  if (changedFile.allLinesChanged) {
    return true;
  }

  const endLineExclusive = (message.endLine ?? message.line) + 1;
  return changedRanges.some((range) =>
    range.intersects(message.line, endLineExclusive),
  );
};

const createDiffProcessor = (
  options: NormalizedProcessorOptions,
): DiffProcessor => {
  const includeFixes =
    process.env["ESLINT_PLUGIN_DIFF_INCLUDE_FIXES"] === "true";

  let resolvedMode: ResolvedMode | null = null;
  let snapshot: DiffSnapshot | null = null;

  const getResolvedMode = (): ResolvedMode => {
    resolvedMode ??= resolveMode(options.mode);
    return resolvedMode;
  };

  const createSnapshot = (
    resolved: Extract<ResolvedMode, { kind: "active" }>,
  ): DiffSnapshot =>
    getDiffSnapshot(resolved.comparison, {
      includeUntracked: resolved.includeUntracked,
    });

  const getSnapshot = (
    resolved: Extract<ResolvedMode, { kind: "active" }>,
    refresh: boolean,
  ): DiffSnapshot => {
    if (refresh || snapshot === null) {
      snapshot = createSnapshot(resolved);
    }
    return snapshot;
  };

  const preprocess: DiffProcessor["preprocess"] = (
    text: string,
    filename: string,
  ) => {
    const resolved = getResolvedMode();
    if (resolved.kind === "noop") {
      return [text];
    }

    const currentSnapshot = getSnapshot(
      resolved,
      process.env["VSCODE_PID"] !== undefined,
    );
    const canonicalFilename = canonicalizeFilename(filename);
    return currentSnapshot.files.has(canonicalFilename) ? [text] : [];
  };

  const postprocess: DiffProcessor["postprocess"] = (
    messages: Linter.LintMessage[][],
    filename: string,
  ) => {
    const resolved = getResolvedMode();
    if (resolved.kind === "noop") {
      return messages.flat();
    }

    const currentSnapshot = getSnapshot(resolved, false);

    const canonicalFilename = canonicalizeFilename(filename);
    const changedFile = currentSnapshot.files.get(canonicalFilename);
    if (changedFile === undefined) {
      return [];
    }

    if (
      options.mode === "staged" &&
      getUnstagedState(
        currentSnapshot.repositoryRoot,
        changedFile.relativePath,
      ) === "dirty"
    ) {
      return [getUnstagedChangesError(filename)];
    }

    const flatMessages = messages.flat();
    let changedRanges: readonly Range[] | null = null;

    return flatMessages.filter((message) => {
      const needsRanges =
        message.fatal !== true &&
        !(includeFixes && message.fix !== undefined) &&
        !(
          message.ruleId !== null &&
          options.rulesReportedOutsideChangedLines.has(message.ruleId)
        ) &&
        !changedFile.allLinesChanged;

      if (needsRanges && changedRanges === null) {
        changedRanges = getChangedLineRanges(currentSnapshot, changedFile);
      }

      return shouldKeepMessage(
        message,
        changedFile,
        changedRanges ?? [],
        options.rulesReportedOutsideChangedLines,
        includeFixes,
      );
    });
  };

  return {
    preprocess,
    postprocess,
    supportsAutofix: true,
  };
};

const createProcessor = (options: ProcessorOptions): DiffProcessor =>
  createDiffProcessor(normalizeProcessorOptions(options));

const getProcessorCallbacks = (processor: Linter.Processor) => ({
  preprocess: (text: string, filename: string) =>
    processor.preprocess?.(text, filename) ?? [text],
  postprocess: (
    messages: Linter.LintMessage[][],
    filename: string,
  ): Linter.LintMessage[] =>
    processor.postprocess?.(messages, filename) ?? messages.flat(),
  supportsAutofix: processor.supportsAutofix === true,
});

const composeProcessor = (
  processor: Linter.Processor,
  options: ProcessorOptions,
): DiffProcessor => {
  const diffProcessor = createProcessor(options);
  const baseProcessor = getProcessorCallbacks(processor);
  const admittedFiles = new Set<string>();

  return {
    ...processor,
    preprocess: (text: string, filename: string) => {
      const diffTexts = diffProcessor.preprocess(text, filename);
      const canonicalFilename = canonicalizeFilename(filename);
      if (diffTexts.length === 0) {
        admittedFiles.delete(canonicalFilename);
        return [];
      }

      admittedFiles.add(canonicalFilename);
      const normalizedText = diffTexts[0] as string;
      return baseProcessor.preprocess(normalizedText, filename);
    },
    postprocess: (messages: Linter.LintMessage[][], filename: string) => {
      const canonicalFilename = canonicalizeFilename(filename);
      if (!admittedFiles.delete(canonicalFilename)) {
        return [];
      }
      const baseMessages = baseProcessor.postprocess(messages, filename);
      return diffProcessor.postprocess([baseMessages], filename);
    },
    supportsAutofix:
      diffProcessor.supportsAutofix && baseProcessor.supportsAutofix,
  };
};

export {
  composeProcessor,
  createProcessor,
  getUnstagedChangesError,
  normalizeProcessorOptions,
  shouldKeepMessage,
};
