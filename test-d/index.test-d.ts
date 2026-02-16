import { expectType } from "tsd";

import type { PluginConfigs, processors } from "..";
import plugin, { configs } from "..";

expectType<PluginConfigs>(configs);
expectType<PluginConfigs>(plugin.configs);
expectType<typeof processors>(plugin.processors);
