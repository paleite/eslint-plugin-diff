---
identifier: EPD-1
title: ESLint 9 + flat config compatibility
teamKey: EPD
stateName: Done
labelNames:
  - bug
id: aa6f7766-2316-425a-b913-2ad773299de2
teamId: c2b86822-351a-41ab-b4db-652fc5a7a27c
stateId: 567bb0af-8316-40db-8a09-5ed9138f0d29
labelIds:
  - 842d9d04-4acf-4dc5-9243-59a9d9cf042e
priority: 1
priorityName: Urgent
createdAt: 2026-02-15T11:09:00.362Z
updatedAt: 2026-02-15T11:32:43.556Z
---

## Problem

Users report missing support for ESLint 9+ and flat config mode.
Linked upstream issues: #72, #47, #42.

## Expected

`eslint-plugin-diff` should work with ESLint 9 and flat config without breaking existing ESLint 8 users.

## Repro

1. Install ESLint 9 with flat config and this plugin.
2. Enable the plugin in config.
3. Run lint in diff/ci/staged modes.
4. Observe incompatibility or plugin load failures.

## Notes

- Keep backwards compatibility for current `.eslintrc` users where possible.
- Add focused compatibility tests for ESLint 9 + flat config.
- Document supported setup paths in README.

## Code pointers

- `src/index.ts`
- `src/processors.ts`
- `README.md`
