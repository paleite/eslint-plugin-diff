import * as child_process from "child_process";

jest.mock("child_process");
const mockedChildProcess = jest.mocked(child_process, true);
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
