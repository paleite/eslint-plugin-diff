import { expectType } from "tsd";
import type { CiProvider, CiProviderName } from "./ci";
import { PROVIDERS } from "./ci";

expectType<Record<CiProviderName, CiProvider>>(PROVIDERS);
