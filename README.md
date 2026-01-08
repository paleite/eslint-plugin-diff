# eslint-plugin-diff-flat-config

[![npm version](https://img.shields.io/npm/v/eslint-plugin-diff-flat-config.svg)](https://www.npmjs.com/package/eslint-plugin-diff-flat-config)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Run ESLint on your changed lines only. **ESLint 9+ flat config support**.

This is a fork of [`eslint-plugin-diff`](https://github.com/paleite/eslint-plugin-diff) by Patrick Eriksson, modernized to support ESLint's flat configuration format.

## Table of Contents

- [Why Use This Plugin?](#why-use-this-plugin)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
  - [diff.configs.diff](#diffconfigsdiff-recommended-for-ci)
  - [diff.configs.staged](#diffconfigsstaged-recommended-for-pre-commit-hooks)
  - [diff.configs.ci](#diffconfigsci)
- [Usage with typescript-eslint](#usage-with-typescript-eslint)
- [CI Setup](#ci-setup)
  - [GitHub Actions](#github-actions)
  - [GitLab CI](#gitlab-ci)
  - [BitBucket Pipelines](#bitbucket-pipelines)
  - [Jenkins](#jenkins)
- [Pre-commit Hook Setup](#pre-commit-hook-setup)
- [Environment Variables](#environment-variables)
- [How It Works](#how-it-works)
- [Edge Cases](#edge-cases)
- [Migrating from eslint-plugin-diff](#migrating-from-eslint-plugin-diff)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Why Use This Plugin?

### The Problem

When adopting new ESLint rules in a large codebase, you face a dilemma:

- **Lint entire files**: Developers get overwhelmed with hundreds of pre-existing errors they didn't introduce
- **Skip linting**: New violations slip through code review

### The Solution

This plugin filters ESLint output to show **only errors on lines you've actually changed**. This means:

- **Gradual adoption**: Introduce new rules without blocking on existing violations
- **Focused feedback**: Developers see only issues they created
- **Reduced noise**: No more drowning in a sea of legacy linter errors

### Benefits

| Benefit | Description |
|---------|-------------|
| **Protect your budget** | Avoid costly refactoring when updating linter rules or dependencies |
| **Boost velocity** | Keep your team productive without overwhelming error lists |
| **Maintain focus** | All linter output is directly relevant to the current changes |
| **Easy rule adoption** | Roll out new ESLint rules incrementally across your codebase |

## Requirements

| Requirement | Version |
|-------------|---------|
| **ESLint** | >= 9.0.0 |
| **Node.js** | >= 18.0.0 |
| **Git** | Any modern version |

## Installation

```sh
# npm
npm install --save-dev eslint eslint-plugin-diff-flat-config

# yarn
yarn add -D eslint eslint-plugin-diff-flat-config

# pnpm
pnpm add -D eslint eslint-plugin-diff-flat-config
```

## Usage

This plugin provides three configurations for different use cases. Add them to your ESLint flat config:

### `diff.configs.diff` (recommended for CI)

Lint only the lines that have changed compared to a base commit/branch. This is ideal for CI pipelines where you want to lint changes in a pull request.

```javascript
// eslint.config.mjs
import diff from "eslint-plugin-diff-flat-config";

export default [
  // ... your other configs (e.g., @eslint/js, typescript-eslint)
  diff.configs.diff,
];
```

**When to use**: CI pipelines, pull request checks

### `diff.configs.staged` (recommended for pre-commit hooks)

Lint only the lines that are staged for commit (`git add`). Perfect for use with pre-commit hooks and lint-staged.

```javascript
// eslint.config.staged.mjs
import diff from "eslint-plugin-diff-flat-config";

export default [
  // ... your other configs
  diff.configs.staged,
];
```

**When to use**: Pre-commit hooks, local development

### `diff.configs.ci`

A smart CI-aware configuration that:
- **In CI environments** (when `CI` env var is set): Works like `diff.configs.diff`
- **Locally** (when `CI` is not set): Does nothing (allows normal linting)

This is useful when you want a single config file that behaves differently in CI vs local development.

```javascript
// eslint.config.mjs
import diff from "eslint-plugin-diff-flat-config";

export default [
  // ... your other configs
  diff.configs.ci, // Active only in CI environments
];
```

**When to use**: Shared config files that work both locally and in CI

## Usage with typescript-eslint

The plugin works seamlessly with `typescript-eslint`:

```javascript
// eslint.config.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import diff from "eslint-plugin-diff-flat-config";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // your TypeScript rules
    },
  },
  diff.configs.diff // Add this last to filter all previous rules
);
```

## CI Setup

To lint all changes in a pull request, set the `ESLINT_PLUGIN_DIFF_COMMIT` environment variable to the base branch before running ESLint.

### GitHub Actions

```yaml
name: Lint
on:
  pull_request:

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for git diff to work

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint on changed lines
        env:
          ESLINT_PLUGIN_DIFF_COMMIT: origin/${{ github.base_ref }}
        run: npx eslint .
```

### GitLab CI

```yaml
lint:
  stage: test
  script:
    - npm ci
    - export ESLINT_PLUGIN_DIFF_COMMIT="origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
    - npx eslint .
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

### BitBucket Pipelines

```yaml
pipelines:
  pull-requests:
    "**":
      - step:
          name: Lint
          script:
            - npm ci
            - export ESLINT_PLUGIN_DIFF_COMMIT="origin/$BITBUCKET_PR_DESTINATION_BRANCH"
            - npx eslint .
```

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Lint') {
            steps {
                sh 'npm ci'
                withEnv(["ESLINT_PLUGIN_DIFF_COMMIT=origin/${env.CHANGE_TARGET}"]) {
                    sh 'npx eslint .'
                }
            }
        }
    }
}
```

## Pre-commit Hook Setup

Use with [lint-staged](https://github.com/okonet/lint-staged) to lint only staged lines before each commit.

### 1. Install lint-staged and husky

```sh
npm install --save-dev lint-staged husky
npx husky init
```

### 2. Configure lint-staged in package.json

```json
{
  "lint-staged": {
    "*.{js,ts,tsx,jsx}": "eslint --config eslint.config.staged.mjs --fix"
  }
}
```

### 3. Create a staged-specific ESLint config

```javascript
// eslint.config.staged.mjs
import baseConfig from "./eslint.config.mjs";
import diff from "eslint-plugin-diff-flat-config";

export default [
  ...baseConfig,
  diff.configs.staged,
];
```

### 4. Add the pre-commit hook

```sh
echo "npx lint-staged" > .husky/pre-commit
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ESLINT_PLUGIN_DIFF_COMMIT` | Base commit/branch for diff comparison. Accepts any valid git ref (branch name, commit SHA, tag, etc.) | `HEAD` |
| `CI` | When set to any value, enables the `ci` processor. Most CI providers set this automatically. | - |
| `VSCODE_PID` | When set (by VS Code), files are always processed regardless of diff status to ensure real-time linting works. | - |

## How It Works

1. **Preprocessor**: Determines which files have changes. Unchanged files are skipped entirely for performance.

2. **Git Diff**: Runs `git diff` to identify which line numbers have been modified:
   - `diff` mode: `git diff HEAD` (all uncommitted changes)
   - `staged` mode: `git diff HEAD --staged` (only staged changes)

3. **Postprocessor**: After ESLint runs, filters the lint messages to keep only those on changed lines.

4. **Output**: Only violations on lines you've actually modified are reported.

## Edge Cases

The plugin handles these edge cases:

| Scenario | Behavior |
|----------|----------|
| **New/untracked files** | Fully linted (all lines) |
| **Renamed files** | Changes are tracked correctly |
| **Binary files** | Skipped |
| **Deleted files** | Not linted |
| **Partially staged files** | In `staged` mode, reports an error if a file has both staged and unstaged changes |
| **Files outside git repo** | Fully linted |

## Migrating from eslint-plugin-diff

This package is a fork of the original [`eslint-plugin-diff`](https://github.com/paleite/eslint-plugin-diff) v2.x, modernized for ESLint's flat config format.

### Breaking Changes

| Change | eslint-plugin-diff v2.x | eslint-plugin-diff-flat-config |
|--------|-------------------------|--------------------------------|
| **ESLint version** | >= 6.7.0 | >= 9.0.0 |
| **Node.js version** | >= 14.0.0 | >= 18.0.0 |
| **Config format** | `.eslintrc` (legacy) | `eslint.config.mjs` (flat) |
| **Package name** | `eslint-plugin-diff` | `eslint-plugin-diff-flat-config` |

### Migration Steps

**Before (ESLint 8 with .eslintrc.json)**:

```json
{
  "extends": ["plugin:diff/diff"]
}
```

**After (ESLint with eslint.config.mjs)**:

```javascript
import diff from "eslint-plugin-diff-flat-config";

export default [
  // ... your other configs
  diff.configs.diff,
];
```

## Troubleshooting

### "File has unstaged changes" error

When using `staged` mode, if a file has both staged and unstaged changes, the plugin cannot reliably determine which lines to lint. Either:
- Stage all changes: `git add <file>`
- Stash unstaged changes: `git stash -k`

### No output / all files skipped

Ensure you have changes to lint:
- For `diff` mode: Make changes to tracked files
- For `staged` mode: Stage changes with `git add`

### CI not detecting changes

Make sure:
1. `fetch-depth: 0` is set (GitHub Actions) to fetch full git history
2. `ESLINT_PLUGIN_DIFF_COMMIT` points to a valid ref that exists
3. The base branch has been fetched: `git fetch origin main`

### VS Code real-time linting not working

The plugin automatically detects VS Code and processes all files to ensure real-time linting works. If issues persist, check that the ESLint extension is using the correct config file.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE.md](LICENSE.md)

---

**Original Author**: [Patrick Eriksson](https://github.com/paleite) (eslint-plugin-diff)

**Fork Maintainer**: [kirlev](https://github.com/kirlev)
