---
identifier: EPD-3
title: Improve IDE diagnostics reliability and first-edit visibility
teamKey: EPD
stateName: Done
labelNames:
  - bug
id: 303d76f8-c2bf-4d64-8d9b-4c7168364d9f
teamId: c2b86822-351a-41ab-b4db-652fc5a7a27c
stateId: 567bb0af-8316-40db-8a09-5ed9138f0d29
labelIds:
  - 842d9d04-4acf-4dc5-9243-59a9d9cf042e
priority: 2
priorityName: High
createdAt: 2026-02-15T11:09:26.969Z
updatedAt: 2026-02-15T11:32:43.810Z
---

## Problem

Diagnostics in editors are reported as delayed or missing, including "only appears on second edit" and VS Code visibility problems.
Linked upstream issues: #14, #36, #70, #39, #38.

## Expected

Errors should appear predictably on first relevant edit, with stable processor behavior across editor-triggered lint runs.

## Repro

1. Use plugin in VS Code with ESLint extension.
2. Edit a changed file once.
3. Observe delayed diagnostics or missing error output until additional edits.

## Notes

- Investigate processor lifecycle assumptions against editor lint invocation patterns.
- Add debug logging toggles and docs for troubleshooting.
- Add regression tests for first-run/first-edit behavior where feasible.

## Code pointers

- `src/processors.ts`
- `src/index.ts`
- `src/processors.test.ts`
