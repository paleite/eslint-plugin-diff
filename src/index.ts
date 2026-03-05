import type { ESLint, Linter } from "eslint";

import {
  ci,
  ciConfig,
  committed,
  committedConfig,
  composeProcessor,
  diff,
  diffConfig,
  staged,
  stagedConfig,
} from "./processors";

type FlatConfigEntry = {
  plugins: { diff: ESLint.Plugin };
  processor: string;
};

type PluginConfigs = {
  ci: typeof ciConfig;
  committed: typeof committedConfig;
  diff: typeof diffConfig;
  staged: typeof stagedConfig;
  "flat/ci": FlatConfigEntry[];
  "flat/committed": FlatConfigEntry[];
  "flat/diff": FlatConfigEntry[];
  "flat/staged": FlatConfigEntry[];
};

type ProcessorName = "diff/ci" | "diff/committed" | "diff/diff" | "diff/staged";
type ProcessorMode = "ci" | "committed" | "diff" | "staged";

type Processors = {
  readonly ci: typeof ci;
  readonly committed: typeof committed;
  readonly diff: typeof diff;
  readonly staged: typeof staged;
};

const processors: Processors = { ci, committed, diff, staged };

type DiffPlugin = {
  configs: PluginConfigs;
  processors: Processors;
  composeProcessor: (
    processor: Linter.Processor,
    mode?: ProcessorMode,
  ) => Linter.Processor;
};

function createFlatConfigForProcessor(
  plugin: DiffPlugin,
  processorName: ProcessorName,
): FlatConfigEntry[] {
  return [{ plugins: { diff: plugin }, processor: processorName }];
}

const plugin: DiffPlugin = (() => {
  const pluginDraft: DiffPlugin = {
    processors,
    composeProcessor,
    configs: {
      ci: ciConfig,
      committed: committedConfig,
      diff: diffConfig,
      staged: stagedConfig,
      "flat/ci": [],
      "flat/committed": [],
      "flat/diff": [],
      "flat/staged": [],
    },
  };

  pluginDraft.configs["flat/diff"] = createFlatConfigForProcessor(
    pluginDraft,
    "diff/diff",
  );
  pluginDraft.configs["flat/staged"] = createFlatConfigForProcessor(
    pluginDraft,
    "diff/staged",
  );
  pluginDraft.configs["flat/ci"] = createFlatConfigForProcessor(
    pluginDraft,
    "diff/ci",
  );
  pluginDraft.configs["flat/committed"] = createFlatConfigForProcessor(
    pluginDraft,
    "diff/committed",
  );

  return pluginDraft;
})();

const { configs } = plugin;

module.exports = Object.assign(plugin, {
  default: plugin,
  configs,
  processors,
});

export default plugin;
export { configs, processors };
export type { PluginConfigs };
