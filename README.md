# eslint-plugin-diff

![](https://img.shields.io/npm/dt/eslint-plugin-diff?style=flat-square&logo=npm&logoColor=white) [![codecov](https://codecov.io/gh/paleite/eslint-plugin-diff/branch/main/graph/badge.svg?token=W0LPKHZCF5)](https://codecov.io/gh/paleite/eslint-plugin-diff)

You've got changes, we've got checks. Run ESLint on your modified lines only.

## What's the big deal?

Imagine a world where your developers receive feedback that's laser-focused on the changes they've made. Traditional setups can't offer this. But with our plugin, you can run ESLint on your changed lines only. This means all warnings and errors are **directly relevant to you**, saving you from drowning in a sea of linter errors.

### 💰 Protect your budget

Updating your linter or its dependencies can trigger a flood of new linter warnings and errors. Fixing them all can skyrocket your project costs. But with our plugin, you can run ESLint on only the changed lines of your code. This means new errors won't pop up in code that other developers have already reviewed and approved.

### 🚀 Boost your team's velocity

A healthy, high-quality code-base is the fuel for high velocity. But too many errors in your linter's output can slow you down. Our plugin ensures your linter runs on only the changed lines of your code. This keeps your developers from feeling overwhelmed, your code-base healthy, and your team productive.

### 🧠 Keep your developers focused

Developers are constantly bombarded with errors and notifications. If a linter has too much output, it can be hard to tell if their changes caused an issue or if it's just old code. With our plugin, all the linter output your developers see will be related to their changes, making it easier to focus on the task at hand.

### How does it work?

When creating pull-requests, this plugin enables you to run ESLint on only the changed lines. This sharpens the focus of your code review and reduces the time spent on it, while still maintaining a high-quality code base.

As a bonus, introducing new ESLint rules (or updating 3rd party configs) in a large codebase becomes a breeze, because you avoid getting blocked by new ESLint issues in already-approved code.

## Installation

Get the plugin and extend your ESLint config.

### Install

```sh
npm install --save-dev eslint eslint-plugin-diff
pnpm add -D eslint eslint-plugin-diff
```

### Extend config

Extend your ESLint config with one of our configs.

#### `"plugin:diff/diff"` (recommended)

Only lint changes

```json
{
  "extends": ["plugin:diff/diff"]
}
```

#### `"plugin:diff/ci"`

In a CI-environment, only lint changes. Locally, skip the plugin (i.e. lint everything).

> NOTE: This requires the environment variable `CI` to be defined, which most CI-providers set automatically.

```json
{
  "extends": ["plugin:diff/ci"]
}
```

#### `"plugin:diff/staged"`

Only lint the changes you've staged for an upcoming commit.

```json
{
  "extends": ["plugin:diff/staged"]
}
```

## CI Setup

To lint all the changes of a pull-request, you only have to set
`ESLINT_PLUGIN_DIFF_COMMIT` before running ESLint.

### For GitHub Actions

```yml
name: Run ESLint on your changes only
on:
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install modules
        run: npm install
      - name: Fetch the base branch, so we can use `git diff`
        run: git fetch origin ${{ github.event.pull_request.base.ref }}:${{ github.event.pull_request.base.ref }}
      - name: Run ESLint on your changes only
        env:
          ESLINT_PLUGIN_DIFF_COMMIT: ${{ github.event.pull_request.base.ref }}
        run: npx --no-install eslint --ext .js,.jsx,.ts,.tsx .
```

### For BitBucket Pipelines

```sh
export ESLINT_PLUGIN_DIFF_COMMIT="origin/$BITBUCKET_PR_DESTINATION_BRANCH";
npx --no-install eslint --ext .js,.ts,.tsx .
```

## Note

- You can use any valid commit syntax for `ESLINT_PLUGIN_DIFF_COMMIT`. See [git's official documentation on the syntax](https://git-scm.com/docs/git-diff#Documentation/git-diff.txt-emgitdiffemltoptionsgtltcommitgt--ltpathgt82308203)
- You can choose to lint all changes (using `"plugin:diff/diff"`) or staged changes only (using `"plugin:diff/staged"`).
- We recommend using `"plugin:diff/diff"`, which is equivalent to running `git diff HEAD`.
- `"plugin:diff/staged"` is equivalent to running `git diff HEAD --staged`
