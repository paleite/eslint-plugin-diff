jest.mock("./git", () => ({
  ...jest.requireActual<typeof git>("./git"),
  getTrackedFileList: jest.fn(),
  getDiffFileList: jest.fn(),
  getDiffForFile: jest.fn(),
  hasCleanIndex: jest.fn(),
}));

import { staged as fixtureStaged } from "./__fixtures__/diff";
import { postprocessArguments } from "./__fixtures__/postprocessArguments";
import type * as git from "./git";

const importGit = async (): Promise<typeof import("./git.js")> =>
  import("./git.js");
const importProcessors = async (): Promise<typeof import("./processors.js")> =>
  import("./processors.js");

const OLD_ENV = process.env;
const [, filename] = postprocessArguments;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  process.env = { ...OLD_ENV };
  delete process.env["ESLINT_PLUGIN_DIFF_INCLUDE_FIXES"];
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe("ESLINT_PLUGIN_DIFF_INCLUDE_FIXES", () => {
  it("does not include fix messages outside changed ranges by default", async () => {
    const [messages] = postprocessArguments;
    const gitMocked: jest.MockedObjectDeep<typeof git> = jest.mocked(
      await importGit(),
    );
    gitMocked.getDiffFileList.mockReturnValue([filename]);
    gitMocked.getTrackedFileList.mockReturnValue([filename]);
    gitMocked.getDiffForFile.mockReturnValue(fixtureStaged);
    gitMocked.hasCleanIndex.mockReturnValue(true);

    const { staged } = await importProcessors();
    const result = staged.postprocess(messages, filename);

    expect(result).toHaveLength(1);
    expect(result[0]?.line).toBe(2);
  });

  it("includes fix messages outside changed ranges when enabled", async () => {
    const [messages] = postprocessArguments;
    process.env["ESLINT_PLUGIN_DIFF_INCLUDE_FIXES"] = "true";

    const gitMocked: jest.MockedObjectDeep<typeof git> = jest.mocked(
      await importGit(),
    );
    gitMocked.getDiffFileList.mockReturnValue([filename]);
    gitMocked.getTrackedFileList.mockReturnValue([filename]);
    gitMocked.getDiffForFile.mockReturnValue(fixtureStaged);
    gitMocked.hasCleanIndex.mockReturnValue(true);

    const { staged } = await importProcessors();
    const result = staged.postprocess(messages, filename);

    expect(result).toHaveLength(2);
    expect(result[1]?.line).toBe(3);
    expect(result[1]?.fix).toBeDefined();
  });
});
