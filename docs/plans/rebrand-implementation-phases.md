# Rebrand Implementation Phases

**Created**: 2026-06-12
**Status**: Draft — phased implementation strategy for Halo → Meco rebrand

---

## 0. Strategy Overview

This document defines a **phased rebrand implementation strategy**:

- **Phase 1 (Current)**: Minimal user-visible rebrand, keep internal code names unchanged
- **Phase 2 (Future)**: Complete rebrand including file names, directory names, and all internal identifiers

The phased approach reduces merge conflict risk with upstream `hello-halo/dev` while allowing immediate user-visible brand transition.

---

## 1. Phase 1 — Current Implementation

### 1.1 Scope

Apply global string replacement for all user-visible and runtime-visible identifiers:

| Replacement | Scope |
|---|---|---|
| `Halo` → `Meco` | All files (user-facing strings, product names, display names) |
| `halo` → `meco` | All files (data folder names, CSS variables, IPC prefixes, internal identifiers) |
| `hello-halo` → `heyoo-meco` | package.json, product.json, updateConfig |

### 1.2 Explicit Non-Replacements (Phase 1)

The following are **NOT replaced** in Phase 1:

| Category | Items | Reason |
|---|---|---|
| **File names / Directory names** | `HaloLogo.tsx`, `com/halo/mobile/`, etc. | Requires file system operations, higher merge conflict risk |
| **SDK package name** | `@hello-halo/agent-sdk` | Independently published artifact, not controlled by this repo |
| **Java package declaration** | `package com.halo.mobile;` | Must match directory path; directory not moved in Phase 1 |

### 1.3 Android Special Handling

Android application identity is controlled by `applicationId`, not Java package:

| Field | Phase 1 Value | Notes |
|---|---|---|
| `applicationId` | `com.meco.mobile` | Changed — defines app identity on device |
| `namespace` | `com.halo.mobile` | Not changed — matches Java package path |
| Java `package` declaration | `com.halo.mobile` | Not changed — matches directory path |
| Directory path | `com/halo/mobile/` | Not moved |

Result: Meco app and Halo app are **two separate applications** on device, even though Java code internally still uses `com.halo.mobile`.

### 1.4 Phase 1 Rollback Rules

After global replacement, specific patterns are rolled back to maintain consistency with directory/file paths:

| Pattern | After Global Replace | Rollback Result | Reason |
|---|---|---|---|
| `package com.halo.mobile` | `package com.meco.mobile` | `package com.halo.mobile` | Must match directory path `com/halo/mobile/` |
| `namespace com.halo.mobile` | `namespace com.meco.mobile` | `namespace com.halo.mobile` | Must match Java package |
| `HaloForegroundService` | `MecoForegroundService` | `HaloForegroundService` | Must match file name `HaloForegroundService.java` |

These rollback rules ensure Android compilation succeeds in Phase 1 without directory/file moves.

### 1.5 Execution Method

**Script-based replacement**:

1. Before development/build: run replacement script → working tree shows Meco
2. Before commit: run reverse script → working tree shows Halo (matches upstream)
3. Build process: replacement script integrated into build pipeline

This allows:
- Development environment shows Meco (can verify rebrand effect)
- Repository code stays Halo (minimal merge conflict with upstream)
- Build artifacts show Meco (user-facing brand)

---

## 2. Phase 2 — Future Complete Rebrand

### 2.1 Scope

When Meco becomes fully independent from upstream `hello-halo/dev`, execute complete rebrand:

| Category | Items |
|---|---|---|
| **File names** | `HaloLogo.tsx` → `MecoLogo.tsx`, all files containing `Halo` in name |
| **Directory names** | `com/halo/mobile/` → `com/meco/mobile/`, all directories containing `halo` in path |
| **Java package** | `package com.halo.mobile;` → `package com.meco.mobile;` (after directory move) |
| **All remaining identifiers** | Any `halo` or `Halo` strings still present in codebase |

### 2.2 Execution Method

**Single script execution**:

The replacement script designed for Phase 1 already covers all string replacements. For Phase 2, add:

1. File/directory rename operations (before string replacement)
2. Java package declaration update (after directory move)
3. SDK package name update (if `@hello-halo/agent-sdk` is renamed or replaced)

### 2.3 Prerequisites for Phase 2

- Meco repository is fully independent (no longer syncing from `hello-halo/dev`)
- Or explicit decision to accept merge conflicts and resolve manually
- SDK package `@hello-halo/agent-sdk` is either renamed or Meco uses a different SDK

---

## 3. Replacement Script Design

### 3.1 String Replacements

```bash
# Global replacements (Phase 1 + Phase 2)
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \
  -o -name "*.json" -o -name "*.html" -o -name "*.css" -o -name "*.xml" \
  -o -name "*.java" -o -name "*.gradle" -o -name "*.plist" -o -name "*.md" \) \
  -exec sed -i '' \
    -e 's/hello-halo/heyoo-meco/g' \
    -e 's/Halo/Meco/g' \
    -e 's/halo/meco/g' \
    {} +
```

### 3.2 File/Directory Renames (Phase 2 only)

```bash
# Rename files containing Halo in name
find . -type f -name "*Halo*" -exec sh -c '
  for file; do
    newname=$(echo "$file" | sed "s/Halo/Meco/g")
    mv "$file" "$newname"
  done
' sh {} +

# Rename directories containing halo in path
find . -type d -path "*halo*" -exec sh -c '
  for dir; do
    newpath=$(echo "$dir" | sed "s/halo/meco/g")
    mv "$dir" "$newpath"
  done
' sh {} +
```

### 3.3 Reverse Script

Same operations with reversed replacement strings:
- `heyoo-meco` → `hello-halo`
- `Meco` → `Halo`
- `meco` → `halo`
- File/directory names reversed

---

## 4. Integration Points

### 4.1 Development Workflow

| Command | Behavior |
|---|---|---|
| `npm run dev` | Run replacement script → start electron-vite dev server |
| `npm run build` | Run replacement script → build → (optional) reverse for commit |
| `npm run cap:sync` | Run replacement script → Capacitor sync |
| iOS build (Xcode) | Build Phase script runs replacement before compile |
| Android build (Gradle) | Gradle task runs replacement before compile |

### 4.2 Commit Workflow

```bash
# After development, before commit
npm run rebrand:reverse  # Reverse script
git status               # Verify working tree shows Halo
git add .
git commit -m "..."
```

---

## 5. File Modification Restrictions

**Important**: Files modified by the replacement script should not be directly edited in the Meco repository, because reverse script will overwrite changes.

| Restricted Files | Reason |
|---|---|---|
| `product.json`, `product.example.json`, `product.pro.json` | Rebrand script modifies these |
| `package.json` | Rebrand script modifies these |
| `globals.css`, `tailwind.config.cjs` | Rebrand script modifies CSS variables |
| `strings.xml`, `build.gradle`, `Info.plist`, `capacitor.config.ts` | Rebrand script modifies these |
| Any file containing `halo` or `Halo` strings | Rebrand script modifies these |

**Recommended workflow**:
- Make changes in upstream `hello-halo` repository
- Sync changes to `heyoo-meco` via upstream-sync workflow
- Rebrand script will apply replacements automatically

---

## 6. Status Tracking

| Phase | Status | Notes |
|---|---|---|
| Phase 1 script implementation | ✅ Done | `scripts/rebrand.mjs` created |
| Phase 1 integration (npm run dev, build) | ✅ Done | package.json scripts updated |
| Phase 1 verification | Pending | Run `npm run dev` to verify Meco appears |
| Phase 2 execution | Future | After Meco becomes fully independent |

---

## 7. Usage

### 7.1 Available Commands

| Command | Description |
|---|---|---|
| `npm run rebrand` | Apply rebrand (Halo → Meco) |
| `npm run rebrand:reverse` | Reverse rebrand (Meco → Halo) |
| `npm run rebrand:check` | Check current state (Halo or Meco) |
| `npm run rebrand:auto` | Auto-apply if needed (used by dev/build) |
| `npm run rebrand:dry-run` | Preview changes without modifying files |

### 7.2 Development Workflow

```bash
# Start development (auto-applies rebrand if needed)
npm run dev

# Development environment shows Meco
# ... make changes ...

# Before commit, reverse to Halo
npm run rebrand:reverse

# Verify working tree shows Halo
git status

# Commit
git add .
git commit -m "..."
```

### 7.3 Build Workflow

```bash
# Build (auto-applies rebrand)
npm run build

# Build artifacts show Meco
# ... test build ...

# Before commit, reverse to Halo
npm run rebrand:reverse
git add .
git commit -m "..."
```

### 7.4 Mobile Build Workflow

```bash
# Build mobile (auto-applies rebrand)
npm run cap:sync

# Build Android/iOS apps
npm run cap:run:android
npm run cap:run:ios

# Before commit, reverse to Halo
npm run rebrand:reverse
git add .
git commit -m "..."
```

### 7.5 Check Current State

```bash
npm run rebrand:check
# Output: "Current state: halo" or "Current state: meco"
```