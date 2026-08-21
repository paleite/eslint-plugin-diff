import * as path from "node:path";

import type { Linter } from "eslint";
import { ESLint } from "eslint";

import { createTestRepository } from "./__fixtures__/gitRepository";
import { createProcessor } from "./processors";

const withCwd = async <T>(
  directory: string,
  callback: () => Promise<T>,
): Promise<T> => {
  const previous = process.cwd();
  process.chdir(directory);
  try {
    return await callback();
  } finally {
    process.chdir(previous);
  }
};

const lintFile = async (
  directory: string,
  filename: string,
  processor: ReturnType<typeof createProcessor>,
  rules: Linter.RulesRecord,
) => {
  const eslint = new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.js"],
        languageOptions: { ecmaVersion: "latest", sourceType: "module" },
        processor,
        rules,
      },
    ],
  });
  const [result] = await eslint.lintFiles([filename]);
  return result?.messages ?? [];
};

describe("ESLint 10 processor integration", () => {
  it("reports a multiline diagnostic when an interior changed line intersects its span", async () => {
    const repo = createTestRepository();
    try {
      const base = `const firstCondition = true;
const oldCondition = true;
const changedCondition = true;
const thirdCondition = true;

if (
  firstCondition &&
  oldCondition &&
  thirdCondition
) {
  console.log("run");
}
`;
      const current = base.replace(
        "  oldCondition &&",
        "  changedCondition &&",
      );
      repo.write("fixture.js", base);
      repo.commit("base");
      repo.write("fixture.js", current);

      const messages = await withCwd(repo.directory, () =>
        lintFile(
          repo.directory,
          path.join(repo.directory, "fixture.js"),
          createProcessor({ mode: "diff" }),
          {
            "no-restricted-syntax": [
              "error",
              {
                selector: "IfStatement",
                message: "Diagnostic span experiment",
              },
            ],
          },
        ),
      );

      const diagnostic = messages.find(
        (message) => message.ruleId === "no-restricted-syntax",
      );
      expect(diagnostic?.line).toBe(6);
      expect(diagnostic?.endLine).toBe(12);
      expect(diagnostic).toBeDefined();
    } finally {
      repo.cleanup();
    }
  });

  it("keeps non-local unused-variable diagnostics only when configured outside changed lines", async () => {
    const repo = createTestRepository();
    try {
      repo.write("fixture.js", "const value = 1;\nconsole.log(value);\n");
      repo.commit("base");
      repo.write("fixture.js", "const value = 1;\n");
      const filename = path.join(repo.directory, "fixture.js");

      const defaultMessages = await withCwd(repo.directory, () =>
        lintFile(repo.directory, filename, createProcessor({ mode: "diff" }), {
          "no-unused-vars": "error",
        }),
      );
      expect(defaultMessages).toEqual([]);

      const configuredMessages = await withCwd(repo.directory, () =>
        lintFile(
          repo.directory,
          filename,
          createProcessor({
            mode: "diff",
            rulesReportedOutsideChangedLines: ["no-unused-vars"],
          }),
          { "no-unused-vars": "error" },
        ),
      );
      expect(configuredMessages.map(({ ruleId }) => ruleId)).toEqual([
        "no-unused-vars",
      ]);
    } finally {
      repo.cleanup();
    }
  });

  it("does not lint an unchanged file only because its rule is configured file-wide", async () => {
    const repo = createTestRepository();
    try {
      repo.write("fixture.js", "const unused = 1;\n");
      repo.commit("base");
      const messages = await withCwd(repo.directory, () =>
        lintFile(
          repo.directory,
          path.join(repo.directory, "fixture.js"),
          createProcessor({
            mode: "diff",
            rulesReportedOutsideChangedLines: ["no-unused-vars"],
          }),
          { "no-unused-vars": "error" },
        ),
      );
      expect(messages).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  it("treats an exact rename as changed-file scope with zero ordinary changed lines", async () => {
    const repo = createTestRepository();
    try {
      repo.write("old.js", "const unused = 1;\n");
      repo.commit("base");
      repo.git(["mv", "old.js", "new.js"]);
      const filename = path.join(repo.directory, "new.js");

      const normalMessages = await withCwd(repo.directory, () =>
        lintFile(repo.directory, filename, createProcessor({ mode: "diff" }), {
          "no-unused-vars": "error",
        }),
      );
      expect(normalMessages).toEqual([]);

      const fileWideMessages = await withCwd(repo.directory, () =>
        lintFile(
          repo.directory,
          filename,
          createProcessor({
            mode: "diff",
            rulesReportedOutsideChangedLines: ["no-unused-vars"],
          }),
          { "no-unused-vars": "error" },
        ),
      );
      expect(fileWideMessages.map(({ ruleId }) => ruleId)).toEqual([
        "no-unused-vars",
      ]);
    } finally {
      repo.cleanup();
    }
  });
});
