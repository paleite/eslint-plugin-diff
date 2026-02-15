---
identifier: EPD-4
title: "Triage tracker: open GitHub issues (Now/Next/Later/Won't do)"
teamKey: EPD
stateName: Done
labelNames: []
id: 59626b1b-402d-45c3-8b40-180b884d0400
teamId: c2b86822-351a-41ab-b4db-652fc5a7a27c
stateId: 567bb0af-8316-40db-8a09-5ed9138f0d29
labelIds: []
priority: 2
priorityName: High
createdAt: 2026-02-15T11:09:34.797Z
updatedAt: 2026-02-15T11:32:44.325Z
---

## Problem

Open GitHub issues are ungrouped, making execution order and policy decisions unclear.

## Expected

A maintained triage board with explicit lanes and linked execution issues:

- Now: compatibility/regression fixes with highest user impact.
- Next: ecosystem compatibility follow-ups.
- Later/Won't do: policy and scope decisions.

## Repro

1. Review open GitHub issues.
2. Observe mixed bug reports, compatibility requests, and product-direction requests without a shared tracker.

## Notes

- This issue tracks the board and links child execution/policy issues.
- Do not close until child issues are resolved or explicitly canceled/duplicated.
- Execution order chosen and implemented:
  1. EPD-2 (`feature/epd-2-diff-commit-ref-handling`)
  2. EPD-1 (`feature/epd-1-eslint9-flat-config`) rebased on EPD-2
  3. EPD-3 (`feature/epd-3-ide-diagnostics-first-edit`) rebased on EPD-1
  4. EPD-5 (`feature/epd-5-compatibility-followups`) rebased on EPD-3
  5. EPD-4 (`feature/epd-4-triage-tracker-open-issues`) rebased on EPD-5

## Code pointers

- `issues/EPD-1/issue.md`
- `issues/EPD-2/issue.md`
- `issues/EPD-3/issue.md`
- `issues/EPD-5/issue.md`
- `issues/EPD-6/issue.md`
