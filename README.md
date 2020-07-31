# eslint-plugin-diff

Run ESLint on your changes only

## What problem does it solve?

Introducing new ESLint rules (or updating 3rd party configs) in a large codebase can be tedious. This plugin allows your team to ease into new rules by only linting all new/modified code, eventually migrating to the new/updated rules.

## Installation

```sh
$ yarn add -D eslint-plugin-diff
```

## Usage

It's recommended to use [`"plugin:diff/staged"` (see config)](#config-staged-diff-staged-changes-only).

### Config `staged` — Diff staged changes only

> **Useful for pre-commit hooks, e.g. when running ESLint with lint-staged**

Extend your config in **`.eslintrc`**:

```json
{
  "extends": ["plugin:diff/staged"]
}
```

_Equivalent to `git diff HEAD --staged`_

### Config `diff` — Diff all changes since HEAD (staged and unstaged)

Extend your config in **`.eslintrc`**:

```json
{
  "extends": ["plugin:diff/diff"]
}
```

_Equivalent to `git diff HEAD`_
