import * as path from "node:path";

import { getRangesForDiff, parseNameStatusZ } from "./git";

const root = path.resolve("/repo");

describe("parseNameStatusZ", () => {
  it("parses current-side statuses and omits deleted files", () => {
    const output = [
      "A",
      "added.ts",
      "M",
      "modified.ts",
      "T",
      "typed.ts",
      "D",
      "deleted.ts",
      "R090",
      "old.ts",
      "renamed.ts",
      "C080",
      "source.ts",
      "copied.ts",
      "",
    ].join("\0");

    const files = parseNameStatusZ(output, root);
    expect([...files.values()].map(({ status }) => status)).toEqual([
      "added",
      "modified",
      "type-changed",
      "renamed",
      "copied",
    ]);
    expect(
      [...files.values()].find(({ status }) => status === "renamed"),
    ).toMatchObject({
      previousRelativePath: "old.ts",
      relativePath: "renamed.ts",
      similarity: 90,
      allLinesChanged: false,
    });
  });

  it("preserves tabs and newlines in NUL-delimited paths", () => {
    const files = parseNameStatusZ("M\0tab\tand\nnewline.ts\0", root);
    expect([...files.values()][0]?.relativePath).toBe("tab\tand\nnewline.ts");
  });

  it.each(["U", "X", "B"])("rejects unresolved Git status %s", (status) => {
    expect(() => parseNameStatusZ(`${status}\0file.ts\0`, root)).toThrow(
      /cannot determine changed-file scope/u,
    );
  });

  it("rejects unknown and malformed status streams", () => {
    expect(() => parseNameStatusZ("Q\0file.ts\0", root)).toThrow(
      /Unsupported/u,
    );
    expect(() => parseNameStatusZ("Rbad\0old.ts\0new.ts\0", root)).toThrow(
      /similarity/u,
    );
    expect(() => parseNameStatusZ("M\0", root)).toThrow(/Incomplete/u);
  });
});

describe("getRangesForDiff", () => {
  it("uses current-side added line ranges and ignores deletion-only hunks", () => {
    const diff = `@@ -1,0 +2,2 @@
+a
+b
@@ -10,2 +11,0 @@
-a
-b`;
    const ranges = getRangesForDiff(diff);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]?.isWithinRange(2)).toBe(true);
    expect(ranges[0]?.isWithinRange(3)).toBe(true);
    expect(ranges[0]?.isWithinRange(4)).toBe(false);
  });

  it("uses an implicit hunk count of one", () => {
    const [range] = getRangesForDiff("@@ -1 +5 @@");
    expect(range?.isWithinRange(5)).toBe(true);
    expect(range?.isWithinRange(6)).toBe(false);
  });

  it("throws for malformed hunk headers", () => {
    expect(() => getRangesForDiff("@@ invalid @@")).toThrow(/Couldn't match/u);
  });
});
