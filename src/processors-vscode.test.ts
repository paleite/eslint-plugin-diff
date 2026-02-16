jest.mock("./git", () => ({
  ...jest.requireActual<typeof git>("./git"),
  getUntrackedFileList: jest.fn(),
  getDiffFileList: jest.fn(),
  getDiffForFile: jest.fn(),
  hasCleanIndex: jest.fn(),
}));

import type * as git from "./git";

const OLD_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  process.env = { ...OLD_ENV };
  delete process.env.VSCODE_PID;
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe("VS Code preprocess", () => {
  it("refreshes diff file list once so first edit is processed", async () => {
    const filename = "/tmp/first-edit.ts";
    const sourceCode = "/** Some source code */";
    const gitMocked: jest.MockedObjectDeep<typeof git> = jest.mocked(
      await import("./git"),
    );

    // Module initialization creates both `diff` and `staged` processors.
    gitMocked.getDiffFileList
      .mockReturnValue([filename])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([filename]);
    gitMocked.getUntrackedFileList.mockReturnValue([]);

    process.env.VSCODE_PID = "1234";
    const { diff } = await import("./processors");

    expect(diff.preprocess(sourceCode, filename)).toEqual([sourceCode]);
    expect(gitMocked.getDiffFileList.mock.calls.length).toBeGreaterThanOrEqual(
      3,
    );
  });
});
