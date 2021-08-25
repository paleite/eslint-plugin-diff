import * as child_process from "child_process";
import type { Linter } from "eslint";
import { mocked } from "ts-jest/utils";
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
mockedGit.getDiffFileList = jest
  .fn()
  .mockReturnValue([mockFilename, "README.md"]);

const [messages, filename] = postprocessArguments;

describe("processors", () => {
  it("diff preprocess", () => {
    const validFilename = filename;
    const sourceCode = "/** Some source code */";

    mockedChildProcess.execSync.mockReturnValue(Buffer.from(fixtureDiff));

    expect(diff.preprocess(sourceCode, validFilename)).toEqual([sourceCode]);
  });

  it("staged preprocess", () => {
    const validFilename = filename;
    const sourceCode = "/** Some source code */";

    mockedChildProcess.execSync.mockReturnValue(Buffer.from(fixtureDiff));

    expect(diff.preprocess(sourceCode, validFilename)).toEqual([sourceCode]);
  });

  it("diff postprocess", () => {
    mockedChildProcess.execSync.mockReturnValue(Buffer.from(fixtureDiff));

    expect(diff.postprocess(messages, filename)).toMatchSnapshot();

    expect(mockedChildProcess.execSync).toHaveBeenCalled();
  });

  it("staged postprocess", () => {
    mockedChildProcess.execSync.mockReturnValue(Buffer.from(fixtureStaged));

    expect(staged.postprocess(messages, filename)).toMatchSnapshot();

    expect(mockedChildProcess.execSync).toHaveBeenCalled();
  });

  it("should report fatal errors", () => {
    mockedChildProcess.execSync.mockReturnValue(Buffer.from(fixtureDiff));

    const [[firstMessage, ...restMessage], ...restMessageArray] = messages;
    const messagesWithFatal: Linter.LintMessage[][] = [
      [{ ...firstMessage, fatal: true }, ...restMessage],
      ...restMessageArray,
    ];

    expect(diff.postprocess(messages, filename)).toHaveLength(2);
    expect(diff.postprocess(messagesWithFatal, filename)).toHaveLength(3);

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
