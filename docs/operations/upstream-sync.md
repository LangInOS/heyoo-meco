# Upstream Sync Runbook

## Purpose

This document is the single source of truth for synchronizing upstream Halo code into Meco.

The short-term code flow is:

```text
Original upstream main
    ↓
${HOME}/repos/source/hello-halo main
    ↓
${HOME}/repos/source/hello-halo dev
    ↓
${HOME}/repos/source/heyoo-meco upstream-dev
    ↓
${HOME}/repos/source/heyoo-meco main
```

Meco keeps this full chain for now because `hello-halo/dev` may still receive stabilization fixes before Meco becomes fully independent.

## Repository Roles

| Repository | Branch | Role | Direct development allowed |
|---|---|---|---|
| `${HOME}/repos/source/hello-halo` | `main` | Mirror of the original upstream main branch | No |
| `${HOME}/repos/source/hello-halo` | `dev` | Halo-side stabilization branch and current Meco upstream source | Yes, only for short-term shared fixes |
| `${HOME}/repos/source/heyoo-meco` | `upstream-dev` | Meco-side mirror of `hello-halo/dev` | No |
| `${HOME}/repos/source/heyoo-meco` | `main` | Meco product branch | Yes |

## Non-Negotiable Rules

1. `hello-halo/main` is a sync-only branch.
2. Do not commit Meco branding, product changes, or repository-specific changes to `hello-halo/main`.
3. Do not commit directly to `heyoo-meco/upstream-dev`.
4. `heyoo-meco/upstream-dev` must only mirror `hello-halo/dev`.
5. Meco product changes belong in `heyoo-meco/main`.
6. Do not push any branch without explicit human confirmation.
7. Stop immediately if a merge conflict appears.
8. Stop immediately if a working tree is dirty before starting a stage.
9. Stop immediately if a command would overwrite, delete, or reset local work.
10. Stop immediately if tests fail in a way that is not clearly unrelated.
11. Never include secrets, tokens, private keys, access codes, or local-only credentials in commits, logs, or documents.

## AI Execution Policy

AI may execute these operations automatically when the working tree is clean and no conflict occurs:

- `git status`
- `git branch --show-current`
- `git remote -v`
- `git fetch`
- `git checkout`
- `git merge --ff-only`
- `git merge --no-edit`
- `git log --oneline`
- `git diff`
- validation commands requested by the user

AI must request human confirmation before:

- pushing to any remote
- resolving merge conflicts
- using `git reset`
- using `git rebase`
- deleting branches
- deleting files
- accepting large generated diffs
- changing repository identity, product identity, package names, app IDs, or data directories
- modifying this runbook

## Preflight Check

Run this before every sync:

```bash
cd ${HOME}/repos/source/hello-halo
git status --short
git branch --show-current
git remote -v

cd ${HOME}/repos/source/heyoo-meco
git status --short
git branch --show-current
git remote -v
```

Expected result:

- Both working trees are clean.
- `hello-halo` has a branch named `main`.
- `hello-halo` has a branch named `dev`.
- `heyoo-meco` has a branch named `main`.
- `heyoo-meco` has a branch named `upstream-dev`.
- `heyoo-meco` has `origin` pointing to `https://github.com/LangInOS/heyoo-meco.git`.
- `heyoo-meco` has `upstream` pointing to `${HOME}/repos/source/hello-halo`.
- `heyoo-meco` upstream push URL is disabled or otherwise not used.

If any expected result is not true, stop and ask for human confirmation.

## Stage 1: Sync Original Upstream Main into hello-halo/main

This stage updates the local Halo mainline mirror.

```bash
cd ${HOME}/repos/source/hello-halo
git checkout main
git status --short
git fetch --all --prune
git remote -v
```

Then update `main` from the remote that represents the original upstream main branch.

If the original upstream main is tracked by `origin/main`, use:

```bash
git merge --ff-only origin/main
```

If the original upstream main is tracked by another remote, use that remote explicitly:

```bash
git merge --ff-only <remote>/main
```

Expected result:

- `hello-halo/main` fast-forwards cleanly.
- No merge commit is created.
- No local product or stabilization changes appear on `hello-halo/main`.

Stop conditions:

- Fast-forward is not possible.
- The correct upstream remote is unclear.
- The working tree is dirty.
- Any file would be overwritten.

## Stage 2: Merge hello-halo/main into hello-halo/dev

This stage brings upstream main changes into the Halo-side stabilization branch.

```bash
cd ${HOME}/repos/source/hello-halo
git checkout dev
git status --short
git merge --no-edit main
```

Expected result:

- `hello-halo/dev` contains the latest `hello-halo/main`.
- Existing `dev` fixes are preserved.
- A merge commit may be created if needed.
- No Meco-specific branding or product changes are introduced here.

Recommended validation:

```bash
git status --short
git log --oneline --decorate -10
```

Stop conditions:

- Merge conflict.
- Unexpected large deletion.
- Generated files change unexpectedly.
- Product identity changes appear in `hello-halo/dev`.
- Tests or validation fail unclearly.

## Stage 3: Sync hello-halo/dev into heyoo-meco/upstream-dev

This stage updates the Meco-side mirror branch.

```bash
cd ${HOME}/repos/source/heyoo-meco
git fetch upstream dev
git checkout upstream-dev
git status --short
git merge --ff-only upstream/dev
```

Expected result:

- `heyoo-meco/upstream-dev` fast-forwards to `hello-halo/dev`.
- No direct Meco commits are added to `upstream-dev`.
- No merge commit is created on `upstream-dev`.

Recommended validation:

```bash
git status --short
git log --oneline --decorate -10
```

Stop conditions:

- Fast-forward is not possible.
- The branch contains direct local commits.
- The working tree is dirty.
- The upstream remote points somewhere unexpected.

If fast-forward is not possible, stop and ask for human confirmation. Do not reset automatically.

## Stage 4: Merge heyoo-meco/upstream-dev into heyoo-meco/main

This stage brings synced Halo code into Meco.

```bash
cd ${HOME}/repos/source/heyoo-meco
git checkout main
git status --short
git merge --no-edit upstream-dev
```

Expected result:

- `heyoo-meco/main` contains the latest synced Halo changes.
- Meco-specific product changes remain on `main`.
- A merge commit may be created if needed.
- Branding differences are preserved unless the user explicitly requests otherwise.

Recommended validation:

```bash
git status --short
git log --oneline --decorate -10
git diff --stat upstream-dev..main
```

Stop conditions:

- Merge conflict.
- Meco branding is accidentally reverted.
- App IDs, package names, product names, data directory names, icons, or visible descriptions change unexpectedly.
- Large unrelated changes appear.
- Tests fail unclearly.

## Conflict Handling

When a conflict occurs:

1. Stop immediately.
2. Do not resolve the conflict automatically.
3. Report:
   - repository path
   - current branch
   - merge source
   - conflicted files
   - short explanation of likely cause
4. Ask the human whether to resolve, abort, or inspect further.

Useful read-only inspection commands:

```bash
git status
git diff --name-only --diff-filter=U
git diff
```

Allowed only after human confirmation:

```bash
git merge --abort
```

## Push Policy

Pushes are never automatic.

After a clean sync, ask the human before running any push command.

Possible push commands after confirmation:

```bash
cd ${HOME}/repos/source/hello-halo
git push origin main
git push origin dev

cd ${HOME}/repos/source/heyoo-meco
git push origin upstream-dev
git push origin main
```

Only push branches that were intentionally updated.

Do not push to the `upstream` remote from `heyoo-meco`.

## Recommended Full Sync Sequence

Use this sequence when the user asks to perform a full upstream sync:

```bash
cd ${HOME}/repos/source/hello-halo
git checkout main
git status --short
git fetch --all --prune
git merge --ff-only <remote>/main

git checkout dev
git status --short
git merge --no-edit main

cd ${HOME}/repos/source/heyoo-meco
git fetch upstream dev
git checkout upstream-dev
git status --short
git merge --ff-only upstream/dev

git checkout main
git status --short
git merge --no-edit upstream-dev
```

After the merge completes, run validation before asking for push confirmation.

## Validation Checklist

Minimum validation after syncing into `heyoo-meco/main`:

```bash
cd ${HOME}/repos/source/heyoo-meco
git status --short
git log --oneline --decorate -10
git diff --stat upstream-dev..main
```

If source code changed, also run the relevant project validation commands.

Common validation commands:

```bash
npm run typecheck
npm run lint
npm test
```

Use only commands that exist in the repository scripts.

If renderer user-facing text changed, run:

```bash
npm run i18n
```

## Meco Identity Guardrail

During Stage 4, inspect whether upstream changes touch identity-sensitive files.

Identity-sensitive areas include:

- `package.json`
- `product.example.json`
- `product.pro.json`
- `capacitor.config.ts`
- `resources/`
- `build/`
- `electron-builder` configuration
- `android/`
- `ios/`
- app name strings
- bundle IDs
- package IDs
- data folder names
- logo and icon assets
- repository descriptions
- README files and user-facing docs

If any identity-sensitive change may overwrite Meco decisions, stop and ask for human confirmation.

Current Meco decisions:

| Item | Value |
|---|---|
| Product/display name | `Meco` |
| Repository / npm package name | `heyoo-meco` |
| Data directory | `meco` |
| Desktop app ID | `com.meco.app` |
| Mobile app ID | `com.meco.mobile` |
| GitHub repository | `https://github.com/LangInOS/heyoo-meco` |

## Rebrand Impact Map

This map lists files that are intentionally different from upstream Halo after `docs/plans/rebrand-halo-to-meco.md` is applied.

During Stage 4, if upstream changes touch any item below, preserve Meco identity by default and stop for human confirmation before resolving conflicts or accepting upstream changes.

| File / Area | Meco value to preserve | Upstream Halo value to reject during identity conflicts |
|---|---|---|
| `package.json` | top-level `name`: `heyoo-meco` | `halo` or `hello-halo` |
| `package.json` | `build.appId`: `com.meco.app` | `com.halo.app` |
| `package.json` | `build.productName`: `Meco` | `Halo` |
| `product.example.json` | `name`: `Meco` | `Halo` |
| `product.example.json` | `dataFolderName`: `meco` | `halo` |
| `product.pro.json` | `name`: `Meco` | `Halo` |
| `product.pro.json` | `dataFolderName`: `meco` | `halo` |
| `src/main/services/ai-sources/auth-loader.ts` | fallback product name: `Meco` | `Halo` |
| `src/main/index.ts` | `setAppUserModelId`: `com.meco.app` | `com.halo.app` |
| `src/main/index.ts` | visible/logging identity references: `Meco` | `Halo` |
| `src/renderer/index.html` | window title starts with `Meco` | title starts with `Halo` |
| `src/main/platform/background/tray.ts` | tray tooltip: `Meco` | `Halo` |
| `resources/README.txt` | generated asset description uses `Meco` | `Halo` |
| `resources/icon.svg` | Meco source logo | Halo source logo |
| `resources/**` generated icons | Meco icon assets | Halo icon assets |
| `capacitor.config.ts` | `appName`: `Meco` | `Halo` |
| `capacitor.config.ts` | `appId`: `com.meco.mobile` | `com.halo.mobile` |
| `android/app/src/main/res/values/strings.xml` | launcher/app strings use `Meco` and `com.meco.mobile` | `Halo` and `com.halo.mobile` |
| `android/app/build.gradle` | `namespace`: `com.meco.mobile` | `com.halo.mobile` |
| `android/app/build.gradle` | `applicationId`: `com.meco.mobile` | `com.halo.mobile` |
| `android/app/src/main/java/com/meco/mobile/**` | Java package path and declarations: `com.meco.mobile` | `com.halo.mobile` |
| `ios/App/App/Info.plist` | `CFBundleDisplayName`: `Meco` | `Halo` |
| `ios/App/App.xcodeproj/project.pbxproj` | `PRODUCT_BUNDLE_IDENTIFIER`: `com.meco.mobile` | `com.halo.mobile` |

Merge guidance:

- If upstream only changes unrelated logic in one of these files, merge the logic while preserving Meco identity values.
- If upstream changes the same identity field, do not accept the upstream value without human confirmation.
- If upstream moves, renames, or regenerates icon files, inspect whether Meco icon assets would be overwritten before continuing.
- If upstream introduces new user-visible Halo branding in a new file, treat that file as identity-sensitive and ask whether it should be converted to Meco.
- If `docs/plans/rebrand-halo-to-meco.md` changes later, update this map in the same commit.

## Long-Term Simplification Target

The current chain is intentionally conservative.

When `heyoo-meco/main` becomes stable enough and fixes no longer need to land in `hello-halo/dev`, the workflow may be simplified to:

```text
Original upstream main
    ↓
heyoo-meco main
```

Do not switch to the simplified workflow without explicit human approval and an update to this runbook.
