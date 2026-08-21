import * as child_process from "node:child_process";
import * as path from "node:path";

jest.mock("node:child_process");

import type { ChangedFile, DiffSnapshot } from "./git";
import {
  canonicalizeFilename,
  getChangedLineRanges,
  getDiffSnapshot,
  getRepositoryRoot,
  getUnstagedState,
  parseNameStatusZ,
  resolveCiBase,
  resolveExactBase,
} from "./git";

const mockedChildProcess = jest.mocked(child_process, { shallow: true });

const setExec = (handler: (args: string[]) => string): void => {
  mockedChildProcess.execFileSync.mockImplementation(
    (_command: string, args: readonly string[] = []) => handler([...args]),
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Git defensive and coverage paths", () => {
  it("canonicalizes relative filenames", () => {
    expect(canonicalizeFilename("relative.ts")).toBe(
      path.resolve("relative.ts"),
    );
  });
  it("rejects an empty repository root", () => {
    setExec(() => "\n");
    expect(() => getRepositoryRoot()).toThrow(/repository root/u);
  });

  it("rejects empty and incomplete rename status tokens", () => {
    const root = path.resolve("/repo");
    expect(() => parseNameStatusZ("\0", root)).toThrow(/empty/u);
    expect(() => parseNameStatusZ("R100\0old.ts\0", root)).toThrow(
      /Incomplete Git renamed/u,
    );
  });

  it("parses a valid status stream without a trailing NUL", () => {
    const files = parseNameStatusZ("M\0file.ts", path.resolve("/repo"));
    expect([...files.values()][0]?.status).toBe("modified");
  });

  it("builds commit-comparison snapshots and includes untracked files", () => {
    setExec((args) => {
      if (args[0] === "rev-parse") return "/repo\n";
      if (args[0] === "diff") return "A\0added.ts\0";
      if (args[0] === "ls-files") return "untracked.ts\0";
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    const snapshot = getDiffSnapshot(
      { kind: "commit", baseCommit: "base", headCommit: "head" },
      { includeUntracked: true },
    );

    expect(
      [...snapshot.files.values()].map(({ status }) => status).sort(),
    ).toEqual(["added", "untracked"]);
    expect(
      [...snapshot.files.values()].find(({ status }) => status === "untracked"),
    ).toMatchObject({ allLinesChanged: true, relativePath: "untracked.ts" });
    expect(
      mockedChildProcess.execFileSync.mock.calls.some(([, args]) =>
        (args as string[]).includes("head"),
      ),
    ).toBe(true);
  });

  it("returns no line ranges for whole-file changes without running Git", () => {
    const changedFile: ChangedFile = {
      status: "added",
      filename: "/repo/file.ts",
      relativePath: "file.ts",
      allLinesChanged: true,
    };
    const snapshot: DiffSnapshot = {
      repositoryRoot: "/repo",
      comparison: { kind: "working-tree", baseCommit: "HEAD" },
      files: new Map([[changedFile.filename, changedFile]]),
    };

    expect(getChangedLineRanges(snapshot, changedFile)).toEqual([]);
    expect(mockedChildProcess.execFileSync).not.toHaveBeenCalled();
  });

  it("distinguishes clean, dirty, spawn failures, and unexpected diff exit codes", () => {
    mockedChildProcess.spawnSync
      .mockReturnValueOnce({
        status: 0,
        signal: null,
        output: [],
        pid: 1,
        stdout: "",
        stderr: "",
      })
      .mockReturnValueOnce({
        status: 1,
        signal: null,
        output: [],
        pid: 1,
        stdout: "",
        stderr: "",
      })
      .mockReturnValueOnce({
        status: null,
        signal: null,
        output: [],
        pid: 1,
        stdout: "",
        stderr: "",
        error: new Error("spawn failed"),
      })
      .mockReturnValueOnce({
        status: 2,
        signal: null,
        output: [],
        pid: 1,
        stdout: "",
        stderr: "bad diff",
      });

    expect(getUnstagedState("/repo", "file.ts")).toBe("clean");
    expect(getUnstagedState("/repo", "file.ts")).toBe("dirty");
    expect(() => getUnstagedState("/repo", "file.ts")).toThrow("spawn failed");
    expect(() => getUnstagedState("/repo", "file.ts")).toThrow(/exit code 2/u);
  });

  it("fails exact local-only resolution when the commit is unavailable", () => {
    setExec(() => "\n");
    expect(() => resolveExactBase("missing", false)).toThrow(
      /could not resolve exact Git comparison point/u,
    );
  });

  it("wraps a fetched exact comparison point that still cannot resolve", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository")
        return "false\n";
      if (args[0] === "rev-parse") throw new Error("missing");
      if (args[0] === "fetch") return "";
      if (args[0] === "show-ref") throw new Error("missing ref");
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(() => resolveExactBase("refs/heads/main", true)).toThrow(
      /could not resolve exact CI comparison point/u,
    );
  });

  it.each([
    ["deadbeef", "deadbeef"],
    ["refs/heads/main", "refs/heads/main"],
    ["refs/pull/12/head", "refs/pull/12/head"],
    ["refs/merge-requests/12/head", "refs/merge-requests/12/head"],
    ["refs/remotes/origin/main", "refs/heads/main"],
    ["origin/main", "refs/heads/main"],
    ["refs/tags/v1", "refs/tags/v1"],
    ["main", "refs/heads/main"],
  ])("normalizes exact fetch fallback for %s", (commitish, normalized) => {
    let privateRef = "";
    setExec((args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository")
        return "false\n";
      if (
        args[0] === "rev-parse" &&
        args[2]?.includes("refs/eslint-plugin-diff")
      )
        return "abc123\n";
      if (args[0] === "rev-parse") throw new Error("missing");
      if (args[0] === "fetch") {
        const refspec = args.at(-1) ?? "";
        privateRef = refspec.split(":").at(-1) ?? "";
        const source = refspec.slice(0, refspec.length - privateRef.length - 1);
        if (source === commitish && commitish !== normalized) {
          throw new Error("first spelling unavailable");
        }
        expect(source).toBe(normalized);
        return "";
      }
      if (args[0] === "show-ref") throw new Error("no ref");
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(resolveExactBase(commitish, true)).toBe("abc123");
    expect(privateRef).toMatch(/^refs\/eslint-plugin-diff\//u);
  });

  it("wraps non-Error failures from all exact fetch candidates", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository")
        return "false\n";
      if (args[0] === "rev-parse") throw new Error("missing");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      if (args[0] === "fetch") throw "fetch string failure";
      if (args[0] === "show-ref") throw new Error("no ref");
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(() => resolveExactBase("main", true)).toThrow(
      /could not resolve exact CI comparison point/u,
    );
  });

  it("surfaces cleanup failure after otherwise successful exact resolution", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository")
        return "false\n";
      if (
        args[0] === "rev-parse" &&
        args[2]?.includes("refs/eslint-plugin-diff")
      )
        return "abc123\n";
      if (args[0] === "rev-parse") throw new Error("missing");
      if (args[0] === "fetch") return "";
      if (args[0] === "show-ref") return "exists\n";
      if (args[0] === "update-ref") throw new Error("cleanup failed");
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(() => resolveExactBase("refs/heads/main", true)).toThrow(
      /could not clean up its private Git refs/u,
    );
  });

  it("preserves the primary resolution error when cleanup also fails", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository")
        return "false\n";
      if (args[0] === "rev-parse") throw new Error("missing");
      if (args[0] === "fetch") throw new Error("fetch failed");
      if (args[0] === "show-ref") return "exists\n";
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      if (args[0] === "update-ref") throw "cleanup string failure";
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(() => resolveExactBase("main", true)).toThrow(
      /Private-ref cleanup also failed: cleanup string failure/u,
    );
  });

  it("resolves a provider exact diff base without a history ref", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[2] === "exact^{commit}")
        return "exact\n";
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(resolveCiBase({ provider: "gitlab", diffBaseSha: "exact" })).toBe(
      "exact",
    );
  });

  it("uses an available origin tracking ref before fetching", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[2] === "main^{commit}")
        throw new Error("local branch missing");
      if (args[0] === "rev-parse" && args[2] === "origin/main^{commit}")
        return "base\n";
      if (args[0] === "merge-base") return "merge-base\n";
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(resolveCiBase({ provider: "github", baseRef: "main" })).toBe(
      "merge-base",
    );
  });

  it("accepts a base SHA as the only provider base-side locator", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[2] === "abc123^{commit}")
        return "abc123\n";
      if (args[0] === "merge-base") return "merge-base\n";
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(resolveCiBase({ provider: "bitbucket", baseSha: "abc123" })).toBe(
      "merge-base",
    );
  });

  it("deepens a shallow repository after a local base has no merge base", () => {
    let mergeBaseChecks = 0;
    let reachableChecks = 0;
    setExec((args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository") {
        return "true\n";
      }
      if (
        args[0] === "rev-parse" &&
        (args[2] === "main^{commit}" ||
          args[2]?.includes("refs/eslint-plugin-diff"))
      ) {
        return "base\n";
      }
      if (args[0] === "merge-base") {
        mergeBaseChecks += 1;
        return mergeBaseChecks === 1 ? "\n" : "merge-base\n";
      }
      if (args[0] === "fetch" || args[0] === "show-ref") return "";
      if (args[0] === "rev-list") {
        reachableChecks += 1;
        return `${reachableChecks}\n`;
      }
      if (args[0] === "update-ref") return "";
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(resolveCiBase({ provider: "github", baseRef: "main" })).toBe(
      "merge-base",
    );
  });

  it("handles a missing exact target after shallow deepening", () => {
    let shallowChecks = 0;
    let reachableChecks = 0;
    setExec((args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository") {
        shallowChecks += 1;
        return shallowChecks < 3 ? "true\n" : "false\n";
      }
      if (args[0] === "rev-parse" && args[2] === "main^{commit}") {
        throw new Error("missing");
      }
      if (args[0] === "rev-parse") throw new Error("missing");
      if (args[0] === "fetch") return "";
      if (args[0] === "rev-list") {
        reachableChecks += 1;
        return `${reachableChecks}\n`;
      }
      if (args[0] === "show-ref") throw new Error("no ref");
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(() =>
      resolveCiBase({
        provider: "bitbucket",
        baseRef: "main",
        baseSha: "deadbeef",
      }),
    ).toThrow(
      /could not establish a reliable bitbucket pull-request diff base/u,
    );
  });

  it("uses an already-local exact diff base from provider history", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[2] === "exact^{commit}")
        return "exact\n";
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(
      resolveCiBase({
        provider: "gitlab",
        diffBaseSha: "exact",
        baseRef: "main",
      }),
    ).toBe("exact");
  });

  it("fails exact diff-base history resolution when a complete history cannot reach it", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository")
        return "false\n";
      if (args[0] === "rev-parse") throw new Error("missing");
      if (args[0] === "fetch") return "";
      if (args[0] === "show-ref") throw new Error("no ref");
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(() =>
      resolveCiBase({
        provider: "gitlab",
        diffBaseSha: "exact",
        baseRef: "main",
      }),
    ).toThrow(/could not resolve exact CI diff base/u);
  });

  it("fails exact diff-base history resolution when deepening makes no progress", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository")
        return "true\n";
      if (args[0] === "rev-parse") throw new Error("missing");
      if (args[0] === "fetch") return "";
      if (args[0] === "rev-list") return "1\n";
      if (args[0] === "show-ref") throw new Error("no ref");
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(() =>
      resolveCiBase({
        provider: "gitlab",
        diffBaseSha: "exact",
        baseRef: "main",
      }),
    ).toThrow(/could not resolve exact CI diff base/u);
  });

  it("rejects provider contexts without a base side", () => {
    expect(() => resolveCiBase({ provider: "github" })).toThrow(
      /could not determine the github pull-request base side/u,
    );
  });

  it("rejects a locally resolved provider base with no merge base in complete history", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[2] === "main^{commit}")
        return "base\n";
      if (args[0] === "merge-base") return "\n";
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository")
        return "false\n";
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(() =>
      resolveCiBase({ provider: "github", baseRef: "main" }),
    ).toThrow(/no merge base exists/u);
  });

  it.each(["refs/heads/main", "origin/main"])(
    "fetches provider base locator %s without remote-tracking fallback",
    (baseRef) => {
      setExec((args) => {
        if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository")
          return "false\n";
        if (
          args[0] === "rev-parse" &&
          args[2]?.includes("refs/eslint-plugin-diff")
        )
          return "base\n";
        if (args[0] === "rev-parse") throw new Error("missing");
        if (args[0] === "fetch") return "";
        if (args[0] === "merge-base") return "merge-base\n";
        if (args[0] === "show-ref") throw new Error("no ref");
        throw new Error(`Unexpected Git command: ${args.join(" ")}`);
      });

      expect(resolveCiBase({ provider: "github", baseRef })).toBe("merge-base");
    },
  );

  it("reports an unreachable exact provider target after fetching its base ref", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository")
        return "false\n";
      if (args[0] === "rev-parse") throw new Error("missing");
      if (args[0] === "fetch") return "";
      if (args[0] === "show-ref") throw new Error("no ref");
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(() =>
      resolveCiBase({
        provider: "bitbucket",
        baseRef: "main",
        baseSha: "deadbeef",
      }),
    ).toThrow(
      /could not establish a reliable bitbucket pull-request diff base/u,
    );
  });

  it("reports no merge base after fetching a complete base side", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository")
        return "false\n";
      if (
        args[0] === "rev-parse" &&
        args[2]?.includes("refs/eslint-plugin-diff")
      )
        return "base\n";
      if (args[0] === "rev-parse") throw new Error("missing");
      if (args[0] === "fetch") return "";
      if (args[0] === "merge-base") throw new Error("none");
      if (args[0] === "show-ref") throw new Error("no ref");
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(() =>
      resolveCiBase({ provider: "github", baseRef: "main" }),
    ).toThrow(/could not establish a reliable github pull-request diff base/u);
  });

  it("reports provider merge-base deepening that makes no progress", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository")
        return "true\n";
      if (
        args[0] === "rev-parse" &&
        args[2]?.includes("refs/eslint-plugin-diff")
      )
        return "base\n";
      if (args[0] === "rev-parse") throw new Error("missing");
      if (args[0] === "fetch") return "";
      if (args[0] === "merge-base") throw new Error("none");
      if (args[0] === "rev-list") return "1\n";
      if (args[0] === "show-ref") throw new Error("no ref");
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(() =>
      resolveCiBase({ provider: "github", baseRef: "main" }),
    ).toThrow(/could not establish a reliable github pull-request diff base/u);
  });

  it("continues when an optional provider head ref cannot be fetched", () => {
    setExec((args) => {
      if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository")
        return "false\n";
      if (
        args[0] === "rev-parse" &&
        args[2]?.includes("refs/eslint-plugin-diff")
      )
        return "base\n";
      if (args[0] === "rev-parse") throw new Error("missing");
      if (args[0] === "fetch") {
        const refspec = args.at(-1) ?? "";
        if (refspec.startsWith("refs/heads/feature:")) {
          throw new Error("fork branch unavailable");
        }
        return "";
      }
      if (args[0] === "merge-base") return "merge-base\n";
      if (args[0] === "show-ref") throw new Error("no ref");
      throw new Error(`Unexpected Git command: ${args.join(" ")}`);
    });

    expect(
      resolveCiBase({
        provider: "github",
        baseRef: "main",
        headRef: "feature",
      }),
    ).toBe("merge-base");
  });
});
