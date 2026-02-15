import {
  ci,
  ciConfig,
  diff,
  diffConfig,
  staged,
  stagedConfig,
} from "./processors";

const processors = { ci, diff, staged };
const plugin = {
  configs: {
    ci: ciConfig,
    diff: diffConfig,
    staged: stagedConfig,
  },
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

const { configs } = plugin;

module.exports = plugin;

export { configs, processors };
