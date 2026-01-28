import {
  ci,
  ciConfig,
  diff,
  diffConfig,
  staged,
  stagedConfig,
  committed,
  committedConfig,
} from "./processors";

const configs = {
  ci: ciConfig,
  diff: diffConfig,
  staged: stagedConfig,
  committed: committedConfig,
};
const processors = { ci, diff, staged, committed };

module.exports = { configs, processors };

export { configs, processors };
