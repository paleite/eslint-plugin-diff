jest.mock("./git", () => ({
  ...jest.requireActual<typeof git>("./git"),
  getUntrackedFileList: jest.fn(),
  getDiffFileList: jest.fn(),
  getDiffForFile: jest.fn(),
  hasCleanIndex: jest.fn(),
}));

import type { Linter } from "eslint";
import * as git from "./git";
import {
  diff as fixtureDiff,
  staged as fixtureStaged,
} from "./__fixtures__/diff";
import { postprocessArguments } from "./__fixtures__/postprocessArguments";

const [messages, filename] = postprocessArguments;
const untrackedFilename = "an-untracked-file.js";

const gitMocked: jest.MockedObjectDeep<typeof git> = jest.mocked(git);
gitMocked.getDiffFileList.mockReturnValue([filename]);
gitMocked.getUntrackedFileList.mockReturnValue([untrackedFilename]);

describe("processors", () => {
  it("preprocess (diff and staged)", async () => {
    // The preprocessor does not depend on `staged` being true or false, so it's
    // sufficient to only test one of them.
    const validFilename = filename;
    const sourceCode = "/** Some source code */";

    const { diff: diffProcessors } = await import("./processors");

    expect(diffProcessors.preprocess(sourceCode, validFilename)).toEqual([
      sourceCode,
    ]);
  });

  it("diff postprocess", async () => {
    gitMocked.getDiffForFile.mockReturnValue(fixtureDiff);

    const { diff: diffProcessors } = await import("./processors");

    expect(diffProcessors.postprocess(messages, filename)).toMatchSnapshot();
  });

  it("diff postprocess with no messages", async () => {
    gitMocked.getDiffForFile.mockReturnValue(fixtureDiff);

    const { diff: diffProcessors } = await import("./processors");

    const noMessages: Linter.LintMessage[][] = [];
    expect(diffProcessors.postprocess(noMessages, filename)).toEqual(
      noMessages
    );
  });

  it("diff postprocess for untracked files with messages", async () => {
    gitMocked.getDiffForFile.mockReturnValue(fixtureDiff);

    const { staged: stagedProcessors } = await import("./processors");

    const untrackedFilesMessages: Linter.LintMessage[] = [
      { ruleId: "mock", severity: 1, message: "mock msg", line: 1, column: 1 },
    ];

    expect(
      stagedProcessors.postprocess([untrackedFilesMessages], untrackedFilename)
    ).toEqual(untrackedFilesMessages);
  });

  it("staged postprocess", async () => {
    gitMocked.hasCleanIndex.mockReturnValueOnce(true);
    gitMocked.getDiffForFile.mockReturnValueOnce(fixtureStaged);

    const { staged: stagedProcessors } = await import("./processors");

    expect(stagedProcessors.postprocess(messages, filename)).toMatchSnapshot();
  });

  it("should report fatal errors", async () => {
    gitMocked.getDiffForFile.mockReturnValue(fixtureDiff);
    const [[firstMessage, ...restMessage], ...restMessageArray] = messages;
    const messagesWithFatal: Linter.LintMessage[][] = [
      [{ ...firstMessage, fatal: true }, ...restMessage],
      ...restMessageArray,
    ];

    const { diff: diffProcessors } = await import("./processors");

    expect(diffProcessors.postprocess(messages, filename)).toHaveLength(2);
    expect(
      diffProcessors.postprocess(messagesWithFatal, filename)
    ).toHaveLength(3);
  });
});

describe("configs", () => {
  it("diff", async () => {
    const { diffConfig } = await import("./processors");
    expect(diffConfig).toMatchSnapshot();
  });

  it("staged", async () => {
    const { stagedConfig } = await import("./processors");
    expect(stagedConfig).toMatchSnapshot();
  });
});

describe("fatal error-message", () => {
  it("getUnstagedChangesError", async () => {
    const { getUnstagedChangesError } = await import("./processors");

    const [result] = getUnstagedChangesError("mock filename.ts");
    expect(result.fatal).toBe(true);
    expect(result.message).toMatchInlineSnapshot(
      '"mock filename.ts has unstaged changes. Please stage or remove the changes."'
    );
  });
});
