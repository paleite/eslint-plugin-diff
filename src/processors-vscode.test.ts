jest.mock("./git", () => ({
  ...jest.requireActual<typeof git>("./git"),
  getTrackedFileList: jest.fn(),
  getDiffFileList: jest.fn(),
  getDiffForFile: jest.fn(),
  hasCleanIndex: jest.fn(),
}));

import type { Linter } from "eslint";

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
    gitMocked.getTrackedFileList.mockReturnValue([filename]);

    process.env["VSCODE_PID"] = "1234";
    const { diff } = await importProcessors();
    expect(gitMocked.getDiffFileList).not.toHaveBeenCalled();

    expect(diff.preprocess(sourceCode, filename)).toEqual([sourceCode]);
    expect(gitMocked.getDiffFileList.mock.calls.length).toBe(2);
  });

  it("keeps reporting diagnostics when a file becomes tracked mid-session", async () => {
    const filename = "/tmp/new-file.ts";
    const sourceCode = "/** Some source code */";
    const messages: Linter.LintMessage[][] = [
      [
        {
          ruleId: "mock",
          severity: 1,
          message: "mock msg",
          line: 1,
          column: 1,
        },
      ],
    ];
    const gitMocked: jest.MockedObjectDeep<typeof git> = jest.mocked(
      await importGit(),
    );

    // Simulate processor startup before file is tracked.
    gitMocked.getTrackedFileList.mockReturnValue([]);
    gitMocked.getDiffFileList
      .mockReturnValue([filename])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([filename]);
    gitMocked.getDiffForFile.mockReturnValue("");

    process.env["VSCODE_PID"] = "1234";
    const { diff } = await importProcessors();

    expect(diff.preprocess(sourceCode, filename)).toEqual([sourceCode]);
    expect(diff.postprocess(messages, filename)).toEqual(messages.flat());
    expect(gitMocked.getDiffForFile).not.toHaveBeenCalled();
  });
});
