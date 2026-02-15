---
identifier: EPD-6
title: "Policy decision: out-of-scope feature requests vs core changed-lines model"
teamKey: EPD
stateName: Backlog
labelNames: []
id: 2e31deb2-11a8-4a4b-bf95-7fa1b3513591
teamId: c2b86822-351a-41ab-b4db-652fc5a7a27c
stateId: d5b06eb7-a2db-427b-88c7-01fb29abe4d6
labelIds: []
priority: 4
priorityName: Low
createdAt: 2026-02-15T11:09:45.447Z
updatedAt: 2026-02-15T11:15:02.748Z
---

## Problem

Feature requests conflict with the plugin's core principle ("lint changed lines only"), but no explicit policy issue tracks accept/reject decisions.
Linked upstream issues: #71, #62, #58, #45.

## Expected

Explicit maintainer policy for:

- accepted extensions to changed-lines behavior,
- rejected requests with rationale,
- recommended alternatives for out-of-scope requests.

## Repro

1. Review feature requests asking for whole-file linting, time-based diffs, rule exclusions, and CLI bypass flags.
2. Observe repeated debates without a canonical policy decision.

## Notes

- Outcome may be docs-only.
- If requests are rejected, close linked upstream issues with policy reference.

## Code pointers

- `README.md`
- `CLAUDE.md`
