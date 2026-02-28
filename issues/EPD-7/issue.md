---
identifier: EPD-7
title: Improve diff processor performance on large repos/files
teamKey: EPD
stateName: Done
labelNames:
  - bug
id: 9f75b67a-58f2-4ff0-a42c-d8f3033ccfa7
teamId: c2b86822-351a-41ab-b4db-652fc5a7a27c
stateId: 567bb0af-8316-40db-8a09-5ed9138f0d29
labelIds:
  - 842d9d04-4acf-4dc5-9243-59a9d9cf042e
priority: 2
priorityName: High
createdAt: 2026-02-16T15:50:35.931Z
updatedAt: 2026-02-28T16:24:07.453Z
---

## Problem

The diff processor can become slow on large repositories and/or large file sets.
Linked upstream issue: #64.

## Expected

`eslint-plugin-diff` should keep reasonable latency in editor and CI workflows
for medium-to-large repositories.

## Repro

1. Run lint with `plugin:diff/*` in a repo with many changed files or large
   diffs.
2. Observe noticeable delay in preprocess/postprocess phases.

## Notes

- Profile calls around `getDiffFileList`, `getUntrackedFileList`,
  `getDiffForFile`, and range filtering.
- Avoid repeated `git` invocations per file where a batch/snapshot strategy
  can be reused.
- Preserve correctness for staged, CI, and VS Code paths.

## Code pointers

- `src/processors.ts`
- `src/git.ts`
- `src/processors.test.ts`
- `src/processors-vscode.test.ts`
