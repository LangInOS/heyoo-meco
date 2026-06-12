# Rebrand Follow-up Backlog

This document lists non-critical Halo → Meco rename items intentionally left out of the first rebrand pass.

**Phase 1 (Current)**: These items are NOT replaced. See [rebrand-implementation-phases.md](./rebrand-implementation-phases.md) for phased implementation strategy.

**Phase 2 (Future)**: When Meco becomes fully independent, these items will be replaced via complete rebrand script.

---

## Phase 2 — Complete Rebrand Items

The following items are deferred to Phase 2 complete rebrand. The replacement script designed for Phase 1 already covers string replacements; Phase 2 adds file/directory rename operations.

### File Names and Directory Names

These require file system operations (not string replacement):

- `HaloLogo.tsx` → `MecoLogo.tsx`
- `android/app/src/main/java/com/halo/mobile/` → `com/meco/mobile/`
- All files containing `Halo` in name
- All directories containing `halo` in path

### Java Package Declaration

After directory move:

- `package com.halo.mobile;` → `package com.meco.mobile;`
- `android/app/build.gradle` `namespace` → `com.meco.mobile`

### Internal Code Names

These are string replacements but deferred to Phase 2 to reduce merge conflict risk:

- `window.halo`
- `HaloAPI`
- `HaloConfig`
- `halo:` IPC and DOM event prefixes
- CSS variables and classes such as `--halo-glow`, `.halo-breathe`, and `.halo-space-card`
- developer-only module, type, or directory names that contain `halo`

### SDK Package Name

- `@hello-halo/agent-sdk` — independently published artifact; rename decision depends on SDK ownership

---

## Phase 1 — Already Replaced

The following are replaced in Phase 1 via global string replacement (see [rebrand-halo-to-meco.md](./rebrand-halo-to-meco.md)):

- User-facing display names (`Halo` → `Meco`)
- Product configuration (`product.json` fields)
- Bundle IDs (`com.halo.app`, `com.halo.mobile`)
- Data folder names (`halo`, `halo-dev`)
- Android/iOS app names and labels
- All runtime-visible strings containing `halo` or `Halo`

---

## Documentation and Marketing

These items do not affect runtime behavior and can be handled in a separate pass:

- `README.md`
- localized README files under `docs/`
- screenshots, demo GIFs, installation instructions, and user guides
- GitHub repository About, Topics, and Description
- release notes and changelog entries
- documentation asset paths that contain Halo branding

## Build and Release Metadata

Check these only when preparing actual builds or releases:

- lockfile package-name references
- GitHub Actions workflow names
- CI cache keys
- build artifact names
- installer metadata
- Windows shortcut and uninstall display names
- Linux `.desktop` file or AppImage metadata
- auto-update feed names and release channels
- signing or notarization script display names

## Data Migration and Compatibility

The first development rebrand can use the new Meco data directory directly. Production release planning should revisit:

- one-time migration from `~/.halo/` to `~/.meco/`
- config, database, cache, log, and workspace migration
- old Bundle ID update behavior
- whether a read-only fallback to the old Halo data directory is needed

## Tests, Fixtures, and Snapshots

Phase 1 replacement script already covers test files. Handle these when validation exposes failures:

- test snapshots containing `Halo`
- mock configuration values
- fixture names
- E2E page-title expectations
- screenshot baselines

## Visual Asset Polish

The core icon replacement belongs to the first rebrand pass. These surrounding assets can be reviewed later:

- app store preview images
- splash screen polish
- mobile launcher adaptive icon background
- tray template icon edge quality
- DMG background image
- Windows installer banner
- macOS Finder preview icon

## External Service Identity

Review only after the corresponding service is actually used:

- telemetry app name
- crash reporting project name
- update server app name
- website domain
- OAuth app display name
- notification sender name
- remote access page title
