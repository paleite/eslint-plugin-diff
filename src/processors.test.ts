import * as child_process from "child_process";
import type { Linter } from "eslint";
import { mocked } from "jest-mock";
import { diff, diffConfig, staged, stagedConfig } from "./processors";
import {
  diff as fixtureDiff,
  staged as fixtureStaged,
} from "./__fixtures__/diff";
import { postprocessArguments } from "./__fixtures__/postprocessArguments";

jest.mock("child_process");
const mockedChildProcess = mocked(child_process, true);
mockedChildProcess.execFileSync.mockReturnValue(
  Buffer.from('/mock filename ", ; .js')
);
jest.mock("./git", (): unknown => ({
  ...jest.requireActual("./git"),
  getDiffFileList: jest
    .fn()
    .mockReturnValue(['/mock filename ", ; .js', "README.md"]),
}));

const [messages, filename] = postprocessArguments;

describe("processors", () => {
  it("diff preprocess", () => {
    const validFilename = filename;
    const sourceCode = "/** Some source code */";

    mockedChildProcess.execFileSync.mockReturnValue(Buffer.from(fixtureDiff));

    expect(diff.preprocess(sourceCode, validFilename)).toEqual([sourceCode]);
  });

  it("staged preprocess", () => {
    const validFilename = filename;
    const sourceCode = "/** Some source code */";

    mockedChildProcess.execFileSync.mockReturnValue(Buffer.from(fixtureDiff));

    expect(diff.preprocess(sourceCode, validFilename)).toEqual([sourceCode]);
  });

  it("diff postprocess", () => {
    mockedChildProcess.execFileSync.mockReturnValue(Buffer.from(fixtureDiff));

    expect(diff.postprocess(messages, filename)).toMatchSnapshot();

    expect(mockedChildProcess.execFileSync).toHaveBeenCalled();
  });

  it("staged postprocess", () => {
    mockedChildProcess.execFileSync.mockReturnValue(Buffer.from(fixtureStaged));

    expect(staged.postprocess(messages, filename)).toMatchSnapshot();

    expect(mockedChildProcess.execFileSync).toHaveBeenCalled();
  });

  it("should report fatal errors", () => {
    mockedChildProcess.execFileSync.mockReturnValue(Buffer.from(fixtureDiff));

    const [[firstMessage, ...restMessage], ...restMessageArray] = messages;
    const messagesWithFatal: Linter.LintMessage[][] = [
      [{ ...firstMessage, fatal: true }, ...restMessage],
      ...restMessageArray,
    ];

    expect(diff.postprocess(messages, filename)).toHaveLength(2);
    expect(diff.postprocess(messagesWithFatal, filename)).toHaveLength(3);

    expect(mockedChildProcess.execFileSync).toHaveBeenCalled();
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
