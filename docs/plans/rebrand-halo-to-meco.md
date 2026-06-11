# Dev Branch Rebranding Plan — Halo → Meco

**Created**: 2026-06-10
**Status**: Ready — standalone repository initialized at `https://github.com/LangInOS/heyoo-meco`; apply this plan on `${HOME}/repos/source/heyoo-meco` `main`.

---

## 0. Naming Summary (locked 2026-06-10)

| Layer | Old | New |
|---|---|---|
| Display name (user-facing) | Halo | **Meco** |
| Repo / npm package name | hello-halo | **heyoo-meco** |
| Data folder (prod) | `~/.halo/` | `~/.meco/` |
| Data folder (dev) | `~/.halo-dev/` | `~/.meco-dev/` |
| Desktop Bundle ID | `com.halo.app` | `com.meco.app` |
| Mobile Bundle ID | `com.halo.mobile` | `com.meco.mobile` |
| Repository description | 7×24 Desktop AI Agent for Everyone. Visual AI assistant with remote access, file management, and built-in AI browser. | **Meco is an always-on, multi-device AI workspace companion for everyday digital life — run it on desktop, control it from mobile, and stay connected anywhere with remote access, file workflows, AI browser automation, and persistent workspace memory.** |
| Logo design direction | ring + blue glow | **Meco wordmark** (ChatGPT-generated, owner-approved) |

> The "heyoo-" prefix is internet-native casual greeting (IM / TikTok / Snapchat culture). It carries the "digital life voicing" theme. The product name `Meco` is the user-facing brand; the repo name is internal/source-code identification.

---

## 1. Brand Decision

| Aspect | Old (`Halo`) | New (`Meco`) | Notes |
|---|---|---|---|
| Display name (user-facing) | Halo | Meco | Reads as "Meh-co" — same difficulty tier as Halo |
| Project / repo name (developer-facing) | hello-halo | heyoo-meco | Keeps the `greeting-product` repo naming formula; `heyoo` is the internet-native, social-platform-rooted casual greeting (IM/TikTok/Snapchat) |
| Reasoning (display) | — | mesh + eco coined word | Nodes = compute, mesh = physics, growth = biology |
| Tone continuity | — | 4 letters, double vowel pair, zero consonant cluster | Matches Halo's phonetics without copying |
| Concurrence check | — | clean across npm / PyPI / Crates / CocoaPods | No major collision found |
| Logo motif | ring / glow | node mesh / grid growth | Avoids Halo's existing iconography |

### 1.1 Repository description

Recommended GitHub repository description:

> Meco is an always-on, multi-device AI workspace companion for everyday digital life — run it on desktop, control it from mobile, and stay connected anywhere with remote access, file workflows, AI browser automation, and persistent workspace memory.

Short alternative if the platform needs a tighter description:

> Always-on multi-device AI workspace companion with mobile remote control, remote access, file workflows, AI browser automation, and persistent workspace memory.

### 1.2 Name split convention (industry standard)

Two distinct identifiers are used throughout this plan:

| Location | Use | Example |
|---|---|---|
| `package.json#name` | repo / npm package name | `heyoo-meco` |
| `package.json#build.productName` | packaged `.app` / `.exe` filename | `Meco` |
| `product.json#name` | in-app product name read at runtime | `Meco` |
| `product.json#dataFolderName` | user data directory | `meco` |
| Desktop Bundle ID | OS-unique identifier | `com.meco.app` |
| Mobile Bundle ID | OS-unique identifier | `com.meco.mobile` |
| Capacitor `appName` | mobile launcher label | `Meco` |
| GitHub repo | source hosting | `LangInOS/heyoo-meco` |
| `strings.xml#app_name` | Android launcher label | `Meco` |

---

## 2. Workflow Gate

The standalone repository setup is complete. Rebranding should now happen in the new repository, not in the original `hello-halo` working tree.

```
1. Work in ${HOME}/repos/source/heyoo-meco on main
2. origin points to https://github.com/LangInOS/heyoo-meco.git
3. upstream points to ${HOME}/repos/source/hello-halo with push disabled
4. upstream-dev tracks the original hello-halo dev branch for future syncs
5. Original hello-halo repo keeps "Halo" branding
```

---

## 3. File-by-file Diff Plan

All edits below are mechanical string replacements. No logic change, no new dependency, no schema migration. After applying, no test or runtime behavior should differ from main.

### Phase 1 — Core product config (8 changes)

| # | File | Field / Location | Old | New |
|---|---|---|---|---|
| 1 | `package.json` | `build.appId` | `com.halo.app` | `com.meco.app` |
| 2 | `package.json` | `build.productName` | `Halo` | `Meco` |
| 3 | `product.example.json` | `name` | `Halo` | `Meco` |
| 4 | `product.example.json` | `dataFolderName` | `halo` | `meco` |
| 5 | `product.pro.json` | `name` | `Halo` | `Meco` |
| 6 | `product.pro.json` | `dataFolderName` | `halo` | `meco` |
| 7 | `src/main/services/ai-sources/auth-loader.ts` | `getDefaultProductConfig().name` | `Halo` | `Meco` |
| 7b | `src/main/services/config.service.ts` | dev-mode hardcoded dir (line ~603) | `'.halo-dev'` | `'.meco-dev'` |

### Phase 2 — Desktop (Electron) user-visible strings (6 changes)

| # | File | Field / Location | Old | New |
|---|---|---|---|---|
| 8 | `src/main/index.ts` | `setAppUserModelId(...)` arg | `'com.halo.app'` | `'com.meco.app'` |
| 9 | `src/renderer/index.html` | `<title>` element | `Halo - AI that gets things done` | `Meco - AI that gets things done` |
| 10 | `src/main/platform/background/tray.ts` | `tray.setToolTip(...)` arg | `'Halo'` | `'Meco'` |
| 11 | `src/main/index.ts` | log path comment | `~/Library/Logs/Halo/` | `~/Library/Logs/Meco/` |
| 12 | `resources/README.txt` | full file | All `Halo` instances | `Meco` |
| 13 | `package.json` | top-level `name` (npm) | `halo` | `heyoo-meco` (optional — see §4) |

### Phase 3 — Android (5 changes + 1 directory move)

| # | File | Field / Location | Old | New |
|---|---|---|---|---|
| 14 | `android/app/src/main/res/values/strings.xml` | `app_name` | `Halo` | `Meco` |
| 15 | `android/app/src/main/res/values/strings.xml` | `title_activity_main` | `Halo` | `Meco` |
| 16 | `android/app/src/main/res/values/strings.xml` | `package_name`, `custom_url_scheme` | `com.halo.mobile` | `com.meco.mobile` |
| 17 | `android/app/build.gradle` | `namespace` | `com.halo.mobile` | `com.meco.mobile` |
| 18 | `android/app/build.gradle` | `applicationId` | `com.halo.mobile` | `com.meco.mobile` |
| 19 | `android/app/src/main/java/com/halo/mobile/` | **3 Java files + whole directory tree** | `com/halo/mobile/*.java` with `package com.halo.mobile;` | Move to `com/meco/mobile/*.java` with `package com.meco.mobile;` |

Affected files: `MainActivity.java`, `HaloForegroundService.java`, `ForegroundServicePlugin.java`.

### Phase 4 — iOS / Capacitor (4 changes)

| # | File | Field / Location | Old | New |
|---|---|---|---|---|
| 20 | `ios/App/App/Info.plist` | `CFBundleDisplayName` | `Halo` | `Meco` |
| 21 | `capacitor.config.ts` | `appName` | `'Halo'` | `'Meco'` |
| 22 | `capacitor.config.ts` | `appId` | `'com.halo.mobile'` | `'com.meco.mobile'` |
| 23 | `ios/App/App.xcodeproj/project.pbxproj` | `PRODUCT_BUNDLE_IDENTIFIER` (Debug + Release configs) | `com.halo.mobile` | `com.meco.mobile` |

### Phase 5 — Logo assets (1 file + 1 script run)

| # | File / Action | Operation |
|---|---|---|
| 24 | `resources/icon.svg` | Replace source SVG with new Meco design (node mesh) |
| 25 | `bash scripts/generate-icons.sh` (a.k.a. `npm run icons`) | Auto-regenerate all derived icons |

The script regenerates the following — **no manual edits needed**:
- `resources/icon.png` / `resources/icon.ico` / `resources/icon.icns`
- `resources/icon.iconset/` (13 PNGs)
- `resources/linux/` (9 PNGs)
- `resources/tray/` (6 PNGs — note: macOS template images need binarized alpha)
- `android/app/src/main/res/mipmap-*/` (5 densities × `ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png`)
- `android/app/src/main/res/drawable*/splash.png` (10 files)
- `ios/.../AppIcon.appiconset/`, `Splash.imageset/`

---

## 4. Open Decisions (resolve before execution)

### Decision A — `package.json` top-level `name` (npm package name)

| Option | Implication |
|---|---|
| Change to `heyoo-meco` | Keeps the `greeting-product` repo naming formula. `heyoo` is internet-native, signaling the "digital life voicing" theme. |
| Keep as `hello-halo` | Faster diff, smaller blast radius. Display name (`productName`) is still `Meco` for end users. |

Recommendation: **Change to `heyoo-meco`** — owner confirmed 2026-06-10.

### Decision B — Logo source

| Option | Implication |
|---|---|
| **ChatGPT-generated Meco wordmark (owner-provided, 2026-06-10)** | Owner produced a "Meco" wordmark concept (image in `docs/assets/rebrand-halo-to-meco/1781146901186.png`). Captures digital-life visual: modern, anthropomorphic, character-based. |
| New SVG produced in-house | More control over gradient and animation states. |
| Reuse existing Halo SVG | No design work, but defeats rebrand. |

Recommendation: **Use the ChatGPT-generated Meco wordmark as the design direction** — convert it to `resources/icon.svg`, then run `bash scripts/generate-icons.sh` to regenerate all derived assets. Keep the original SVG file as `resources/logo-candidate-3-wordmark.svg` for the design record.

### Decision B.1 — Logo motif constraints (carry over from owner feedback)

| Constraint | Reason |
|---|---|
| No rings / halos / light rays / stars / AI eyes / concentric circles | Owner explicitly excluded halo/glow iconography when discussing brand direction. |
| Wordmark-led (not abstract symbol) | Owner's reference is type-first; the "Meco" letters carry the brand. |
| Digital-life visual cues | Subtle life signals (pulse, breath, growth) — never loud. |
| Color palette: `#86efac` (life-green) → `#22d3ee` (cyan) → `#3b82f6` (blue), on `#0d1421 → #05080f` background | Maintains continuity with current Halo dark-blue palette; no orange/pink "chat app" drift. |

---

## 5. Explicit Non-Goals (do NOT change)

Per the "minimum changes that the user sees" rule, the following stay as-is:

| Category | Files / Patterns |
|---|---|
| CSS variable / class names | `globals.css` (`--halo-glow`, `.halo-breathe`, `.halo-space-card`), `tailwind.config.cjs` (`halo-glow` etc.) |
| Brand component internals | `src/renderer/components/brand/HaloLogo.tsx` — inlined SVG animation; only PNG asset changes |
| Original upstream repository | `${HOME}/repos/source/hello-halo` / `upstream-dev` — sync source, not product identity |
| SDK package name | `@hello-halo/agent-sdk` — independently published artifact |
| i18n locale JSONs | Do not contain the literal `Halo`; auto-generated by `npm run i18n` |
| Documentation READMEs | `README.md`, `docs/README.*.md` — separate PR |
| Source comments containing "Halo" | `src/main/index.ts:1` etc. — invisible to end users |

If any of these need to flip later (e.g. marketing wants the README updated), do it in a follow-up PR after this rebrand lands.

---

## 6. Execution Order

1. Work in `${HOME}/repos/source/heyoo-meco` on `main`.
2. Confirm Decision A and Decision B remain locked.
3. Apply Phase 1 (lowest risk) — verify `npm run build` still succeeds.
4. Apply Phase 2 — verify Electron app launches and tray/title show `Meco`.
5. Apply Phase 3 — verify `npm run cap:open:android` shows new applicationId and label.
6. Apply Phase 4 — verify `npm run cap:open:ios` shows new bundle id and display name.
7. Apply Phase 5 — run `npm run icons`, then visually inspect at least: macOS `.icns` (Finder), Windows `.ico` (Explorer), Android launcher (Pixel emulator), iOS home screen (Simulator).
8. Final sanity: `grep -r "Halo" resources/ src/renderer/ src/main/index.ts android/ ios/ capacitor.config.ts package.json product.*.json` should return zero matches in the user-visible scope.
9. Run `npm run test:unit` to catch any string-based assertion failures.
10. Commit with a single rebinding commit, e.g. `chore: rebrand Halo → Meco` (do not split).

---

## 7. Risk & Migration Notes

- **Existing users on `Halo` build**: After this rebrand ships, the app appears as a *new* application in OS launchers because the Bundle ID changed. Their data in `~/.halo/` becomes orphaned (still readable, but the new app reads from `~/.meco/`). For dev branch this is acceptable; for a production rebrand, write a one-time migration in `config.service.ts` that detects `~/.halo/config.json` and copies it to `~/.meco/config.json` on first run.
- **GitHub releases / auto-update**: `app-update.yml` (when added) and `product.json#updateConfig` point at the new repo if/when the fork publishes releases independently.
- **Code signing / notarization**: macOS code signing identity is tied to the Team ID, not the Bundle ID, so signing continues to work. Android keystore stays valid; only `applicationId` flips.
- **iOS App Store Connect**: A new Bundle ID requires a new App Store entry. Not relevant for dev branch.
- **macOS Gatekeeper**: A new Bundle ID means a fresh `quarantine` flag — first launch needs right-click → Open once.
