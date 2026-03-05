jest.mock("./git", () => ({
  ...jest.requireActual<typeof git>("./git"),
  getTrackedFileList: jest.fn(),
  getDiffFileList: jest.fn(),
  getDiffForFile: jest.fn(),
  hasCleanIndex: jest.fn(),
  hasCleanTree: jest.fn(),
  readFileFromGit: jest.fn(),
}));

import type { Linter } from "eslint";

import {
  diff as fixtureDiff,
  staged as fixtureStaged,
} from "./__fixtures__/diff";
import { postprocessArguments } from "./__fixtures__/postprocessArguments";
import * as git from "./git";
const importProcessors = async (): Promise<typeof import("./processors.js")> =>
  import("./processors.js");

const [messages, filename] = postprocessArguments;
const untrackedFilename = "an-untracked-file.js";
const trackedUnchangedFilename = "tracked-unchanged-file.js";

const gitMocked: jest.MockedObjectDeep<typeof git> = jest.mocked(git);
gitMocked.getDiffFileList.mockReturnValue([filename]);
gitMocked.getTrackedFileList.mockReturnValue([
  filename,
  "file-with-dirty-index.js",
  trackedUnchangedFilename,
]);

describe("processors", () => {
  it("preprocess (diff and staged)", async () => {
    // The preprocessor does not depend on `staged` being true or false, so it's
    // sufficient to only test one of them.
    const validFilename = filename;
    const sourceCode = "/** Some source code */";

    const { diff: diffProcessors } = await importProcessors();

    expect(diffProcessors.preprocess(sourceCode, validFilename)).toEqual([
      sourceCode,
    ]);
  });

  it("committed preprocess reads content from git when working tree is dirty", async () => {
    const sourceCode = "/** Working tree content */";
    gitMocked.hasCleanTree.mockReturnValueOnce(false);
    gitMocked.readFileFromGit.mockReturnValueOnce("/** HEAD content */");

    const { committed: committedProcessor } = await importProcessors();

    expect(committedProcessor.preprocess(sourceCode, filename)).toEqual([
      "/** HEAD content */",
    ]);
    expect(gitMocked.hasCleanTree).toHaveBeenCalledWith(filename);
    expect(gitMocked.readFileFromGit).toHaveBeenCalledWith(filename);
  });

  it("preprocess does not repeatedly refresh unknown files", async () => {
    const sourceCode = "/** Some source code */";
    const unchangedTrackedFilename = trackedUnchangedFilename;

    const { diff: diffProcessors } = await importProcessors();
    const trackedCallsBefore = gitMocked.getTrackedFileList.mock.calls.length;

    expect(
      diffProcessors.preprocess(sourceCode, unchangedTrackedFilename),
    ).toEqual([]);
    expect(
      diffProcessors.preprocess(sourceCode, unchangedTrackedFilename),
    ).toEqual([]);
    expect(gitMocked.getTrackedFileList.mock.calls.length).toBe(
      trackedCallsBefore,
    );
  });

  it("diff postprocess", async () => {
    gitMocked.getDiffForFile.mockReturnValue(fixtureDiff);

    const { diff: diffProcessors } = await importProcessors();

    expect(diffProcessors.postprocess(messages, filename)).toMatchSnapshot();
  });

  it("diff postprocess with no messages", async () => {
    gitMocked.getDiffForFile.mockReturnValue(fixtureDiff);

    const { diff: diffProcessors } = await importProcessors();

    const noMessages: Linter.LintMessage[][] = [];
    expect(diffProcessors.postprocess(noMessages, filename)).toEqual(
      noMessages,
    );
  });

  it("diff postprocess for untracked files with messages", async () => {
    gitMocked.getDiffForFile.mockReturnValue(fixtureDiff);

    const { staged: stagedProcessors } = await importProcessors();

    const untrackedFilesMessages: Linter.LintMessage[] = [
      { ruleId: "mock", severity: 1, message: "mock msg", line: 1, column: 1 },
    ];

    expect(
      stagedProcessors.postprocess([untrackedFilesMessages], untrackedFilename),
    ).toEqual(untrackedFilesMessages);
  });

  it("staged postprocess", async () => {
    gitMocked.hasCleanIndex.mockReturnValueOnce(true);
    gitMocked.getDiffForFile.mockReturnValueOnce(fixtureStaged);

    const { staged: stagedProcessors } = await importProcessors();

    expect(stagedProcessors.postprocess(messages, filename)).toMatchSnapshot();
  });

  it("committed processor disables autofix", async () => {
    const { committed: committedProcessor } = await importProcessors();

    expect(committedProcessor.supportsAutofix).toBe(false);
  });

  it("should report fatal errors", async () => {
    gitMocked.getDiffForFile.mockReturnValue(fixtureDiff);
    const [[firstMessage, ...restMessage], ...restMessageArray] = messages;
    const messagesWithFatal: Linter.LintMessage[][] = [
      [{ ...firstMessage, fatal: true }, ...restMessage],
      ...restMessageArray,
    ];

    const { diff: diffProcessors } = await importProcessors();

    expect(diffProcessors.postprocess(messages, filename)).toHaveLength(2);
    expect(
      diffProcessors.postprocess(messagesWithFatal, filename),
    ).toHaveLength(3);
  });

  it("should report fatal errors for staged postprocess with unclean index", async () => {
    gitMocked.hasCleanIndex.mockReturnValueOnce(false);
    gitMocked.getDiffForFile.mockReturnValueOnce(fixtureStaged);

    const { staged: stagedProcessors } = await importProcessors();

    const fileWithDirtyIndex = "file-with-dirty-index.js";
    const [errorMessage] = stagedProcessors.postprocess(
      messages,
      fileWithDirtyIndex,
    );

    expect(errorMessage?.fatal).toBe(true);
    expect(errorMessage?.message).toMatchInlineSnapshot(
      `"file-with-dirty-index.js has unstaged changes. Please stage or remove the changes."`,
    );
  });

  it("composeProcessor runs base preprocess for unknown files", async () => {
    const basePreprocess = jest.fn((text: string) => [text]);
    const baseProcessor: Linter.Processor = {
      preprocess: basePreprocess,
      postprocess: (processorMessages: Linter.LintMessage[][]) =>
        processorMessages.flat(),
      supportsAutofix: true,
    };
    const unknownFilename = "unknown-file.ts";

    const { composeProcessor } = await importProcessors();
    const composed = composeProcessor(baseProcessor, "diff");

    expect(composed.preprocess("text", unknownFilename)).toEqual(["text"]);
    expect(basePreprocess).toHaveBeenCalledTimes(1);
  });

  it("composeProcessor skips base preprocess for unchanged tracked files", async () => {
    const basePreprocess = jest.fn((text: string) => [text]);
    const baseProcessor: Linter.Processor = {
      preprocess: basePreprocess,
      postprocess: (processorMessages: Linter.LintMessage[][]) =>
        processorMessages.flat(),
      supportsAutofix: true,
    };

    const { composeProcessor } = await importProcessors();
    const composed = composeProcessor(baseProcessor, "diff");

    expect(composed.preprocess("text", trackedUnchangedFilename)).toEqual([]);
    expect(basePreprocess).not.toHaveBeenCalled();
  });

  it("composeProcessor runs base postprocess before diff filtering", async () => {
    gitMocked.getDiffForFile.mockReturnValue(fixtureDiff);
    const basePostprocess = jest.fn(
      (processorMessages: Linter.LintMessage[][]) =>
        processorMessages
          .flat()
          .map((message) => ({ ...message, line: message.line + 10 })),
    );
    const baseProcessor: Linter.Processor = {
      preprocess: (text: string) => [text],
      postprocess: basePostprocess,
      supportsAutofix: true,
    };

    const { composeProcessor } = await importProcessors();
    const composed = composeProcessor(baseProcessor, "diff");

    expect(composed.postprocess(messages, filename)).toEqual([]);
    expect(basePostprocess).toHaveBeenCalledTimes(1);
  });

  it("composeProcessor falls back to identity callbacks when omitted", async () => {
    const { composeProcessor } = await importProcessors();
    const composed = composeProcessor({}, "diff");
    const composedWithDefaultMode = composeProcessor({});

    expect(composed.preprocess("text", filename)).toEqual(["text"]);
    expect(composedWithDefaultMode.preprocess("text", filename)).toEqual([
      "text",
    ]);
    expect(composed.postprocess(messages, filename)).toHaveLength(2);
  });

  it("composeProcessor short-circuits postprocess when messages are empty", async () => {
    const basePostprocess = jest.fn(() => {
      throw new Error("base postprocess should not be called");
    });
    const baseProcessor: Linter.Processor = {
      preprocess: (text: string) => [text],
      postprocess: basePostprocess,
      supportsAutofix: true,
    };

    const { composeProcessor } = await importProcessors();
    const composed = composeProcessor(baseProcessor, "diff");

    expect(composed.postprocess([], filename)).toEqual([]);
    expect(basePostprocess).not.toHaveBeenCalled();
  });

  it("composeProcessor preserves processor metadata fields", async () => {
    const baseProcessor: Linter.Processor = {
      preprocess: (text: string) => [text],
      postprocess: (processorMessages: Linter.LintMessage[][]) =>
        processorMessages.flat(),
      supportsAutofix: true,
      meta: { name: "vue-processor", version: "1.0.0" },
    };

    const { composeProcessor } = await importProcessors();
    const composed = composeProcessor(baseProcessor, "diff");

    expect(composed.meta).toEqual(baseProcessor.meta);
  });
});

describe("configs", () => {
  it("diff", async () => {
    const { diffConfig } = await importProcessors();
    expect(diffConfig).toMatchSnapshot();
  });

  it("staged", async () => {
    const { stagedConfig } = await importProcessors();
    expect(stagedConfig).toMatchSnapshot();
  });

  it("committed", async () => {
    const { committedConfig } = await importProcessors();
    expect(committedConfig).toMatchSnapshot();
  });
});

describe("fatal error-message", () => {
  it("getUnstagedChangesError", async () => {
    const { getUnstagedChangesError } = await importProcessors();

    const [result] = getUnstagedChangesError("mock filename.ts");
    expect(result.fatal).toBe(true);
    expect(result.message).toMatchInlineSnapshot(
      '"mock filename.ts has unstaged changes. Please stage or remove the changes."',
    );
  });
});
