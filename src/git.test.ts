import * as child_process from "node:child_process";
import path from "node:path";

import {
  diffFileList,
  hunks,
  includingOnlyRemovals,
} from "./__fixtures__/diff";
import {
  fetchFromOrigin,
  getDiffFileList,
  getDiffForFile,
  getRangesForDiff,
  getTrackedFileList,
  hasCleanIndex,
  hasCleanTree,
  readFileFromGit,
} from "./git";

jest.mock("child_process");

const mockedChildProcess = jest.mocked(child_process, { shallow: true });

const OLD_ENV = process.env;

beforeEach(() => {
  jest.resetModules(); // Most important - it clears the cache
  process.env = { ...OLD_ENV }; // Make a copy
});

afterAll(() => {
  process.env = OLD_ENV; // Restore old environment
});

describe("getRangesForDiff", () => {
  it("should find the ranges of each staged file", () => {
    expect(getRangesForDiff(hunks)).toMatchSnapshot();
  });

  it("should work for hunks which include only-removal-ranges", () => {
    expect(getRangesForDiff(includingOnlyRemovals)).toMatchSnapshot();
  });

  it("should work for hunks which include only-removal-ranges", () => {
    expect(() =>
      getRangesForDiff("@@ invalid hunk header @@"),
    ).toThrowErrorMatchingInlineSnapshot(
      `"Couldn't match regex with line '@@ invalid hunk header @@'"`,
    );
  });
});

describe("getDiffForFile", () => {
  it("should get the staged diff of a file", () => {
    mockedChildProcess.execFileSync.mockReturnValueOnce(Buffer.from(hunks));
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] = "1234567";

    const diffFromFile = getDiffForFile("./mockfile.js", "staged");

    const expectedCommand = "git";
    const expectedArgs =
      "diff --diff-algorithm=histogram --diff-filter=ACM --find-renames=100% --no-ext-diff --relative --staged --unified=0 1234567";

    const lastCall = mockedChildProcess.execFileSync.mock.calls.at(-1);
    const [command, argsIncludingFile = []] = lastCall ?? [""];
    const args = argsIncludingFile.slice(0, -2);

    expect(command).toBe(expectedCommand);
    expect(args.join(" ")).toEqual(expectedArgs);
    expect(diffFromFile).toContain("diff --git");
    expect(diffFromFile).toContain("@@");
  });

  it("should work when using staged = false", () => {
    mockedChildProcess.execFileSync.mockReturnValueOnce(Buffer.from(hunks));
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] = "1234567";

    const diffFromFile = getDiffForFile("./mockfile.js", "working");

    const expectedCommand = "git";
    const expectedArgs =
      "diff --diff-algorithm=histogram --diff-filter=ACM --find-renames=100% --no-ext-diff --relative --unified=0 1234567";

    const lastCall = mockedChildProcess.execFileSync.mock.calls.at(-1);
    const [command, argsIncludingFile = []] = lastCall ?? [""];
    const args = argsIncludingFile.slice(0, -2);

    expect(command).toBe(expectedCommand);
    expect(args.join(" ")).toEqual(expectedArgs);
    expect(diffFromFile).toContain("diff --git");
    expect(diffFromFile).toContain("@@");
  });

  it("should use HEAD when no commit was defined", () => {
    mockedChildProcess.execFileSync.mockReturnValueOnce(Buffer.from(hunks));
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] = undefined;

    const diffFromFile = getDiffForFile("./mockfile.js", "working");

    const expectedCommand = "git";
    const expectedArgs =
      "diff --diff-algorithm=histogram --diff-filter=ACM --find-renames=100% --no-ext-diff --relative --unified=0 HEAD";

    const lastCall = mockedChildProcess.execFileSync.mock.calls.at(-1);
    const [command, argsIncludingFile = []] = lastCall ?? [""];
    const args = argsIncludingFile.slice(0, -2);

    expect(command).toBe(expectedCommand);
    expect(args.join(" ")).toEqual(expectedArgs);
    expect(diffFromFile).toContain("diff --git");
    expect(diffFromFile).toContain("@@");
  });
  it("should get the committed diff of a file", () => {
    mockedChildProcess.execFileSync.mockReturnValueOnce(Buffer.from(hunks));
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] = "origin/main";

    getDiffForFile("./mockfile.js", "committed");

    const lastCall = mockedChildProcess.execFileSync.mock.calls.at(-1);
    const [command, argsIncludingFile = []] = lastCall ?? [""];
    const args = argsIncludingFile.slice(0, -2);

    expect(command).toBe("git");
    expect(args.join(" ")).toEqual(
      "diff-tree --diff-algorithm=histogram --diff-filter=ACM --find-renames=100% --no-ext-diff --relative -r --unified=0 origin/main HEAD",
    );
  });
});

describe("hasCleanIndex", () => {
  it("returns false instead of throwing", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync.mockImplementationOnce(() => {
      throw new Error("mocked error");
    });
    expect(hasCleanIndex("")).toEqual(false);
    expect(mockedChildProcess.execFileSync).toHaveBeenCalled();
  });

  it("returns true otherwise", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync.mockReturnValue(Buffer.from(""));
    expect(hasCleanIndex("")).toEqual(true);
    expect(mockedChildProcess.execFileSync).toHaveBeenCalled();
  });
});

describe("fetchFromOrigin", () => {
  it("fetches from origin for the provided branch", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync.mockReturnValue(Buffer.from(""));

    fetchFromOrigin("main");

    expect(mockedChildProcess.execFileSync).toHaveBeenCalledWith(
      "git",
      ["fetch", "--quiet", "origin", "main"],
      expect.anything(),
    );
  });
});

describe("hasCleanTree", () => {
  it("returns false instead of throwing", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync.mockImplementationOnce(() => {
      throw new Error("mocked error");
    });
    expect(hasCleanTree("")).toEqual(false);
    expect(mockedChildProcess.execFileSync).toHaveBeenCalled();
  });

  it("returns true otherwise", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync.mockReturnValue(Buffer.from(""));
    expect(hasCleanTree("")).toEqual(true);
    expect(mockedChildProcess.execFileSync).toHaveBeenCalled();
  });
});

describe("getDiffFileList", () => {
  it("should get the list of staged files", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync.mockReturnValueOnce(
      Buffer.from(diffFileList),
    );
    expect(mockedChildProcess.execFileSync).toHaveBeenCalledTimes(0);
    const fileListA = getDiffFileList("working");

    expect(mockedChildProcess.execFileSync).toHaveBeenCalledTimes(1);
    expect(fileListA).toEqual(
      ["file1", "file2", "file3"].map((p) => path.resolve(p)),
    );
  });

  it("includes --staged when staged is true", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync.mockReturnValueOnce(
      Buffer.from(diffFileList),
    );
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] = "1234567";

    getDiffFileList("staged");

    const lastCall = mockedChildProcess.execFileSync.mock.calls.at(-1);
    const [command, args = []] = lastCall ?? [""];

    expect(command).toBe("git");
    expect(args).toContain("--staged");
    expect(args).toContain("1234567");
  });

  it("includes head range when diffType is committed", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync.mockReturnValueOnce(
      Buffer.from(diffFileList),
    );
    process.env["ESLINT_PLUGIN_DIFF_COMMIT"] = "origin/main";

    getDiffFileList("committed");

    const lastCall = mockedChildProcess.execFileSync.mock.calls.at(-1);
    const [command, args = []] = lastCall ?? [""];

    expect(command).toBe("git");
    expect(args).toContain("diff-tree");
    expect(args).toContain("-r");
    expect(args).toEqual(expect.arrayContaining(["origin/main", "HEAD"]));
  });

  it("returns an empty list when git diff has no output", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync.mockReturnValueOnce(Buffer.from(""));

    expect(getDiffFileList("working")).toEqual([]);
  });
});

describe("getTrackedFileList", () => {
  it("should get the list of untracked files", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync.mockReturnValueOnce(
      Buffer.from(diffFileList),
    );
    expect(mockedChildProcess.execFileSync).toHaveBeenCalledTimes(0);
    const fileListA = getTrackedFileList();
    expect(mockedChildProcess.execFileSync).toHaveBeenCalledTimes(1);

    expect(fileListA).toEqual(
      ["file1", "file2", "file3"].map((p) => path.resolve(p)),
    );
  });

  it("returns an empty list when git ls-files has no output", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync.mockReturnValueOnce(Buffer.from(""));

    expect(getTrackedFileList()).toEqual([]);
  });
});

describe("readFileFromGit", () => {
  it("reads file content from HEAD blob", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync
      .mockReturnValueOnce(Buffer.from("blob-id\n"))
      .mockReturnValueOnce(Buffer.from("const fromGit = true;\n"));

    const result = readFileFromGit("./mockfile.js");

    expect(result).toBe("const fromGit = true;\n");
    expect(mockedChildProcess.execFileSync).toHaveBeenNthCalledWith(
      1,
      "git",
      ["ls-tree", "--object-only", "HEAD", path.resolve("./mockfile.js")],
      expect.anything(),
    );
    expect(mockedChildProcess.execFileSync).toHaveBeenNthCalledWith(
      2,
      "git",
      ["cat-file", "blob", "blob-id"],
      expect.anything(),
    );
  });
});
