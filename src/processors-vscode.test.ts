jest.mock("./git", () => ({
  ...jest.requireActual<typeof git>("./git"),
  getUntrackedFileList: jest.fn(),
  getDiffFileList: jest.fn(),
  getDiffForFile: jest.fn(),
  hasCleanIndex: jest.fn(),
}));

import type * as git from "./git";
const importGit = async (): Promise<typeof import("./git.js")> =>
  import("./git.js");
const importProcessors = async (): Promise<typeof import("./processors.js")> =>
  import("./processors.js");

const OLD_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  process.env = { ...OLD_ENV };
  delete process.env["VSCODE_PID"];
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe("VS Code preprocess", () => {
  it("refreshes diff file list once so first edit is processed", async () => {
    const filename = "/tmp/first-edit.ts";
    const sourceCode = "/** Some source code */";
    const gitMocked: jest.MockedObjectDeep<typeof git> = jest.mocked(
      await importGit(),
    );

    // Processor import does not initialize snapshots; initialization is lazy.
    gitMocked.getDiffFileList
      .mockReturnValue([filename])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([filename]);
    gitMocked.getUntrackedFileList.mockReturnValue([]);

    process.env["VSCODE_PID"] = "1234";
    const { diff } = await importProcessors();
    expect(gitMocked.getDiffFileList).not.toHaveBeenCalled();

    expect(diff.preprocess(sourceCode, filename)).toEqual([sourceCode]);
    expect(gitMocked.getDiffFileList.mock.calls.length).toBe(2);
  });
});
