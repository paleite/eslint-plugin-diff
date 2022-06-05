import * as child_process from "child_process";
import { mocked } from "jest-mock";

jest.mock("child_process");
const mockedChildProcess = mocked(child_process, true);
mockedChildProcess.execFileSync.mockReturnValue(
  Buffer.from("line1\nline2\nline3")
);

import { configs, processors } from "./index";

describe("plugin", () => {
  it("should match expected export", () => {
    expect(configs).toMatchSnapshot();
    expect(processors).toMatchSnapshot();
  });
});
