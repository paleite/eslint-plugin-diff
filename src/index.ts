import { ciConfig, diff, diffConfig, staged, stagedConfig } from "./processors";

const configs = {
  ci: ciConfig,
  diff: diffConfig,
  staged: stagedConfig,
};
const processors = { diff, staged };

module.exports = { configs, processors };

export { configs, processors };
