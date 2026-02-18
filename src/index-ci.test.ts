process.env["ESLINT_PLUGIN_DIFF_COMMIT"] = "some-branch";
process.env["CI"] = "true";
import * as child_process from "child_process";

jest.mock("child_process");
const mockedChildProcess = jest.mocked(child_process, { shallow: true });
mockedChildProcess.execFileSync.mockReturnValue(
  Buffer.from("line1\nline2\nline3"),
);

import "./index";

describe("CI", () => {
  it("should use branch as provided", () => {
    expect(process.env["CI"]).toBeDefined();
    expect(process.env["ESLINT_PLUGIN_DIFF_COMMIT"]).toEqual("some-branch");
  });
});
