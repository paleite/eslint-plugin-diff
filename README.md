# eslint-plugin-diff

Run ESLint on your changes only

## What problem does it solve?

Introducing new ESLint rules (or updating 3rd party configs) in a large codebase can be tedious. This plugin allows your team to ease into new rules by only linting all new/modified code, eventually migrating to the new/updated rules.

It can be used in CI environments as well.

## Installation

```sh
$ yarn add -D eslint-plugin-diff
```

## Usage

If you want to define which commit or commit-range to diff between (useful in CI), you can set the environment variable `ESLINT_PLUGIN_DIFF_COMMIT` (otherwise the plugin will default to `HEAD`):

```sh
$ ESLINT_PLUGIN_DIFF_COMMIT="a8fdc20..5a9f19c" yarn run eslint .
# or
$ ESLINT_PLUGIN_DIFF_COMMIT="${GITHUB_SHA}.." yarn run eslint .
```

See [git's official documentation on the syntax](https://git-scm.com/docs/git-diff#Documentation/git-diff.txt-emgitdiffemltoptionsgtltcommitgt--ltpathgt82308203)

It's recommended to use [`"plugin:diff/diff"` (see config)](#config-diff--diff-all-changes-since-head-staged-and-unstaged).

### Config `diff` — Diff all changes since HEAD (staged and unstaged)

Extend your config in **`.eslintrc`**:

```json
{
  "extends": ["plugin:diff/diff"]
}
```

_Equivalent to `git diff HEAD`_

### Config `staged` — Diff staged changes only

> **Useful for pre-commit hooks, e.g. when running ESLint with lint-staged**

Extend your config in **`.eslintrc`**:

```json
{
  "extends": ["plugin:diff/staged"]
}
```

_Equivalent to `git diff HEAD --staged`_
