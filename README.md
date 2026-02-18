# eslint-plugin-diff

![](https://img.shields.io/npm/dt/eslint-plugin-diff?style=flat-square&logo=npm&logoColor=white)
[![codecov](https://codecov.io/gh/paleite/eslint-plugin-diff/branch/main/graph/badge.svg?token=W0LPKHZCF5)](https://codecov.io/gh/paleite/eslint-plugin-diff)

Lint what changed, not the entire codebase. `eslint-plugin-diff` keeps feedback focused by filtering ESLint output to changed lines.

## Why this matters

- Focused feedback: keep lint output tied to changed code.
- Safer lint upgrades: avoid being blocked by legacy violations in untouched files.
- Better developer flow: reduce noise while enforcing existing lint rules.

## Quick start

### Install

```sh
npm install --save-dev eslint eslint-plugin-diff
```

### Flat config (ESLint 9+)

```js
import diff from "eslint-plugin-diff";

export default [
  // ...your existing config
  ...diff.configs["flat/diff"],
];
```

### Legacy config (`.eslintrc.*`)

```json
{
  "extends": ["plugin:diff/diff"]
}
```

## What it does and how it works

This plugin does not provide lint rules. It provides ESLint processors and preset configs.

Behavior:

1. It computes changed files from `git diff --name-only`.
2. It skips unchanged files in processor `preprocess` (performance optimization).
3. It filters lint messages in `postprocess` to changed line ranges from diff hunks.
4. Untracked files are treated as changed, so their messages are not filtered out.

## Modes

| Mode     | Legacy config        | Flat config              | Typical use                              |
| -------- | -------------------- | ------------------------ | ---------------------------------------- |
| `diff`   | `plugin:diff/diff`   | `configs["flat/diff"]`   | Local dev against working tree changes   |
| `ci`     | `plugin:diff/ci`     | `configs["flat/ci"]`     | PR CI diff-only in CI, full lint locally |
| `staged` | `plugin:diff/staged` | `configs["flat/staged"]` | Pre-commit staged-only workflows         |

Important `staged` caveat: if a file has unstaged changes, the plugin emits a fatal message:
`<file> has unstaged changes. Please stage or remove the changes.`

## Environment variables and CI autodetection

### `ESLINT_PLUGIN_DIFF_COMMIT`

Sets diff base commit-ish. Default: `HEAD`.

```sh
ESLINT_PLUGIN_DIFF_COMMIT="origin/main" npx eslint --max-warnings=0 .
```

### `CI`

`ci` mode behavior:

- `CI` set: active diff filtering.
- `CI` not set: no-op processor (lint everything).

If `CI` is set and `ESLINT_PLUGIN_DIFF_COMMIT` is not set, the plugin attempts provider-based target branch detection and fetches from `origin` before diffing.

### `VSCODE_PID`

When set, the plugin can refresh the initial diff snapshot once to avoid delayed diagnostics in editor workflows.

## Recipes

### Local diff vs default base (`HEAD`)

```sh
npx eslint --max-warnings=0 .
```

### Local diff vs main

```sh
ESLINT_PLUGIN_DIFF_COMMIT="origin/main" npx eslint --max-warnings=0 .
```

### Pre-commit staged-only

Use `plugin:diff/staged` or `configs["flat/staged"]`.

### PR CI with autodetect (`ci` mode)

Use `plugin:diff/ci` or `configs["flat/ci"]` and run ESLint normally in CI.

### PR CI with explicit base

```sh
git fetch --quiet origin main
ESLINT_PLUGIN_DIFF_COMMIT="main" npx eslint --max-warnings=0 .
```

## Compatibility and trade-offs

- ESLint allows one processor per file. If another integration requires a processor for the same files, scope one of them by file patterns.
- Diff-only linting is a signal-over-completeness strategy. It can miss issues outside changed lines. Many teams run full lint in scheduled jobs or on protected branches.

## Troubleshooting

### “Too many CI providers found (...)”

Set `ESLINT_PLUGIN_DIFF_COMMIT` explicitly.

### “`<file> has unstaged changes. Please stage or remove the changes.`”

This comes from `staged` mode with partially staged files.

### Editor diagnostics appear late

`VSCODE_PID` enables a one-time diff refresh path intended to reduce this.

## FAQ

### Does this replace ESLint rules?

No. Your normal rules stay the same. This plugin changes which files/lines can surface diagnostics.

### Does `ci` mode always filter diffs?

No. Outside CI it is intentionally a no-op so local linting stays complete.

## License

MIT. See `LICENSE.md`.
