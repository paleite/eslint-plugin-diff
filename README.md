# eslint-plugin-diff

[![npm](https://img.shields.io/npm/dt/eslint-plugin-diff?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/eslint-plugin-diff)
[![codecov](https://codecov.io/gh/paleite/eslint-plugin-diff/branch/main/graph/badge.svg?token=W0LPKHZCF5)](https://codecov.io/gh/paleite/eslint-plugin-diff)

Lint what changed, not the entire codebase. `eslint-plugin-diff` filters ESLint diagnostics to Git changes while preserving an explicit escape hatch for rules whose diagnostics legitimately belong elsewhere in a changed file.

## Requirements

- ESLint 10+
- Node.js `^20.19.0 || ^22.13.0 || >=24`
- Flat config
- Git

## Install

```sh
npm install --save-dev eslint eslint-plugin-diff
```

## Quick start

```js
import diff from "eslint-plugin-diff";

export default [
  // your normal ESLint config
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"],
    processor: diff.createProcessor({ mode: "diff" }),
  },
];
```

`mode` is required. v3 intentionally has no preset configs and no static processor instances.

## Processor options

```ts
{
  mode: "diff" | "ci" | "staged";
  rulesReportedOutsideChangedLines?: readonly string[];
}
```

### `rulesReportedOutsideChangedLines`

Most rules are reported only when their ESLint diagnostic range intersects Git's changed lines. Some rules describe a file-level or non-local consequence instead. For those rules, opt in explicitly:

```js
processor: diff.createProcessor({
  mode: "diff",
  rulesReportedOutsideChangedLines: [
    "@typescript-eslint/no-unused-vars",
    "simple-import-sort/imports",
  ],
});
```

The option does **not** make unchanged files lintable. It only broadens diagnostic scope inside a file Git already considers changed.

For example, deleting the last use of a variable can make `no-unused-vars` report on an unchanged declaration. Likewise, moving a file can change path-sensitive lint results even when its contents are identical.

## Changed files and changed lines

v3 treats these as separate concepts.

A **changed file** is a current-side file reported by the active Git diff, plus an eligible untracked file.

**Changed lines** are the current-side line ranges from Git patch hunks.

An exact rename illustrates the distinction:

```text
src/old.ts -> src/new.ts
contents identical

changed file: yes
changed lines: none
```

Ordinary rule diagnostics are therefore hidden for the exact rename, while a rule listed in `rulesReportedOutsideChangedLines` can still report anywhere in `src/new.ts`.

Git's normal `--find-renames` behavior is authoritative. If Git decides a sufficiently large rewrite is delete + add rather than a rename, the destination is treated as a new whole-file change.

## Diagnostic ranges

When ESLint supplies `endLine`, v3 uses the full reported diagnostic span.

```text
ESLint diagnostic: lines 6-12
Git changed line: line 8
result: reported
```

If `endLine` is absent, only `line` is used.

This does not turn non-local diagnostics into changed-line diagnostics. A `no-unused-vars` error on an unchanged declaration, for example, still needs `rulesReportedOutsideChangedLines` when the only Git change is elsewhere.

## Modes

### `diff`

Compares the working tree against an exact base.

- Default base: `HEAD`
- Includes staged and unstaged tracked changes
- Includes untracked, non-ignored files as whole-file changes
- Never performs network access

```js
processor: diff.createProcessor({ mode: "diff" });
```

### `staged`

Compares the index against an exact base.

- Default base: `HEAD`
- Tracked staged modifications use staged hunks
- Newly staged files are whole-file changes
- Unstaged-only files are ignored
- Untracked files not in the index are ignored
- Partially staged files produce a fatal diagnostic because ESLint reads the working-tree file while the staged diff describes the index
- Never performs network access

```js
processor: diff.createProcessor({ mode: "staged" });
```

### `ci`

Designed for pull-request CI.

- Outside CI: full lint, with no Git diff filtering
- In non-PR CI with no explicit base: full lint
- In PR CI: provider context resolves a reliable exact diff base
- May fetch missing history in CI only
- Supports shallow clones by progressively deepening only as far as required
- Fails rather than silently switching to an inaccurate comparison

```js
processor: diff.createProcessor({ mode: "ci" });
```

## Environment variables

### `ESLINT_PLUGIN_DIFF_COMMIT`

Sets an **exact comparison point**.

```sh
ESLINT_PLUGIN_DIFF_COMMIT="origin/main" npx eslint .
```

The plugin does not calculate merge-base from this value.

This differs from CI autodetection:

```text
ESLINT_PLUGIN_DIFF_COMMIT
  -> resolve exactly that commit-ish
  -> diff against that exact commit

CI provider autodetection
  -> discover PR base side
  -> use provider exact diff base when available
  -> otherwise calculate merge-base
```

In `diff` and `staged`, an unavailable value is an error and the plugin never fetches it. In active `ci`, the plugin may attempt a targeted fetch for the exact value.

### `CI`

`mode: "ci"` activates PR diff behavior only when `CI` is set. Without it, the processor is intentionally a no-op filter and ESLint reports normally.

### `VSCODE_PID`

When present, the processor refreshes Git changed-file classification before each editor preprocess invocation. This lets long-lived editor sessions observe transitions such as untracked -> tracked, unchanged -> modified, and modified -> reverted.

### `ESLINT_PLUGIN_DIFF_INCLUDE_FIXES`

When set to `true`, fixable diagnostics in a changed file are retained even when they fall outside changed lines.

```sh
ESLINT_PLUGIN_DIFF_INCLUDE_FIXES=true npx eslint --fix .
```

## Compose with another processor

ESLint allows one processor per file. Compose `eslint-plugin-diff` with integrations such as Vue instead of replacing their processor.

```js
import diff from "eslint-plugin-diff";
import vue from "eslint-plugin-vue";

const vueProcessor = vue.processors.vue ?? vue.processors[".vue"];

export default [
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    processor: diff.composeProcessor(vueProcessor, {
      mode: "ci",
      rulesReportedOutsideChangedLines: ["@typescript-eslint/no-unused-vars"],
    }),
  },
];
```

Composition order is:

```text
diff preprocess gate
  -> base processor preprocess
  -> ESLint
  -> base processor postprocess
  -> diff diagnostic filtering
```

`supportsAutofix` is enabled only when both processors explicitly support autofix. ESLint's default for an omitted `supportsAutofix` is `false`.

## CI providers

v3 officially documents GitHub Actions, GitLab CI, Azure Pipelines, and Bitbucket Pipelines. Existing AppVeyor, Bamboo, Buddy, Drone, and Travis target-branch signals remain best-effort fallbacks.

### GitHub Actions

`GITHUB_BASE_REF` supplies the PR base side. The checked-out PR ref/head is used to establish merge-base.

```yaml
name: lint
on: pull_request

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm eslint .
```

The default shallow checkout is supported. The plugin deepens history when required. `fetch-depth: 0` is a troubleshooting fallback, not a prerequisite.

### GitLab CI

The plugin prefers `CI_MERGE_REQUEST_DIFF_BASE_SHA` when available because it is already the exact merge-request diff base. Otherwise it resolves the target side and merge-base.

```yaml
lint:
  script:
    - corepack enable
    - pnpm install --frozen-lockfile
    - pnpm eslint .
```

GitLab's shallow checkout is supported. `GIT_DEPTH: "0"` is a fallback for environments that block the plugin's targeted fetches.

### Azure Pipelines

The plugin uses `SYSTEM_PULLREQUEST_TARGETBRANCH`, `SYSTEM_PULLREQUEST_SOURCEBRANCH`, and the source commit variables.

If the plugin may need to deepen history, keep checkout credentials available:

```yaml
steps:
  - checkout: self
    persistCredentials: true
  - script: corepack enable
  - script: pnpm install --frozen-lockfile
  - script: pnpm eslint .
```

If later authenticated fetches are prohibited by policy, configure checkout with sufficient history instead.

### Bitbucket Pipelines

The plugin uses `BITBUCKET_PR_DESTINATION_BRANCH` and `BITBUCKET_PR_DESTINATION_COMMIT` as the target side, then calculates merge-base with the PR head.

```yaml
pipelines:
  pull-requests:
    "**":
      - step:
          script:
            - corepack enable
            - pnpm install --frozen-lockfile
            - pnpm eslint .
```

Bitbucket's default shallow clone is supported. Use `clone: { depth: full }` only as a fallback when targeted deepening is unavailable.

## CI history and network behavior

Automatic network access is intentionally limited:

```text
diff   -> never fetch
staged -> never fetch
ci     -> may fetch when active PR comparison requires it
```

CI fetches use plugin-owned temporary refs under `refs/eslint-plugin-diff/`. Normal local branches and `refs/remotes/*` are not rewritten. Temporary refs are removed after base resolution.

The plugin progressively deepens shallow history instead of immediately unshallowing the repository. It stops once the exact base or merge-base can be resolved. If Git cannot establish a reliable base, lint fails with an error.

## v2 -> v3 migration

v3 is intentionally breaking.

Replace preset configs:

```diff
-import diff from "eslint-plugin-diff";
-
-export default [
-  ...diff.configs["flat/diff"],
-];
+import diff from "eslint-plugin-diff";
+
+export default [
+  {
+    files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"],
+    processor: diff.createProcessor({ mode: "diff" }),
+  },
+];
```

Replace legacy composition:

```diff
-diff.composeProcessor(vueProcessor, "diff")
+diff.composeProcessor(vueProcessor, { mode: "diff" })
```

Removed public APIs:

- `configs`
- `processors`
- static `diff`, `ci`, and `staged` processors
- legacy `.eslintrc` configs
- string-mode `composeProcessor()` overload

## Failure behavior

The plugin fails early when Git state cannot produce a reliable comparison, including unresolved merge states, an unavailable explicit comparison point, an impossible PR merge-base, or a required CI fetch that fails.

It does not silently substitute another diff definition.

## License

MIT. See `LICENSE.md`.
