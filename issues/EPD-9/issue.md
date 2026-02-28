---
identifier: EPD-9
title: Support composing with existing processors for .vue files
teamKey: EPD
stateName: Done
labelNames:
  - bug
id: cd991f0c-8d20-4bcf-84fc-b6952ec8ed4b
teamId: c2b86822-351a-41ab-b4db-652fc5a7a27c
stateId: 567bb0af-8316-40db-8a09-5ed9138f0d29
labelIds:
  - 842d9d04-4acf-4dc5-9243-59a9d9cf042e
priority: 2
priorityName: High
createdAt: 2026-02-28T16:33:26.455Z
updatedAt: 2026-02-28T16:39:17.058Z
---

## Problem

`eslint-plugin-diff` and `eslint-plugin-vue` both use ESLint processors. ESLint only allows one processor per file, so when `diff` is configured after Vue, `.vue` files end up with `diff/diff` as the active processor and Vue's processor is skipped.

That breaks Vue template comment directives (for example `<!-- eslint-disable-next-line vue/no-v-html -->`) and causes false positives from `vue/comment-directive` in changed files.

## Expected

Using `eslint-plugin-diff` together with `eslint-plugin-vue` should not break Vue's processor behavior for `.vue` files. Directive comments should be interpreted correctly while still limiting results to changed lines.

## Repro

- GitHub issue: https://github.com/paleite/eslint-plugin-diff/issues/46
- Minimal reproduction: https://github.com/gtbuchanan/eslint-plugin-diff-vue-repro
- Repro branch: `feat/v-html`
- Workaround branch/commit:
  - Branch: `workaround`
  - Commit: `5e97c9a4ba1ae0255224deb94c2c7eb9e88892ee`
- Verified locally:
  - `feat/v-html`: `ESLINT_PLUGIN_DIFF_COMMIT=main npx eslint .` returns `vue/comment-directive` + `vue/no-v-html`
  - `workaround`: same command returns no errors

## Notes

- Root cause: processor replacement, not rule logic.
- The workaround composes Vue + Diff processors so Vue postprocess runs first and diff filtering runs afterward.
- Implementation should keep backward compatibility for existing non-processor workflows.
- Add regression tests covering processor composition with Vue processor shape.

## Code pointers

- `src/processors.ts`
- `src/index.ts`
- `src/processors.test.ts`
