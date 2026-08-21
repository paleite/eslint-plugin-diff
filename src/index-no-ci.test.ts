import type * as GitModule from "./git.js";

jest.mock("./git", () => {
  const actualGit = jest.requireActual("./git") as unknown as typeof GitModule;
  return {
    ...actualGit,
    getDiffSnapshot: jest.fn(),
    resolveExactBase: jest.fn(),
  };
});

import * as git from "./git";

const importIndex = async () => import("./index.js");

describe("inert import", () => {
  it("does not execute Git while importing the package", async () => {
    await importIndex();
    expect(jest.mocked(git.getDiffSnapshot)).not.toHaveBeenCalled();
    expect(jest.mocked(git.resolveExactBase)).not.toHaveBeenCalled();
  });
});
