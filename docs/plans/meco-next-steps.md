# Meco Next Steps

This document records the immediate Meco-side development direction after the repository split. It is a planning note, not an execution runbook.

## Current Working Context

- Repository: `${HOME}/repos/source/heyoo-meco`
- Main development branch: `main`
- Upstream mirror branch: `upstream-dev`
- The original Halo repository remains unchanged and continues to be the short-term upstream source through `hello-halo/dev`.

## Primary Documents

Before executing Meco work, read and follow:

1. [Rebrand plan](./rebrand-halo-to-meco.md)
2. [Upstream sync runbook](../operations/upstream-sync.md)
3. [Agent startup instructions](../operations/agent-startup.md)
4. [Rebrand follow-up backlog](./rebrand-follow-up-backlog.md)

## Immediate Direction

1. Complete the first Halo → Meco rebrand pass according to [rebrand-halo-to-meco.md](./rebrand-halo-to-meco.md).
2. Keep the first rebrand pass limited to intentional product and project identity changes listed in the plan.
3. Do not perform broad internal renames unless the plan is explicitly updated and approved.
4. Use [upstream-sync.md](../operations/upstream-sync.md) for future upstream merges.
5. Treat [rebrand-follow-up-backlog.md](./rebrand-follow-up-backlog.md) as backlog only; do not pull those items into the active rebrand scope without confirmation.

## Agent Handoff

Future agents should start from [agent-startup.md](../operations/agent-startup.md) instead of relying on chat history.
