# eslint-plugin-diff ![](https://img.shields.io/npm/dt/eslint-plugin-diff?style=flat-square&logo=npm&logoColor=white)

Run ESLint on your changed lines only.

## What problem does it solve?

The feedback your developers get in a pull-request should be focused on the changes they've made, but traditional setups don't allow for this. With this plugin you can run ESLint on your changed lines only, making all warnings and errors **relevant to you**, and at the same time avoiding becoming overwhelmed with linter errors.

### 💰 Your company's budget is precious

When updating your linter or its dependencies, you often get new linter warnings and errors in your code, which can lead to a huge increase of the cost of your project if you try to fix all of them. This plugin allows you to run ESLint on only the changed lines of your code, so the new errors won't get triggered on the code other developers have already manually reviewed and approved.

### 🚀 Your team's velocity is important

Having a healthy and high-quality code-base is a pre-requisite for high velocity and having too many errors in your linter's output can get overwhelming, oftentimes disheartening the developers, at the cost of the quality of the code. Having a linter that runs on only the changed lines of your code will ensure your developers don't get overwhelmed, ensuring your code-base will remain healthy, and your team productive.

### 🧠 Your developers' focus is vital

Let's face it – Developers are bombarded with errors and notifications about systems being broken, code being wrong and people requiring their attention. If a linter has too much output, it becomes a chore for your developers just to assess whether or not their changes actually caused an issue, or if it's just old code they haven't even touched. With this plugin, all the linter output your developers see will be related to whatever they have personally changed, requiring much less focus on parsing the linter's output.

### How does it solve it?

When creating pull-requests, this plugin will enable you to run ESLint on only the changed lines of your pull-request, increasing the focus of your code review. This is a great way to reduce the amount of time spent on code review while still maintaining a high quality code base and increase the quality of your feedback.

As an added bonus, it also makes introducing new ESLint rules (or updating 3rd party configs) in a large codebase trivial, because you avoid becoming blocked by new ESLint issues in already-approved code.

## Installation

Install the plugin and extend your ESLint config.

### Install

```sh
yarn add -D eslint eslint-plugin-diff
```

### Extend config

Extend your ESLint config with `"plugin:diff/diff"`:

```json
{
  "extends": ["plugin:diff/diff"]
}
```

You can also choose `"plugin:diff/staged"` if you prefer to lint only staged
files.

## CI Setup

To lint all the changes of a PR, you only have to set
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
      - name: Fetch the base branch
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
