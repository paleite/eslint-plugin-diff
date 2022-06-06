import * as child_process from "child_process";
import { mocked } from "jest-mock";
import path from "path";
import {
  getDiffFileList,
  getDiffForFile,
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
    mockedChildProcess.execFileSync.mockReturnValueOnce(Buffer.from(hunks));
    process.env.ESLINT_PLUGIN_DIFF_COMMIT = "1234567";

    const diffFromFile = getDiffForFile("./mockfile.js", true);

    const expectedCommand = "git";
    const expectedArgs =
      'diff --diff-algorithm=histogram --diff-filter=ACM -M100% --relative --staged --unified=0 "1234567"';

    const lastCall = mockedChildProcess.execFileSync.mock.calls.at(-1);
    const [command, argsIncludingFile = []] = lastCall ?? [""];
    const args = argsIncludingFile.slice(0, argsIncludingFile.length - 2);

    expect(command).toBe(expectedCommand);
    expect(args.join(" ")).toEqual(expectedArgs);
    expect(diffFromFile).toContain("diff --git");
    expect(diffFromFile).toContain("@@");
  });
});

describe("hasCleanIndex", () => {
  it("returns false instead of throwing", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync.mockImplementationOnce(() => {
      throw Error("mocked error");
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

describe("getDiffFileList", () => {
  it("should get the list of staged files", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync.mockReturnValueOnce(
      Buffer.from(diffFileList)
    );
    expect(mockedChildProcess.execFileSync).toHaveBeenCalledTimes(0);
    const fileListA = getDiffFileList();

    expect(mockedChildProcess.execFileSync).toHaveBeenCalledTimes(1);
    expect(fileListA).toEqual(
      ["file1", "file2", "file3"].map((p) => path.resolve(p))
    );
  });
});

describe("getUntrackedFileList", () => {
  it("should get the list of untracked files", () => {
    jest.mock("child_process").resetAllMocks();
    mockedChildProcess.execFileSync.mockReturnValueOnce(
      Buffer.from(diffFileList)
    );
    expect(mockedChildProcess.execFileSync).toHaveBeenCalledTimes(0);
    const fileListA = getUntrackedFileList();
    expect(mockedChildProcess.execFileSync).toHaveBeenCalledTimes(1);

    mockedChildProcess.execFileSync.mockReturnValueOnce(
      Buffer.from(diffFileList)
    );
    const staged = false;
    const fileListB = getUntrackedFileList(staged);
    expect(mockedChildProcess.execFileSync).toHaveBeenCalledTimes(2);

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
