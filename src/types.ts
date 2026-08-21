import type { Linter } from "eslint";

export type ProcessorMode = "diff" | "ci" | "staged";

export type ProcessorOptions = {
  mode: ProcessorMode;
  rulesReportedOutsideChangedLines?: readonly string[];
};

export type DiffProcessor = Linter.Processor &
  Required<
    Pick<Linter.Processor, "preprocess" | "postprocess" | "supportsAutofix">
  >;
