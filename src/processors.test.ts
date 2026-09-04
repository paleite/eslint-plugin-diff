import type * as GitModule from "./git.js";

jest.mock("./git", () => {
  const actualGit = jest.requireActual("./git") as unknown as typeof GitModule;
  return {
    ...actualGit,
    canonicalizeFilename: jest.fn((filename: string) => filename),
    getChangedLineRanges: jest.fn(),
    getDiffSnapshot: jest.fn(),
    getUnstagedState: jest.fn(),
    resolveCiBase: jest.fn(),
    resolveExactBase: jest.fn((commitish: string) => commitish),
  };
});

jest.mock("./ci", () => ({
  resolveCiContext: jest.fn(),
}));

import type { Linter } from "eslint";

import packageJson from "../package.json";
import * as ci from "./ci";
import * as git from "./git";
import {
  composeProcessor,
  createProcessor,
  getUnstagedChangesError,
  normalizeProcessorOptions,
  shouldKeepMessage,
} from "./processors";
import { Range } from "./Range";

const mockedGit = jest.mocked(git);
const mockedCi = jest.mocked(ci);
const filename = "/repo/file.ts";
const changedFile: git.ChangedFile = {
  status: "modified",
  filename,
  relativePath: "file.ts",
  allLinesChanged: false,
};
const snapshot: git.DiffSnapshot = {
  repositoryRoot: "/repo",
  comparison: { kind: "working-tree", baseCommit: "HEAD" },
  files: new Map([[filename, changedFile]]),
};

const message = (
  overrides: Partial<Linter.LintMessage> = {},
): Linter.LintMessage => ({
  ruleId: "example/rule",
  severity: 2,
  message: "example",
  line: 3,
  column: 1,
  ...overrides,
});

const OLD_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...OLD_ENV };
  delete process.env["CI"];
  delete process.env["VSCODE_PID"];
  delete process.env["ESLINT_PLUGIN_DIFF_COMMIT"];
  delete process.env["ESLINT_PLUGIN_DIFF_INCLUDE_FIXES"];
  mockedGit.getDiffSnapshot.mockReturnValue(snapshot);
  mockedGit.getChangedLineRanges.mockReturnValue([new Range(3, 4)]);
  mockedGit.getUnstagedState.mockReturnValue("clean");
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe("processor options", () => {
  it("requires an options object and explicit valid mode", () => {
    expect(() => normalizeProcessorOptions(null as never)).toThrow(TypeError);
    expect(() => normalizeProcessorOptions(undefined as never)).toThrow(
      TypeError,
    );
    expect(() =>
      normalizeProcessorOptions({ mode: "invalid" } as never),
    ).toThrow(/mode/u);
  });

  it("rejects a non-array outside-line rule configuration", () => {
    expect(() =>
      normalizeProcessorOptions({
        mode: "diff",
        rulesReportedOutsideChangedLines: "example/rule" as never,
      }),
    ).toThrow(/array/u);
  });

  it("rejects non-string outside-line rule IDs", () => {
    expect(() =>
      normalizeProcessorOptions({
        mode: "diff",
        rulesReportedOutsideChangedLines: [123 as never],
      }),
    ).toThrow(/non-empty strings/u);
  });

  it("validates outside-line rule IDs and de-duplicates them", () => {
    expect(() =>
      normalizeProcessorOptions({
        mode: "diff",
        rulesReportedOutsideChangedLines: [""],
      }),
    ).toThrow(/non-empty/u);
    expect(
      normalizeProcessorOptions({
        mode: "diff",
        rulesReportedOutsideChangedLines: ["a/rule", "a/rule"],
      }).rulesReportedOutsideChangedLines.size,
    ).toBe(1);
  });

  it("defaults outside-line rules to empty", () => {
    expect(
      normalizeProcessorOptions({ mode: "diff" })
        .rulesReportedOutsideChangedLines.size,
    ).toBe(0);
  });
});

describe("createProcessor", () => {
  it("exposes serializable processor metadata", () => {
    expect(createProcessor({ mode: "diff" }).meta).toEqual({
      name: packageJson.name,
      version: packageJson.version,
    });
  });

  it("does no Git work during construction", () => {
    createProcessor({ mode: "diff" });
    expect(mockedGit.resolveExactBase).not.toHaveBeenCalled();
    expect(mockedGit.getDiffSnapshot).not.toHaveBeenCalled();
  });

  it("initializes lazily and skips unchanged files", () => {
    const processor = createProcessor({ mode: "diff" });
    expect(processor.preprocess("text", filename)).toEqual(["text"]);
    expect(mockedGit.resolveExactBase).toHaveBeenCalledWith("HEAD", false);
    expect(mockedGit.getDiffSnapshot).toHaveBeenCalledTimes(1);
    expect(processor.preprocess("text", "/repo/unchanged.ts")).toEqual([]);
    expect(mockedGit.getDiffSnapshot).toHaveBeenCalledTimes(1);
  });

  it("uses explicit local bases for diff and staged modes", () => {
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] = "base-ref";
    mockedGit.resolveExactBase.mockReturnValue("resolved-base");

    createProcessor({ mode: "diff" }).preprocess("text", filename);
    expect(mockedGit.resolveExactBase).toHaveBeenLastCalledWith(
      "base-ref",
      false,
    );
    expect(mockedGit.getDiffSnapshot).toHaveBeenLastCalledWith(
      { kind: "working-tree", baseCommit: "resolved-base" },
      { includeUntracked: true },
    );

    createProcessor({ mode: "staged" }).preprocess("text", filename);
    expect(mockedGit.resolveExactBase).toHaveBeenLastCalledWith(
      "base-ref",
      false,
    );
    expect(mockedGit.getDiffSnapshot).toHaveBeenLastCalledWith(
      { kind: "index", baseCommit: "resolved-base" },
      { includeUntracked: false },
    );
  });

  it("refreshes repository classification on every editor preprocess", () => {
    process.env["VSCODE_PID"] = "123";
    const processor = createProcessor({ mode: "diff" });
    processor.preprocess("text", filename);
    processor.preprocess("text", filename);
    expect(mockedGit.getDiffSnapshot).toHaveBeenCalledTimes(2);
  });

  it("keeps CI as full lint outside CI without running Git", () => {
    const processor = createProcessor({ mode: "ci" });
    expect(processor.preprocess("text", filename)).toEqual(["text"]);
    expect(processor.postprocess([[message()]], filename)).toEqual([message()]);
    expect(mockedGit.getDiffSnapshot).not.toHaveBeenCalled();
  });

  it("keeps non-PR CI as full lint", () => {
    process.env["CI"] = "true";
    mockedCi.resolveCiContext.mockReturnValue(undefined);
    const processor = createProcessor({ mode: "ci" });
    expect(processor.preprocess("text", filename)).toEqual(["text"]);
    expect(mockedGit.getDiffSnapshot).not.toHaveBeenCalled();
  });

  it("uses an explicit CI comparison point exactly", () => {
    process.env["CI"] = "true";
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] = "abc123";
    mockedGit.resolveExactBase.mockReturnValue("resolved-sha");
    const processor = createProcessor({ mode: "ci" });
    processor.preprocess("text", filename);
    expect(mockedGit.resolveExactBase).toHaveBeenCalledWith("abc123", true);
    expect(mockedGit.resolveCiBase).not.toHaveBeenCalled();
    expect(mockedGit.getDiffSnapshot).toHaveBeenCalledWith(
      { kind: "commit", baseCommit: "resolved-sha", headCommit: "HEAD" },
      { includeUntracked: true },
    );
  });

  it("treats an empty explicit CI comparison point as absent", () => {
    process.env["CI"] = "true";
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] = "";
    const context = { provider: "github" as const, baseRef: "main" };
    mockedCi.resolveCiContext.mockReturnValue(context);
    mockedGit.resolveCiBase.mockReturnValue("merge-base");
    const processor = createProcessor({ mode: "ci" });
    processor.preprocess("text", filename);
    expect(mockedGit.resolveCiBase).toHaveBeenCalledWith(context);
    expect(mockedGit.resolveExactBase).not.toHaveBeenCalledWith("", true);
  });

  it("uses provider merge-base resolution when CI autodetects a PR", () => {
    process.env["CI"] = "true";
    const context = { provider: "github" as const, baseRef: "main" };
    mockedCi.resolveCiContext.mockReturnValue(context);
    mockedGit.resolveCiBase.mockReturnValue("merge-base");
    const processor = createProcessor({ mode: "ci" });
    processor.preprocess("text", filename);
    expect(mockedGit.resolveCiBase).toHaveBeenCalledWith(context);
  });

  it("staged mode excludes untracked files and reports partial staging", () => {
    mockedGit.resolveExactBase.mockReturnValue("resolved-sha");
    const stagedSnapshot: git.DiffSnapshot = {
      ...snapshot,
      comparison: { kind: "index", baseCommit: "HEAD" },
    };
    mockedGit.getDiffSnapshot.mockReturnValue(stagedSnapshot);
    mockedGit.getUnstagedState.mockReturnValue("dirty");
    const processor = createProcessor({ mode: "staged" });
    processor.preprocess("text", filename);
    expect(mockedGit.getDiffSnapshot).toHaveBeenCalledWith(
      { kind: "index", baseCommit: "resolved-sha" },
      { includeUntracked: false },
    );
    expect(processor.postprocess([[message()]], filename)).toEqual([
      getUnstagedChangesError(filename),
    ]);
  });

  it("filters staged messages normally when the working tree matches the index", () => {
    const stagedSnapshot: git.DiffSnapshot = {
      ...snapshot,
      comparison: { kind: "index", baseCommit: "HEAD" },
    };
    mockedGit.getDiffSnapshot.mockReturnValue(stagedSnapshot);
    mockedGit.getUnstagedState.mockReturnValue("clean");
    const processor = createProcessor({ mode: "staged" });
    processor.preprocess("text", filename);
    expect(processor.postprocess([[message()]], filename)).toEqual([message()]);
  });

  it("reuses changed ranges across multiple ordinary diagnostics", () => {
    const processor = createProcessor({ mode: "diff" });
    processor.preprocess("text", filename);
    const first = message({ line: 3 });
    const second = message({ line: 3, message: "second" });
    expect(processor.postprocess([[first, second]], filename)).toEqual([
      first,
      second,
    ]);
    expect(mockedGit.getChangedLineRanges).toHaveBeenCalledTimes(1);
  });

  it("bypasses range lookup for fatal and whole-file diagnostics", () => {
    const wholeFile: git.ChangedFile = {
      ...changedFile,
      status: "added",
      allLinesChanged: true,
    };
    mockedGit.getDiffSnapshot.mockReturnValue({
      ...snapshot,
      files: new Map([[filename, wholeFile]]),
    });
    const processor = createProcessor({ mode: "diff" });
    processor.preprocess("text", filename);
    const fatal = message({ fatal: true, ruleId: null, line: 0 });
    const ordinary = message({ line: 50 });
    expect(processor.postprocess([[fatal, ordinary]], filename)).toEqual([
      fatal,
      ordinary,
    ]);
    expect(mockedGit.getChangedLineRanges).not.toHaveBeenCalled();
  });

  it("keeps fixable messages outside changed lines only when env override is enabled", () => {
    process.env["ESLINT_PLUGIN_DIFF_INCLUDE_FIXES"] = "true";
    mockedGit.getChangedLineRanges.mockReturnValue([]);
    const processor = createProcessor({ mode: "diff" });
    processor.preprocess("text", filename);
    const fixable = message({
      line: 20,
      fix: { range: [0, 1], text: "x" },
    });
    expect(processor.postprocess([[fixable]], filename)).toEqual([fixable]);
  });
});

describe("message scope", () => {
  it("keeps a multiline diagnostic whose span intersects a changed line", () => {
    expect(
      shouldKeepMessage(
        message({ line: 6, endLine: 12 }),
        changedFile,
        [new Range(8, 9)],
        new Set(),
        false,
      ),
    ).toBe(true);
  });

  it("filters a diagnostic whose reported span does not intersect", () => {
    expect(
      shouldKeepMessage(
        message({ line: 6, endLine: 7 }),
        changedFile,
        [new Range(8, 9)],
        new Set(),
        false,
      ),
    ).toBe(false);
  });

  it("does not treat a null ruleId as an outside-line rule", () => {
    expect(
      shouldKeepMessage(
        message({ ruleId: null, line: 50 }),
        changedFile,
        [],
        new Set(["example/rule"]),
        false,
      ),
    ).toBe(false);
  });

  it("does not keep a non-fixable message merely because fix inclusion is enabled", () => {
    expect(
      shouldKeepMessage(
        message({ line: 50 }),
        changedFile,
        [],
        new Set(),
        true,
      ),
    ).toBe(false);
  });

  it("keeps configured rules anywhere in a changed file", () => {
    expect(
      shouldKeepMessage(
        message({ line: 50 }),
        changedFile,
        [],
        new Set(["example/rule"]),
        false,
      ),
    ).toBe(true);
  });

  it("keeps all diagnostics for added and untracked whole-file changes", () => {
    expect(
      shouldKeepMessage(
        message({ line: 50 }),
        { ...changedFile, status: "added", allLinesChanged: true },
        [],
        new Set(),
        false,
      ),
    ).toBe(true);
  });

  it("always keeps fatal diagnostics", () => {
    expect(
      shouldKeepMessage(
        message({ fatal: true, ruleId: null, line: 0 }),
        changedFile,
        [],
        new Set(),
        false,
      ),
    ).toBe(true);
  });
});

describe("composeProcessor", () => {
  it("treats omitted base supportsAutofix as false", () => {
    expect(composeProcessor({}, { mode: "diff" }).supportsAutofix).toBe(false);
  });

  it("uses identity base callbacks when they are omitted", () => {
    const composed = composeProcessor(
      { supportsAutofix: true },
      { mode: "diff" },
    );
    expect(composed.preprocess("text", filename)).toEqual(["text"]);
    expect(composed.postprocess([[message()]], filename)).toEqual([message()]);
  });

  it("preserves true supportsAutofix and metadata", () => {
    const base: Linter.Processor = {
      supportsAutofix: true,
      meta: { name: "base", version: "1.0.0" },
    };
    const composed = composeProcessor(base, { mode: "diff" });
    expect(composed.supportsAutofix).toBe(true);
    expect(composed.meta).toEqual(base.meta);
  });

  it("calls base postprocess even when ESLint child messages are empty", () => {
    const synthetic = message();
    const basePostprocess = jest.fn(() => [synthetic]);
    const composed = composeProcessor(
      {
        preprocess: (text) => [text],
        postprocess: basePostprocess,
        supportsAutofix: true,
      },
      { mode: "diff" },
    );
    composed.preprocess("text", filename);
    expect(composed.postprocess([], filename)).toEqual([synthetic]);
    expect(basePostprocess).toHaveBeenCalledTimes(1);
  });

  it("does not call base postprocess when diff preprocess skipped the file", () => {
    const basePostprocess = jest.fn(() => [message()]);
    const composed = composeProcessor(
      { postprocess: basePostprocess },
      { mode: "diff" },
    );
    expect(composed.preprocess("text", "/repo/unchanged.ts")).toEqual([]);
    expect(composed.postprocess([], "/repo/unchanged.ts")).toEqual([]);
    expect(basePostprocess).not.toHaveBeenCalled();
  });
});
