import {
  ci,
  ciConfig,
  diff,
  diffConfig,
  staged,
  stagedConfig,
} from "./processors";

type FlatConfig = {
  plugins: { diff: unknown };
  processor: string;
};

type PluginConfigs = {
  ci: typeof ciConfig;
  diff: typeof diffConfig;
  staged: typeof stagedConfig;
  [key: string]: typeof ciConfig | FlatConfig[];
};

const processors = { ci, diff, staged };
const configs: PluginConfigs = {
  ci: ciConfig,
  diff: diffConfig,
  staged: stagedConfig,
};

const plugin = {
  configs,
  processors,
};

plugin.configs["flat/diff"] = [
  { plugins: { diff: plugin }, processor: "diff/diff" },
];
plugin.configs["flat/staged"] = [
  { plugins: { diff: plugin }, processor: "diff/staged" },
];
plugin.configs["flat/ci"] =
  process.env.CI === undefined
    ? []
    : [{ plugins: { diff: plugin }, processor: "diff/ci" }];

module.exports = plugin;

export { configs, processors };
