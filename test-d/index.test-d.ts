import { expectType } from "tsd";
import plugin, { configs } from "..";
import type { PluginConfigs, processors } from "..";

expectType<PluginConfigs>(configs);
expectType<PluginConfigs>(plugin.configs);
expectType<typeof processors>(plugin.processors);
