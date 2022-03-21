import * as child_process from "child_process";
import { mocked } from "jest-mock";
import path from "path";
import {
  getDiffFileList,
  getDiffForFile,
  getGitFileList,
  getRangesForDiff,
  getUntrackedFileList,
  hasCleanIndex,
} from "./git";
import {
  diffFileList,
  hunks,
  includingOnlyRemovals,
} from "./__fixtures__/diff";

jest.mock("child_process");

const mockedChildProcess = mocked(child_process, true);

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
      getRangesForDiff("@@ invalid hunk header @@")
    ).toThrowErrorMatchingInlineSnapshot(
      `"Couldn't match regex with line '@@ invalid hunk header @@'"`
    );
  });
});

describe("getDiffForFile", () => {
  it("should get the staged diff of a file", () => {
    mockedChildProcess.execSync.mockReturnValueOnce(Buffer.from(hunks));
    process.env.ESLINT_PLUGIN_DIFF_COMMIT = "1234567";

    const diffFromFile = getDiffForFile("./mockfile.js", true);

    const expectedArguments =
      'git diff --diff-algorithm=histogram --diff-filter=ACM --relative --staged --unified=0 "1234567"';
    expect(
      mockedChildProcess.execSync.mock.calls[
        mockedChildProcess.execSync.mock.calls.length - 1
      ][0]
        .split(" -- ")
        .shift()
    ).toEqual(expectedArguments);
    expect(diffFromFile).toContain("diff --git");
    expect(diffFromFile).toContain("@@");
  });

  it("should hit the cached diff of a file", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execSync.mockReturnValueOnce(Buffer.from(hunks));

    expect(mockedChildProcess.execSync).toHaveBeenCalledTimes(0);
    const diffFromFileA = getDiffForFile("./mockfileCache.js");
    const diffFromFileB = getDiffForFile("./mockfileCache.js");
    expect(mockedChildProcess.execSync).toHaveBeenCalledTimes(1);
    expect(diffFromFileA).toEqual(diffFromFileB);

    mockedChildProcess.execSync.mockReturnValueOnce(Buffer.from(hunks));
    getDiffForFile("./mockfileMiss.js");
    expect(mockedChildProcess.execSync).toHaveBeenCalledTimes(2);
  });
});

describe("hasCleanIndex", () => {
  it("returns false instead of throwing", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execSync.mockImplementationOnce(() => {
      throw Error("mocked error");
    });
    expect(hasCleanIndex("")).toEqual(false);
    expect(mockedChildProcess.execSync).toHaveBeenCalled();
  });

  it("returns true otherwise", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execSync.mockReturnValue(Buffer.from(""));
    expect(hasCleanIndex("")).toEqual(true);
    expect(mockedChildProcess.execSync).toHaveBeenCalled();
  });
});

describe("getDiffFileList", () => {
  it("should get the list of staged files", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execSync.mockReturnValueOnce(Buffer.from(diffFileList));
    expect(mockedChildProcess.execSync).toHaveBeenCalledTimes(0);
    const fileListA = getDiffFileList();
    const fileListB = getDiffFileList();

    expect(mockedChildProcess.execSync).toHaveBeenCalledTimes(1);
    expect(fileListA).toEqual(
      ["file1", "file2", "file3"].map((p) => path.resolve(p))
    );
    expect(fileListA).toEqual(fileListB);
  });
});

describe("getUntrackedFileList", () => {
  it("should get the list of untracked files", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execSync.mockReturnValueOnce(Buffer.from(diffFileList));
    expect(mockedChildProcess.execSync).toHaveBeenCalledTimes(0);
    const fileListA = getUntrackedFileList();
    const staged = false;
    const fileListB = getUntrackedFileList(staged);

    expect(mockedChildProcess.execSync).toHaveBeenCalledTimes(1);
    expect(fileListA).toEqual(
      ["file1", "file2", "file3"].map((p) => path.resolve(p))
    );
    expect(fileListA).toEqual(fileListB);
  });

  it("should not get a list when looking when using staged", () => {
    const staged = true;
    expect(getUntrackedFileList(staged)).toEqual([]);
  });
});

describe("getGitFileList", () => {
  it("should get the list of committed files", () => {
    mockedChildProcess.execSync.mockReturnValueOnce(Buffer.from(diffFileList));
    expect(getGitFileList()).toEqual(
      ["file1", "file2", "file3"].map((p) => path.resolve(p))
    );
  });
});
