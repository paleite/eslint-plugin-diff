import { expectType } from "tsd";
import type { Linter } from "eslint";

import type { PluginConfigs, processors } from "..";
import plugin, { configs } from "..";

expectType<PluginConfigs>(configs);
expectType<PluginConfigs>(plugin.configs);
expectType<typeof processors>(plugin.processors);

const flatDiffConfigEntries: Linter.Config[] = configs["flat/diff"];
const flatStagedConfigEntries: Linter.Config[] = configs["flat/staged"];
const flatCiConfigEntries: Linter.Config[] = configs["flat/ci"];

expectType<Linter.Config[]>(flatDiffConfigEntries);
expectType<Linter.Config[]>(flatStagedConfigEntries);
expectType<Linter.Config[]>(flatCiConfigEntries);
