import * as child_process from "child_process";
import path from "path";
import { mocked } from "ts-jest/utils";
import {
  getDiffFileList,
  getDiffForFile,
  getGitFileList,
  getRangesForDiff,
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
    mockedChildProcess.execSync.mockReturnValue(Buffer.from(hunks));
    process.env.ESLINT_PLUGIN_DIFF_COMMIT = "1234567";

    const diffFromFile = getDiffForFile("./mockfile.js", true);

    const expectedArguments =
      'git diff --diff-filter=ACM --relative --staged --unified=0 "1234567"';
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

    const diffFromFileA = getDiffForFile("./mockfileCache.js");
    const diffFromFileB = getDiffForFile("./mockfileCache.js");
    expect(mockedChildProcess.execSync).toHaveBeenCalledTimes(1);
    expect(diffFromFileA).toEqual(diffFromFileB);

    mockedChildProcess.execSync.mockReturnValueOnce(Buffer.from(hunks));
    getDiffForFile("./mockfileMiss.js");
    expect(mockedChildProcess.execSync).toHaveBeenCalledTimes(2);
  });
});

describe("getDiffFileList", () => {
  it("should get the list of staged files", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execSync.mockReturnValue(Buffer.from(diffFileList));
    const staged = false;
    const fileList = getDiffFileList(staged);

    expect(mockedChildProcess.execSync).toHaveBeenCalled();
    expect(fileList).toEqual(
      ["file1", "file2", "file3"].map((p) => path.resolve(p))
    );
  });
});

describe("getGitFileList", () => {
  it("should get the list of committed files", () => {
    expect(getGitFileList()).toEqual(
      ["file1", "file2", "file3"].map((p) => path.resolve(p))
    );
  });
});
