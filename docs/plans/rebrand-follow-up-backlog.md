# Rebrand Follow-up Backlog

This document lists non-critical Halo → Meco rename items intentionally left out of the first rebrand pass.

Use this as backlog only. Do not expand the active rebrand scope from this file unless the user explicitly confirms it.

## Documentation and Marketing

These items do not affect runtime behavior and can be handled in a separate pass:

- `README.md`
- localized README files under `docs/`
- screenshots, demo GIFs, installation instructions, and user guides
- GitHub repository About, Topics, and Description
- release notes and changelog entries
- documentation asset paths that contain Halo branding

## Internal Code Names

These are intentionally not part of the first rebrand pass because changing them would create a large diff and increase merge risk:

- `window.halo`
- `HaloAPI`
- `HaloConfig`
- `HaloLogo`
- `halo:` IPC and DOM event prefixes
- CSS variables and classes such as `--halo-glow`, `.halo-breathe`, and `.halo-space-card`
- SDK package names such as `@hello-halo/agent-sdk`
- developer-only module, type, or directory names that contain `halo`

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

Handle these when validation exposes failures or when a dedicated cleanup pass is approved:

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
