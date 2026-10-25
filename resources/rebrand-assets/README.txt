Meco brand assets for public snapshot generation.

Layout mirrors repository-relative paths: a file stored here at
android/app/src/main/res/... is copied to android/app/src/main/res/...
by scripts/rebrand.mjs during public generation (forward direction only).

Sources:
- android/, ios/ and most of resources/ come from the v1 rebrand work
  (archive/refactor/rebrand-to-meco, commit 5fe438f9).
- resources/icon-1024.png, resources/icon-macos-1024.png,
  resources/icon-macos.svg, resources/tray/tray-color*.png were generated
  from the master logo at resources/meco-logo.png; the macOS variant uses
  the upstream 824-tile grid with a drop shadow.
- resources/tray/tray-win-black.ico and tray-win-white.ico are derived
  from the Meco trayTemplate glyph (monochrome approximation).

After a logo change, regenerate the derived files with ImageMagick and
update this directory; the rebrand script copies everything here verbatim
and never text-replaces this directory (see EXCLUDE_DIRS).
- src/renderer/assets/brand/halo-mark-animated.svg: the renderer brand mark, generated
  from resources/meco-logo.png (static wrap of the master logo; the upstream
  animated Halo mark has no Meco counterpart yet).
