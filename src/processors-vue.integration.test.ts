import * as path from "node:path";

import type { Linter } from "eslint";
import { ESLint } from "eslint";
import vue from "eslint-plugin-vue";

import { createTestRepository } from "./__fixtures__/gitRepository";
import { composeProcessor } from "./processors";

const getVueProcessor = (): Linter.Processor => {
  const processors = vue.processors as Record<
    string,
    Linter.Processor | undefined
  >;
  const processor = processors["vue"] ?? processors[".vue"];
  if (processor === undefined) {
    throw new Error("eslint-plugin-vue did not expose its Vue processor.");
  }
  return processor;
};

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

const lintVue = async (
  directory: string,
  processor: Linter.Processor,
  rules: Linter.RulesRecord,
) => {
  const recommended = vue.configs["flat/recommended"] as Linter.Config[];
  const eslint = new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      ...recommended,
      {
        files: ["**/*.vue"],
        processor,
        rules,
      },
    ],
  });
  const [result] = await eslint.lintFiles([
    path.join(directory, "fixture.vue"),
  ]);
  return result?.messages ?? [];
};

describe("Vue processor composition", () => {
  it("preserves Vue directive handling before diff filtering", async () => {
    const repo = createTestRepository();
    try {
      const base = `<template>
  <div v-html="html" />
</template>
<script>
export default { data: () => ({ html: "<b>x</b>" }) };
</script>
`;
      const current = base.replace(
        '  <div v-html="html" />',
        '  <!-- eslint-disable-next-line vue/no-v-html -->\n  <div v-html="html" />',
      );
      repo.write("fixture.vue", base);
      repo.commit("base");
      repo.write("fixture.vue", current);

      const messages = await withCwd(repo.directory, () =>
        lintVue(
          repo.directory,
          composeProcessor(getVueProcessor(), { mode: "diff" }),
          {
            "vue/comment-directive": "error",
            "vue/no-v-html": "error",
          },
        ),
      );
      expect(
        messages.filter(({ ruleId }) => ruleId === "vue/no-v-html"),
      ).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  it("applies outside-changed-lines rules after Vue source remapping", async () => {
    const repo = createTestRepository();
    try {
      const base = `<template><div /></template>
<script>
const value = 1;
console.log(value);
</script>
`;
      const current = base.replace("console.log(value);\n", "");
      repo.write("fixture.vue", base);
      repo.commit("base");
      repo.write("fixture.vue", current);

      const messages = await withCwd(repo.directory, () =>
        lintVue(
          repo.directory,
          composeProcessor(getVueProcessor(), {
            mode: "diff",
            rulesReportedOutsideChangedLines: ["no-unused-vars"],
          }),
          { "no-unused-vars": "error" },
        ),
      );
      expect(messages.map(({ ruleId }) => ruleId)).toContain("no-unused-vars");
    } finally {
      repo.cleanup();
    }
  });
});
