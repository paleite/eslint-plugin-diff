import { diff, diffConfig, staged, stagedConfig } from "./processors";

module.exports = {
  configs: { diff: diffConfig, staged: stagedConfig },
  processors: { diff, staged },
};
