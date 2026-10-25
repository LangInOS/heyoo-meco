# Upstream Sync Runbook

## Purpose

This document is the single source of truth for adopting upstream Halo code into Meco and for producing Meco release snapshots.

The code flow is:

```text
Original upstream main (GavinHome/hello-halo on GitHub)
    ↓ ff-only
${HOME}/repos/source/hello-halo main          (local mirror, sync-only)
    ↓ ff-only
${HOME}/repos/source/heyoo-meco main          (Meco product main branch; currently identical to upstream)
    ↓ merge --no-edit main
${HOME}/repos/source/heyoo-meco dev           (Meco product development branch)
    ↓ npm run rebrand (text/logo replacement)
${HOME}/repos/source/heyoo-meco public        (release snapshot, rebuilt from dev every time)
```

The v1 chain (`hello-halo/dev` → `heyoo-meco/upstream-dev` → curated merges into `refactor/rebrand-to-meco`) is retired. Old branches are archived, never deleted:

- `heyoo-meco`: `archive/main` (v1 product main @ 834e76dd), `archive/upstream-dev`, `archive/refactor/rebrand-to-meco`
- `hello-halo`: `archive/dev-2.1.16`

All previous Meco product work stays reachable through the archived branches. Nothing from those branches is merged into the new flow.

## Repository Roles

| Repository | Branch | Role | Direct development allowed |
|---|---|---|---|
| `${HOME}/repos/source/hello-halo` | `main` | Local mirror of the original upstream main | No — sync only |
| `${HOME}/repos/source/heyoo-meco` | `main` | Meco product main branch, synced from `hello-halo/main` | No — sync only; currently identical to upstream |
| `${HOME}/repos/source/heyoo-meco` | `dev` | Meco product development happens here | Yes |
| `${HOME}/repos/source/heyoo-meco` | `public` | Meco release snapshot generated from `dev` by the rebrand script | No — rebuilt every time, never incrementally updated |

## Non-Negotiable Rules

1. `hello-halo/main` and `heyoo-meco/main` are sync-only. All Meco product work goes to `dev`.
2. Syncing `main` must always be a fast-forward. If it is not, someone committed to a sync-only branch — stop and ask the human.
3. `public` is always rebuilt from `dev` with the rebrand script. It never receives merge commits or incremental code updates.
4. Never run `npm run rebrand` on `main` or `dev` — only on `public` during snapshot generation.
5. Do not push to the `upstream` remote from `heyoo-meco` (its push URL is disabled).
6. Never push without explicit human confirmation.
7. Stop immediately on: merge conflict, dirty working tree, unclear validation failure, or any command that would overwrite, delete, or reset local work.
8. Meco identity (product name, app IDs, data folder, logos, user-visible strings) is owned by two places only: work done in `dev`, and the replacement rules in `scripts/rebrand.mjs`. If upstream introduces new user-visible Halo strings, extend the script's rules — do not hand-edit generated output on `public`.
9. Known gap: `scripts/rebrand.mjs` currently performs text replacement only. Logo/asset replacement for `public` is a pending script extension; until then the Meco logo assets are kept as untracked local files (e.g. `resources/meco-logo.png`, `meco-website/`) and must not be committed to `main` or `dev`.

## Stage 1: Sync Original Upstream into hello-halo/main

```bash
cd ${HOME}/repos/source/hello-halo
git checkout main
git status --short
git fetch --all --prune
git merge --ff-only origin/main
```

Expected: fast-forward only, no merge commit, no local changes introduced.

Stop conditions: fast-forward not possible, dirty tree, or the upstream remote is unclear.

## Stage 2: Sync hello-halo/main into heyoo-meco/main

```bash
cd ${HOME}/repos/source/heyoo-meco
git fetch upstream
git checkout main
git status --short
git merge --ff-only upstream/main
```

Expected: fast-forward only. `main` stays identical to upstream code.

Stop conditions: fast-forward not possible (a sync-only branch received a commit — stop and ask the human), dirty tree.

## Stage 3: Merge main into dev

```bash
cd ${HOME}/repos/source/heyoo-meco
git checkout dev
git status --short
git merge --no-edit main
```

Expected: `dev` keeps its own commits and gains the upstream update. This is the only stage where a conflict can legitimately appear; resolve only the reported conflicts and leave auto-merged hunks untouched.

## Stage 4: Generate the public Release Snapshot

Run after every code update or after finishing work in `dev`, when the human requests a release:

```bash
cd ${HOME}/repos/source/heyoo-meco
git checkout public            # first time: git checkout -b public dev
git status --short
git reset --hard dev           # rebuild from scratch, no incremental updates
npm run rebrand                # Halo → Meco, in place
git add -A
git commit -m "chore: generate Meco public snapshot from dev @ <dev-sha>"
```

Notes:

- `npm run rebrand` is a global string replacement (`hello-halo`→`heyoo-meco`, `Halo`→`Meco`, case variants, with rollback rules that keep Java packages, class names, and SDK paths consistent with unchanged file/directory names). It does not rename files or directories; logo/asset handling is a pending extension (see Rule 9).
- `npm run rebrand:check` reports whether the tree is currently in Halo or Meco state; `npm run rebrand:dry-run` previews the diff without writing.
- `git reset --hard dev` here is the documented rebuild step and only ever runs on `public`, never on `main` or `dev`.

## Validation

```bash
git status --short
git log --oneline --decorate -10
npm run typecheck
npm run lint
```

Use only scripts that exist in `package.json`. If renderer user-facing text changed, run `npm run i18n`.

## Push Policy

Pushes are never automatic. After a clean sync, ask the human and push only branches that were intentionally updated. Note that pushing the new mirror-style `main` to `origin` will require a force push (the remote still holds the v1 product main); that always needs explicit human confirmation.

## AI Execution Policy

AI may execute automatically when the working tree is clean and no conflict occurs: `git status`, `git branch`, `git remote -v`, `git fetch`, `git checkout`, `git merge --ff-only`, `git merge --no-edit`, `git log`, `git diff`, validation commands, and Stage 4 regeneration when the human requested a release.

AI must request human confirmation before: pushing, resolving merge conflicts, `git reset` outside Stage 4's `public` rebuild, `git rebase`, deleting branches or files, and modifying this runbook.
