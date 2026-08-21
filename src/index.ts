import {
  composeProcessor as composeProcessorImplementation,
  createProcessor as createProcessorImplementation,
} from "./processors";

const createProcessor = createProcessorImplementation;
const composeProcessor = composeProcessorImplementation;

const plugin = {
  createProcessor,
  composeProcessor,
};

module.exports = Object.assign(plugin, { createProcessor, composeProcessor });

export default plugin;
export { composeProcessor, createProcessor };
export type { DiffProcessor, ProcessorMode, ProcessorOptions } from "./types";
