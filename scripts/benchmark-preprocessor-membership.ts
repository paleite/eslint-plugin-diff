#!/usr/bin/env node

import { performance } from "node:perf_hooks";

const DEFAULT_SCENARIOS = [
  { diff: 1000, files: 2000 },
  { diff: 10000, files: 20000 },
];

type Scenario = { diff: number; files: number };

const getArgValue = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
};

const parseScenarios = (): Scenario[] => {
  const scenariosArg = getArgValue("scenarios");
  if (!scenariosArg) {
    return DEFAULT_SCENARIOS;
  }

  return scenariosArg.split(",").map((pair) => {
    const [diffRaw, filesRaw] = pair.split(":");
    const diff = Number.parseInt(diffRaw ?? "", 10);
    const files = Number.parseInt(filesRaw ?? "", 10);

    if (
      !Number.isFinite(diff) ||
      !Number.isFinite(files) ||
      diff <= 0 ||
      files <= 0
    ) {
      throw new Error(
        `Invalid scenario '${pair}'. Expected format diff:files (e.g. 1000:2000).`,
      );
    }

    return { diff, files };
  });
};

const rounds = Number.parseInt(getArgValue("rounds") ?? "5", 10);
if (!Number.isFinite(rounds) || rounds <= 0) {
  throw new Error("Invalid --rounds value. Use a positive integer.");
}

const runOldMembership = (
  diffFileList: string[],
  untrackedFileList: string[],
  filenames: string[],
): number => {
  let processed = 0;
  for (const filename of filenames) {
    const shouldRefresh =
      !diffFileList.includes(filename) && !untrackedFileList.includes(filename);
    const shouldBeProcessed =
      diffFileList.includes(filename) || untrackedFileList.includes(filename);

    if (shouldRefresh) {
      // No-op: benchmarking membership overhead only.
    }
    if (shouldBeProcessed) {
      processed += 1;
    }
  }

  return processed;
};

const runSetMembership = (
  diffFileList: string[],
  untrackedFileList: string[],
  filenames: string[],
): number => {
  const diffFileSet = new Set(diffFileList);
  const untrackedFileSet = new Set(untrackedFileList);
  let processed = 0;

  for (const filename of filenames) {
    const shouldRefresh =
      !diffFileSet.has(filename) && !untrackedFileSet.has(filename);
    const shouldBeProcessed =
      diffFileSet.has(filename) || untrackedFileSet.has(filename);

    if (shouldRefresh) {
      // No-op: benchmarking membership overhead only.
    }
    if (shouldBeProcessed) {
      processed += 1;
    }
  }

  return processed;
};

const runBenchmark = (
  label: string,
  fn: (a: string[], b: string[], c: string[]) => number,
  diffFileList: string[],
  untrackedFileList: string[],
  filenames: string[],
): number => {
  // Warm-up.
  fn(diffFileList, untrackedFileList, filenames);

  const times = [];
  let checksum = 0;
  for (let i = 0; i < rounds; i += 1) {
    const t0 = performance.now();
    checksum += fn(diffFileList, untrackedFileList, filenames);
    const t1 = performance.now();
    times.push(t1 - t0);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(
    `${label}: avg=${avg.toFixed(2)}ms min=${min.toFixed(2)}ms max=${max.toFixed(2)}ms checksum=${checksum}`,
  );

  return avg;
};

const buildDataset = ({ diff, files }: Scenario) => {
  const diffFileList = Array.from(
    { length: diff },
    (_, index) => `/repo/file-${index}.ts`,
  );
  const untrackedFileList = Array.from(
    { length: Math.max(1, Math.floor(diff / 10)) },
    (_, index) => `/repo/untracked-${index}.ts`,
  );
  const filenames = Array.from(
    { length: files },
    (_, index) => `/repo/scan-${index}.ts`,
  );

  const hotWindow = Math.min(1000, files);
  for (let index = 0; index < hotWindow; index += 2) {
    filenames[index] = diffFileList[index % diffFileList.length]!;
  }
  for (let index = 1; index < hotWindow; index += 2) {
    filenames[index] = untrackedFileList[index % untrackedFileList.length]!;
  }

  return { diffFileList, untrackedFileList, filenames };
};

const scenarios = parseScenarios();
console.log(`Running ${scenarios.length} scenario(s), rounds=${rounds}`);

for (const scenario of scenarios) {
  const { diffFileList, untrackedFileList, filenames } = buildDataset(scenario);

  console.log(`\nScenario diff=${scenario.diff} files=${scenario.files}`);
  const oldAvg = runBenchmark(
    "old (Array.includes)",
    runOldMembership,
    diffFileList,
    untrackedFileList,
    filenames,
  );
  const newAvg = runBenchmark(
    "new (Set.has)",
    runSetMembership,
    diffFileList,
    untrackedFileList,
    filenames,
  );
  console.log(`speedup: ${(oldAvg / newAvg).toFixed(2)}x`);
}
