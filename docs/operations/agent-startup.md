# Meco Agent Startup Instructions

## Prerequisites

Before starting work on this repository, read and follow these documents:

1. `docs/plans/rebrand-halo-to-meco.md` — Rebrand decisions and scope
2. `docs/operations/upstream-sync.md` — Upstream sync workflow and Rebrand Impact Map
3. `docs/plans/meco-next-steps.md` — Current development direction
4. `docs/plans/rebrand-follow-up-backlog.md` — Non-critical rename items (backlog only)

## Current Development Context

### Repository Information
- **Repository**: `${HOME}/repos/source/heyoo-meco`
- **Main Branch**: `main` — where Meco rebrand and product development happens
- **Upstream Mirror**: `upstream-dev` — mirrors `hello-halo/dev`
- **Upstream Remote**: Points to local `${HOME}/repos/source/hello-halo`

### Branch Workflow
```
hello-halo/main
    ↓
hello-halo/dev
    ↓
heyoo-meco/upstream-dev
    ↓
heyoo-meco/main
```

## Rebrand Execution

If tasked to execute the Halo → Meco rebrand:

1. Read `docs/plans/rebrand-halo-to-meco.md` thoroughly
2. Create a detailed modification plan listing all files to be changed
3. Get user confirmation before making any code changes
4. Only perform changes explicitly listed in the rebrand plan
5. Keep internal identifiers unchanged unless specified in the plan
6. Keep the diff minimal

## Upstream Sync

If tasked to sync upstream changes:

1. Read `docs/operations/upstream-sync.md` thoroughly
2. Follow the preflight checks and staged merge process
3. Strictly follow the AI-safe Git policy:
   - Inspect, fetch, checkout, merge when clean and no conflict occurs
   - **Do NOT push without explicit human confirmation**
   - Stop on dirty trees, conflicts, non-fast-forward updates, or identity overwrite risks
4. Use the Rebrand Impact Map to protect Meco identity during Stage 4 merges
5. If upstream changes conflict with Meco identity fields, stop and ask for human confirmation

## Development Conventions

In addition to this document, follow the development conventions in:
- `.claude/skills/halo-dev/CONTEXT.md`
- `.claude/skills/halo-dev/ARCHITECTURE.md`
- `.claude/skills/halo-dev/quick.md`

Key conventions include:
- Use `t('English text')` for all user-facing strings
- No hardcoded colors — use theme tokens only
- Responsive design is mandatory (mobile-first, `sm:` breakpoint at 640px)
- Tailwind-first styling
- Respect layering and module boundaries
- Production logging is required

## Restrictions

- **Do NOT expand the rebrand scope** — rebrand-follow-up-backlog.md is backlog only
- **Do NOT push** without explicit user confirmation
- **Do NOT merge** upstream changes that would overwrite Meco identity fields

## Quick Start

To begin the rebrand process, execute:

```text
Now please follow docs/plans/rebrand-halo-to-meco.md to execute Halo → Meco rebrand. First read the relevant files and provide a modification plan, then proceed with changes after confirmation.
```
