import * as child_process from "child_process";
import type { Linter } from "eslint";
import { mocked } from "jest-mock";
import * as git from "./git";
import { diff, diffConfig, staged, stagedConfig } from "./processors";
import {
  diff as fixtureDiff,
  staged as fixtureStaged,
} from "./__fixtures__/diff";
import { postprocessArguments } from "./__fixtures__/postprocessArguments";

jest.mock("child_process");
const mockedChildProcess = mocked(child_process, true);
const mockFilename = '/mock filename with quotes ", semicolons ; and spaces.js';
mockedChildProcess.execSync.mockReturnValue(Buffer.from(mockFilename));
const mockedGit = mocked(git, true);

// @ts-expect-error todo: fix type error here
mockedGit.getDiffFileList = jest.fn();

const [messages, filename] = postprocessArguments;

describe("processors", () => {
  const validFilename = filename;
  const sourceCode = "/** Some source code */";

  it("diff preprocess", () => {
    mockedChildProcess.execSync.mockReturnValue(Buffer.from(fixtureDiff));

    expect(
      diff.preprocess && diff.preprocess(sourceCode, validFilename)
    ).toEqual([sourceCode]);
  });

  /**
   * Linked issue: https://github.com/paleite/eslint-plugin-diff/issues/14
   */
  it("diff preprocess should not exclude files in a Vscode plugin context", () => {
    process.env.VSCODE_CLI = "true";
    process.env.VSCODE_PID = "9293";

    mockedChildProcess.execSync.mockReturnValue(Buffer.from(""));

    expect(
      diff.preprocess && diff.preprocess(sourceCode, validFilename)
    ).toEqual([sourceCode]);

    // clean it up
    process.env.VSCODE_PID = undefined;
    process.env.VSCODE_CLI = undefined;
  });

  it("staged preprocess", () => {
    mockedChildProcess.execSync.mockReturnValue(Buffer.from(fixtureDiff));

    expect(
      diff.preprocess && diff.preprocess(sourceCode, validFilename)
    ).toEqual([sourceCode]);
  });

  it("diff postprocess", () => {
    mockedChildProcess.execSync.mockReturnValue(Buffer.from(fixtureDiff));

    expect(
      diff.postprocess && diff.postprocess(messages, filename)
    ).toMatchSnapshot();

    expect(mockedChildProcess.execSync).toHaveBeenCalled();
  });

  it("staged postprocess", () => {
    mockedChildProcess.execSync.mockReturnValue(Buffer.from(fixtureStaged));

    expect(
      staged.postprocess && staged.postprocess(messages, filename)
    ).toMatchSnapshot();

    expect(mockedChildProcess.execSync).toHaveBeenCalled();
  });

  it("should report fatal errors", () => {
    mockedChildProcess.execSync.mockReturnValue(Buffer.from(fixtureDiff));

    const [[firstMessage, ...restMessage], ...restMessageArray] = messages;
    const messagesWithFatal: Linter.LintMessage[][] = [
      [{ ...firstMessage, fatal: true }, ...restMessage],
      ...restMessageArray,
    ];

    expect(
      diff.postprocess && diff.postprocess(messages, filename)
    ).toHaveLength(2);
    expect(
      diff.postprocess && diff.postprocess(messagesWithFatal, filename)
    ).toHaveLength(3);

    expect(mockedChildProcess.execSync).toHaveBeenCalled();
  });
});

describe("configs", () => {
  it("diff", () => {
    expect(diffConfig).toMatchSnapshot();
  });

  it("staged", () => {
    expect(stagedConfig).toMatchSnapshot();
  });
});
