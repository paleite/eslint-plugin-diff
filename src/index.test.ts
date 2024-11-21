process.env.CI = "true";
import * as child_process from "child_process";

jest.mock("child_process");
const mockedChildProcess = jest.mocked(child_process, { shallow: true });
mockedChildProcess.execFileSync.mockReturnValue("line1\nline2\nline3");

import { configs, processors } from "./index";

describe("plugin", () => {
  it("should match expected export", () => {
    expect(configs).toMatchSnapshot();
    expect(processors).toMatchSnapshot();
  });
});
