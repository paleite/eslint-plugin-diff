import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { createTestRepository } from "./__fixtures__/gitRepository";
import {
  canonicalizeFilename,
  getChangedLineRanges,
  getDiffSnapshot,
  resolveCiBase,
  resolveExactBase,
} from "./git";

const withCwd = <T>(directory: string, callback: () => T): T => {
  const previous = process.cwd();
  process.chdir(directory);
  try {
    return callback();
  } finally {
    process.chdir(previous);
  }
};

describe("Git integration", () => {
  it("round-trips unusual filenames with NUL-delimited output", () => {
    const repo = createTestRepository();
    try {
      const filenames = ["räksmörgås.ts", "tab\tname.ts"];
      if (process.platform !== "win32") filenames.push("newline\nname.ts");
      for (const filename of filenames)
        repo.write(filename, "export const value = 1;\n");
      repo.commit("base");
      for (const filename of filenames)
        repo.write(filename, "export const value = 2;\n");

      const snapshot = withCwd(repo.directory, () =>
        getDiffSnapshot(
          { kind: "working-tree", baseCommit: "HEAD" },
          { includeUntracked: true },
        ),
      );

      expect([...snapshot.files.keys()].sort()).toEqual(
        filenames
          .map((filename) =>
            canonicalizeFilename(path.join(repo.directory, filename)),
          )
          .sort(),
      );
    } finally {
      repo.cleanup();
    }
  });

  it("treats an exact rename as a changed file with zero changed lines", () => {
    const repo = createTestRepository();
    try {
      repo.write("old.ts", "export const value = 1;\n");
      repo.commit("base");
      repo.git(["mv", "old.ts", "new.ts"]);

      const snapshot = withCwd(repo.directory, () =>
        getDiffSnapshot(
          { kind: "working-tree", baseCommit: "HEAD" },
          { includeUntracked: true },
        ),
      );
      const changed = snapshot.files.get(
        canonicalizeFilename(path.join(repo.directory, "new.ts")),
      );
      if (changed === undefined) throw new Error("Expected renamed file.");
      expect(changed?.status).toBe("renamed");
      expect(changed?.similarity).toBe(100);
      expect(
        withCwd(repo.directory, () => getChangedLineRanges(snapshot, changed)),
      ).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  it("keeps only edited hunks for rename plus small edit", () => {
    const repo = createTestRepository();
    try {
      const base =
        Array.from(
          { length: 20 },
          (_, index) => `export const v${index} = ${index};`,
        ).join("\n") + "\n";
      repo.write("old.ts", base);
      repo.commit("base");
      repo.git(["mv", "old.ts", "new.ts"]);
      repo.write("new.ts", base.replace("v10 = 10", "v10 = 999"));

      const snapshot = withCwd(repo.directory, () =>
        getDiffSnapshot(
          { kind: "working-tree", baseCommit: "HEAD" },
          { includeUntracked: true },
        ),
      );
      const changed = snapshot.files.get(
        canonicalizeFilename(path.join(repo.directory, "new.ts")),
      );
      if (changed === undefined) throw new Error("Expected renamed file.");
      expect(changed?.status).toBe("renamed");
      const ranges = withCwd(repo.directory, () =>
        getChangedLineRanges(snapshot, changed),
      );
      expect(ranges).toHaveLength(1);
      expect(ranges[0]?.isWithinRange(11)).toBe(true);
      expect(ranges[0]?.isWithinRange(1)).toBe(false);
    } finally {
      repo.cleanup();
    }
  });

  it("accepts Git delete/add classification for a large rewrite", () => {
    const repo = createTestRepository();
    try {
      repo.write(
        "old.ts",
        Array.from(
          { length: 40 },
          (_, i) => `export const old${i} = ${i};`,
        ).join("\n"),
      );
      repo.commit("base");
      repo.git(["mv", "old.ts", "new.ts"]);
      repo.write(
        "new.ts",
        Array.from(
          { length: 40 },
          (_, i) => `export const replacement${i} = ${i * 2};`,
        ).join("\n"),
      );

      const snapshot = withCwd(repo.directory, () =>
        getDiffSnapshot(
          { kind: "working-tree", baseCommit: "HEAD" },
          { includeUntracked: true },
        ),
      );
      const changed = snapshot.files.get(
        canonicalizeFilename(path.join(repo.directory, "new.ts")),
      );
      expect(changed?.status).toBe("added");
      expect(changed?.allLinesChanged).toBe(true);
    } finally {
      repo.cleanup();
    }
  });

  it("keeps unstaged untracked files out of staged snapshots", () => {
    const repo = createTestRepository();
    try {
      repo.write("tracked.ts", "export const value = 1;\n");
      repo.commit("base");
      repo.write("untracked.ts", "export const newValue = 1;\n");

      let snapshot = withCwd(repo.directory, () =>
        getDiffSnapshot(
          { kind: "index", baseCommit: "HEAD" },
          { includeUntracked: false },
        ),
      );
      expect(snapshot.files.size).toBe(0);

      repo.git(["add", "untracked.ts"]);
      snapshot = withCwd(repo.directory, () =>
        getDiffSnapshot(
          { kind: "index", baseCommit: "HEAD" },
          { includeUntracked: false },
        ),
      );
      const changed = snapshot.files.get(
        canonicalizeFilename(path.join(repo.directory, "untracked.ts")),
      );
      expect(changed?.status).toBe("added");
      expect(changed?.allLinesChanged).toBe(true);
    } finally {
      repo.cleanup();
    }
  });

  it("resolves an exact comparison point without merge-base semantics", () => {
    const repo = createTestRepository();
    try {
      repo.write("file.ts", "one\n");
      const first = repo.commit("first");
      repo.write("file.ts", "two\n");
      repo.commit("second");
      expect(
        withCwd(repo.directory, () => resolveExactBase(first, false)),
      ).toBe(first);
    } finally {
      repo.cleanup();
    }
  });

  it("progressively resolves a merge base in a true shallow clone and cleans private refs", () => {
    const source = createTestRepository();
    const parent = fs.mkdtempSync(
      path.join(os.tmpdir(), "eslint-plugin-diff-shallow-"),
    );
    const bare = path.join(parent, "origin.git");
    const clone = path.join(parent, "clone");
    try {
      source.write("shared.ts", "base\n");
      const expectedMergeBase = source.commit("base");
      source.git(["branch", "feature"]);
      for (let index = 0; index < 40; index += 1) {
        source.write("main.ts", `${index}\n`);
        source.commit(`main-${index}`);
      }
      source.git(["checkout", "--quiet", "feature"]);
      source.write("feature.ts", "feature\n");
      source.commit("feature");

      child_process.execFileSync(
        "git",
        ["clone", "--bare", source.directory, bare],
        { stdio: "ignore" },
      );
      child_process.execFileSync("git", [
        "clone",
        "--quiet",
        "--depth=1",
        "--branch",
        "feature",
        `file://${bare}`,
        clone,
      ]);

      const base = withCwd(clone, () =>
        resolveCiBase({
          provider: "github",
          baseRef: "main",
          headRef: "feature",
        }),
      );
      expect(base).toBe(expectedMergeBase);
      const privateRefs = child_process.execFileSync(
        "git",
        ["for-each-ref", "--format=%(refname)", "refs/eslint-plugin-diff"],
        { cwd: clone, encoding: "utf8" },
      );
      expect(privateRefs).toBe("");
    } finally {
      source.cleanup();
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });

  it("resolves a locally available merge base without requiring a remote", () => {
    const repo = createTestRepository();
    try {
      repo.write("shared.ts", "base\n");
      const expectedMergeBase = repo.commit("base");
      repo.git(["branch", "feature"]);
      repo.write("main.ts", "main\n");
      repo.commit("main");
      repo.git(["checkout", "--quiet", "feature"]);
      repo.write("feature.ts", "feature\n");
      repo.commit("feature");

      expect(
        withCwd(repo.directory, () =>
          resolveCiBase({ provider: "github", baseRef: "main" }),
        ),
      ).toBe(expectedMergeBase);
    } finally {
      repo.cleanup();
    }
  });

  it("does not mutate normal refs while deepening shallow history", () => {
    const source = createTestRepository();
    const parent = fs.mkdtempSync(
      path.join(os.tmpdir(), "eslint-plugin-diff-ref-integrity-"),
    );
    const bare = path.join(parent, "origin.git");
    const clone = path.join(parent, "clone");
    try {
      source.write("shared.ts", "base\n");
      source.commit("base");
      source.git(["branch", "feature"]);
      for (let index = 0; index < 8; index += 1) {
        source.write("main.ts", `${index}\n`);
        source.commit(`main-${index}`);
      }
      source.git(["checkout", "--quiet", "feature"]);
      source.write("feature.ts", "feature\n");
      source.commit("feature");

      child_process.execFileSync(
        "git",
        ["clone", "--bare", source.directory, bare],
        { stdio: "ignore" },
      );
      child_process.execFileSync("git", [
        "clone",
        "--quiet",
        "--depth=1",
        "--branch",
        "feature",
        `file://${bare}`,
        clone,
      ]);

      const listNormalRefs = () =>
        child_process.execFileSync(
          "git",
          [
            "for-each-ref",
            "--format=%(refname) %(objectname)",
            "refs/heads",
            "refs/remotes",
          ],
          { cwd: clone, encoding: "utf8" },
        );
      const before = listNormalRefs();

      withCwd(clone, () =>
        resolveCiBase({
          provider: "github",
          baseRef: "main",
          headRef: "feature",
        }),
      );

      expect(listNormalRefs()).toBe(before);
    } finally {
      source.cleanup();
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });

  it("cleans private refs after an unrecoverable merge-base failure", () => {
    const source = createTestRepository();
    const parent = fs.mkdtempSync(
      path.join(os.tmpdir(), "eslint-plugin-diff-unrelated-"),
    );
    const bare = path.join(parent, "origin.git");
    const clone = path.join(parent, "clone");
    try {
      source.write("main.ts", "main\n");
      source.commit("main");
      source.git(["checkout", "--orphan", "unrelated"]);
      source.git(["rm", "-rf", "."]);
      source.write("unrelated.ts", "unrelated\n");
      source.commit("unrelated");
      source.git(["checkout", "--quiet", "main"]);

      child_process.execFileSync(
        "git",
        ["clone", "--bare", source.directory, bare],
        { stdio: "ignore" },
      );
      child_process.execFileSync("git", [
        "clone",
        "--quiet",
        `file://${bare}`,
        clone,
      ]);

      expect(() =>
        withCwd(clone, () =>
          resolveCiBase({ provider: "github", baseRef: "unrelated" }),
        ),
      ).toThrow(/diff base/u);

      const privateRefs = child_process.execFileSync(
        "git",
        ["for-each-ref", "--format=%(refname)", "refs/eslint-plugin-diff"],
        { cwd: clone, encoding: "utf8" },
      );
      expect(privateRefs).toBe("");
    } finally {
      source.cleanup();
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });

  it("fetches an exact tag comparison point without reinterpreting it as a branch", () => {
    const source = createTestRepository();
    const parent = fs.mkdtempSync(
      path.join(os.tmpdir(), "eslint-plugin-diff-exact-tag-"),
    );
    const bare = path.join(parent, "origin.git");
    const clone = path.join(parent, "clone");
    try {
      source.write("file.ts", "base\n");
      const taggedCommit = source.commit("base");
      source.git(["tag", "v1.0.0", taggedCommit]);
      source.write("file.ts", "head\n");
      source.commit("head");

      child_process.execFileSync(
        "git",
        ["clone", "--bare", source.directory, bare],
        { stdio: "ignore" },
      );
      child_process.execFileSync("git", [
        "clone",
        "--quiet",
        "--depth=1",
        "--no-tags",
        `file://${bare}`,
        clone,
      ]);

      expect(withCwd(clone, () => resolveExactBase("v1.0.0", true))).toBe(
        taggedCommit,
      );
    } finally {
      source.cleanup();
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });

  it("anchors Bitbucket merge-base resolution to the provided destination commit", () => {
    const repo = createTestRepository();
    try {
      repo.write("shared.ts", "base\n");
      repo.commit("base");
      repo.write("target.ts", "target event\n");
      const destinationCommit = repo.commit("destination event commit");
      repo.git(["branch", "feature"]);
      repo.write("target.ts", "target advanced\n");
      repo.commit("destination advanced");
      repo.git(["checkout", "--quiet", "feature"]);
      repo.write("feature.ts", "feature\n");
      repo.commit("feature");

      expect(
        withCwd(repo.directory, () =>
          resolveCiBase({
            provider: "bitbucket",
            baseRef: "main",
            baseSha: destinationCommit,
          }),
        ),
      ).toBe(destinationCommit);
    } finally {
      repo.cleanup();
    }
  });

  it("resolves GitLab exact diff base by deepening target history", () => {
    const source = createTestRepository();
    const parent = fs.mkdtempSync(
      path.join(os.tmpdir(), "eslint-plugin-diff-gitlab-exact-"),
    );
    const bare = path.join(parent, "origin.git");
    const clone = path.join(parent, "clone");
    try {
      source.write("shared.ts", "base\n");
      const exactDiffBase = source.commit("diff base");
      source.git(["branch", "feature"]);
      for (let index = 0; index < 40; index += 1) {
        source.write("main.ts", `${index}\n`);
        source.commit(`main-${index}`);
      }
      source.git(["checkout", "--quiet", "feature"]);
      source.write("feature.ts", "feature\n");
      source.commit("feature");

      child_process.execFileSync(
        "git",
        ["clone", "--bare", source.directory, bare],
        { stdio: "ignore" },
      );
      child_process.execFileSync("git", [
        "clone",
        "--quiet",
        "--depth=1",
        "--branch",
        "feature",
        `file://${bare}`,
        clone,
      ]);

      expect(
        withCwd(clone, () =>
          resolveCiBase({
            provider: "gitlab",
            baseRef: "main",
            diffBaseSha: exactDiffBase,
          }),
        ),
      ).toBe(exactDiffBase);
    } finally {
      source.cleanup();
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });
});
