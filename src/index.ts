import { diff, diffConfig, staged, stagedConfig } from "./processors";

const configs = { diff: diffConfig, staged: stagedConfig };
const processors = { diff, staged };

export { configs, processors };
module.exports = { configs, processors };
