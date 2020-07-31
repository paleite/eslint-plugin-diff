import * as child_process from "child_process";
import { mocked } from "ts-jest/utils";
import {
  diff as fixtureDiff,
  staged as fixtureStaged,
} from "./__fixtures__/diff";

jest.mock("child_process");

const mockedChildProcess = mocked(child_process, true);
import { diff, diffConfig, staged, stagedConfig } from "./processors";
import { postprocessArguments } from "./__fixtures__/postprocessArguments";

const [messages, filename] = postprocessArguments;

describe("processors", () => {
  it("diff", () => {
    mockedChildProcess.execSync.mockReturnValue(Buffer.from(fixtureDiff));

    expect(diff.postprocess(messages, filename)).toMatchSnapshot();

    expect(mockedChildProcess.execSync).toHaveBeenCalled();
  });

  it("staged", () => {
    mockedChildProcess.execSync.mockReturnValue(Buffer.from(fixtureStaged));

    expect(staged.postprocess(messages, filename)).toMatchSnapshot();

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
