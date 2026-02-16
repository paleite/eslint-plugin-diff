import {
  ci,
  ciConfig,
  diff,
  diffConfig,
  staged,
  stagedConfig,
} from "./processors";

type FlatConfigEntry = {
  plugins: { diff: unknown };
  processor: string;
};

type PluginConfigs = {
  ci: typeof ciConfig;
  diff: typeof diffConfig;
  staged: typeof stagedConfig;
  "flat/ci": FlatConfigEntry[];
  "flat/diff": FlatConfigEntry[];
  "flat/staged": FlatConfigEntry[];
};

type ProcessorName = "diff/ci" | "diff/diff" | "diff/staged";

const processors = { ci, diff, staged } as const;
type Processors = typeof processors;

type DiffPlugin = {
  configs: PluginConfigs;
  processors: Processors;
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
    configs: {
      ci: ciConfig,
      diff: diffConfig,
      staged: stagedConfig,
      "flat/ci": [],
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
