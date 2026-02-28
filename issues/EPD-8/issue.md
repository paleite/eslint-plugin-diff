---
identifier: EPD-8
title: Defer git side effects until processor execution (flat config safe import)
teamKey: EPD
stateName: Done
labelNames:
  - bug
id: ccdf481e-d550-49a4-b0ce-544de996507d
teamId: c2b86822-351a-41ab-b4db-652fc5a7a27c
stateId: 567bb0af-8316-40db-8a09-5ed9138f0d29
labelIds:
  - 842d9d04-4acf-4dc5-9243-59a9d9cf042e
priority: 2
priorityName: High
createdAt: 2026-02-28T15:03:03.000Z
updatedAt: 2026-02-28T16:24:07.582Z
---

## Problem

Importing `eslint-plugin-diff` currently performs git work at module load time.
In `src/processors.ts`, CI init can call `fetchFromOrigin(...)` and mutate
`ESLINT_PLUGIN_DIFF_COMMIT`, and processor construction eagerly calls
`getDiffFileList(...)` for `ci`, `diff`, and `staged`.

This makes `import "eslint-plugin-diff"` non-inert in flat config flows where
consumers may only inspect or conditionally use `configs["flat/*"]`.
Linked upstream issue: #77.

## Expected

Plugin import should be side-effect free with respect to git commands. Git
operations should run when ESLint invokes processor callbacks.

## Repro

1. Add `import diff from "eslint-plugin-diff"` in `eslint.config.js`.
2. Do not use `diff.configs["flat/*"]` in the exported config.
3. Observe import-time git behavior:
   - `CI` path can trigger `fetchFromOrigin(...)`.
   - Processor initialization triggers `getDiffFileList(...)`.

## Scope

- Move initialization work from module scope into lazy processor execution
  paths (`preprocess`/`postprocess`) or equivalent first-use guards.
- Preserve current behavior semantics for CI branch guessing and staged/diff
  filtering.
- Update tests to assert no import-time git calls and first-use initialization.

## Non-goals

- Broad refactors unrelated to import-time side effects.
- Changing external processor names or config API shape.

## Acceptance criteria

- [ ] Importing plugin module does not call `fetchFromOrigin`.
- [ ] Importing plugin module does not call `getDiffFileList`.
- [ ] `ci`, `diff`, and `staged` still produce expected filtering after lazy
      initialization.
- [ ] Flat configs (`flat/ci`, `flat/diff`, `flat/staged`) remain unchanged.

## Code pointers

- `src/processors.ts`
- `src/index.ts`
- `src/processors-ci-init.test.ts`
- `src/processors-vscode.test.ts`
