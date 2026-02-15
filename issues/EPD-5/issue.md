---
identifier: EPD-5
title: "Compatibility follow-ups: GitLab, eslint-plugin-vue, staged config overrides"
teamKey: EPD
stateName: Done
labelNames:
  - bug
id: 255ce433-41fd-41d6-9433-104545d4861a
teamId: c2b86822-351a-41ab-b4db-652fc5a7a27c
stateId: 567bb0af-8316-40db-8a09-5ed9138f0d29
labelIds:
  - 842d9d04-4acf-4dc5-9243-59a9d9cf042e
priority: 3
priorityName: Normal
createdAt: 2026-02-15T11:09:41.131Z
updatedAt: 2026-02-15T11:32:44.069Z
---

## Problem

Several compatibility issues remain ungrouped and need targeted investigation.
Linked upstream issues: #65, #46, #31.

## Expected

Defined compatibility stance plus fixes/docs/tests for supported integration paths.

## Repro

1. Use plugin in GitLab pipelines or with eslint-plugin-vue and staged config variants.
2. Observe unsupported behavior or config interaction surprises.

## Notes

- Validate current behavior first and separate docs-only vs code-change outcomes.
- Add targeted fixtures/tests for confirmed compatibility expectations.

## Code pointers

- `src/ci.ts`
- `src/index.ts`
- `README.md`
