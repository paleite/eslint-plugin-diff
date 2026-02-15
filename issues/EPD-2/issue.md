---
identifier: EPD-2
title: Fix ESLINT_PLUGIN_DIFF_COMMIT reference handling (origin/hash)
teamKey: EPD
stateName: Done
labelNames:
  - bug
id: 5782a148-f282-4b64-8a74-c2b9a1541d90
teamId: c2b86822-351a-41ab-b4db-652fc5a7a27c
stateId: 567bb0af-8316-40db-8a09-5ed9138f0d29
labelIds:
  - 842d9d04-4acf-4dc5-9243-59a9d9cf042e
priority: 2
priorityName: High
createdAt: 2026-02-15T11:09:14.898Z
updatedAt: 2026-02-15T11:32:42.254Z
---

## Problem

`ESLINT_PLUGIN_DIFF_COMMIT` reference handling regressed for plain commit hashes and non-`origin/*` refs.
Linked upstream issues: #67, #60, #40.

## Expected

The plugin should accept valid git commit/ref syntax consistently, including explicit commit hashes and branch refs with or without `origin/`.

## Repro

1. Set `ESLINT_PLUGIN_DIFF_COMMIT` to a hash or non-`origin/*` ref.
2. Run lint with `plugin:diff/ci`.
3. Observe resolution failures or incorrect normalization.

## Notes

- Preserve explicit user-provided refs; avoid unwanted rewriting.
- Add tests for hash refs, local branch refs, and remote refs.
- Confirm behavior in CI provider auto-guess path and direct env var path.

## Code pointers

- `src/ci.ts`
- `src/git.ts`
- `src/ci.test.ts`
- `src/git.test.ts`
