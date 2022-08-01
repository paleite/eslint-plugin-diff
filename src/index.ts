import {
  ci,
  ciConfig,
  diff,
  diffConfig,
  staged,
  stagedConfig,
} from "./processors";

const configs = {
  ci: ciConfig,
  diff: diffConfig,
  staged: stagedConfig,
};
const processors = { ci, diff, staged };

module.exports = { configs, processors };

export { configs, processors };
