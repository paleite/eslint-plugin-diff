process.env.CI = "true";
import * as child_process from "child_process";

jest.mock("child_process");
const mockedChildProcess = jest.mocked(child_process, { shallow: true });
mockedChildProcess.execFileSync.mockReturnValue(
  Buffer.from("line1\nline2\nline3"),
);

import { configs, processors } from "./index";

describe("plugin", () => {
  it("should match expected export", () => {
    const flatDiff = configs["flat/diff"] as {
      processor: string;
      plugins: { diff: unknown };
    }[];
    const flatCi = configs["flat/ci"] as { processor: string }[];
    const flatStaged = configs["flat/staged"] as { processor: string }[];

    expect(Object.keys(configs).sort()).toEqual([
      "ci",
      "diff",
      "flat/ci",
      "flat/diff",
      "flat/staged",
      "staged",
    ]);
    expect(flatDiff[0]?.processor).toBe("diff/diff");
    expect(flatCi[0]?.processor).toBe("diff/ci");
    expect(flatStaged[0]?.processor).toBe("diff/staged");
    expect(flatDiff[0]?.plugins.diff).toBeDefined();

    expect(processors).toMatchSnapshot();
  });
});
