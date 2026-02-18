import type { Linter } from "eslint";

const OLD_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...OLD_ENV };
  delete process.env["CI"];
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe("processors without CI", () => {
  it("exports a no-op CI processor and CI config", async () => {
    jest.doMock("./git", () => ({
      ...jest.requireActual<typeof import("./git")>("./git"),
      getDiffFileList: jest.fn(() => []),
      getUntrackedFileList: jest.fn(() => []),
      getDiffForFile: jest.fn(() => ""),
      hasCleanIndex: jest.fn(() => true),
    }));

    const { ci, ciConfig } = await import("./processors");

    const sourceCode = "/** Some source code */";
    const filename = "file.ts";
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

    expect(ci.preprocess(sourceCode, filename)).toEqual([sourceCode]);
    expect(ci.postprocess(messages, filename)).toEqual(messages.flat());
    expect(ciConfig).toEqual({
      plugins: ["diff"],
      overrides: [{ files: ["*"], processor: "diff/ci" }],
    });
  });
});

export {};
