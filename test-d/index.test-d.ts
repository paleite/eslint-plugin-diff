import type { Linter } from "eslint";
import { expectType } from "tsd";

import plugin, {
  composeProcessor,
  createProcessor,
  type DiffProcessor,
  type ProcessorOptions,
} from "..";

const options: ProcessorOptions = {
  mode: "ci",
  rulesReportedOutsideChangedLines: ["example/rule"],
};

expectType<DiffProcessor>(createProcessor(options));
expectType<DiffProcessor>(plugin.createProcessor({ mode: "diff" }));
expectType<DiffProcessor>(composeProcessor({}, { mode: "staged" }));
expectType<DiffProcessor>(plugin.composeProcessor({}, options));
expectType<Linter.Processor>(plugin.createProcessor({ mode: "diff" }));

// @ts-expect-error mode is required
createProcessor({});
// @ts-expect-error legacy string compose mode is removed
composeProcessor({}, "diff");
// @ts-expect-error legacy configs are removed
plugin.configs;
// @ts-expect-error static processors are removed
plugin.processors;
