#!/usr/bin/env node
/**
 * Rebrand script: whitelist-based Halo → Meco replacement.
 *
 * The whitelist mirrors the archived v1 rebrand result (commits e9b4f5a3 +
 * 1d587e96 + 5fe438f9): i18n locales (UI + notification text), the
 * user-visible source files that carried the product name, product identity
 * configs, and brand assets. Everything else — MD files, docs, tests beyond
 * the v1 pair, Go services, the Electron preload bridge, the agent SDK,
 * AI skill definitions — stays at upstream original, exactly as the v1
 * curated branch did.
 *
 * Usage:
 *   node scripts/rebrand.mjs                          # Apply rebrand
 *   node scripts/rebrand.mjs --check                  # Report current state
 *   node scripts/rebrand.mjs --dry-run                # Preview without writing
 *   node scripts/rebrand.mjs --reverse --scope <dir>  # Restore a scope
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const REBRAND_ASSETS_DIR = path.join(ROOT_DIR, 'resources', 'rebrand-assets')
const LOCALES_DIR = path.join(ROOT_DIR, 'src', 'renderer', 'i18n', 'locales')

// Brand replacement applied inside whitelisted files only
const BRAND_RULES = [
  // Repository org (product update/feed configs)
  { from: 'openkursar/hello-halo', to: 'LangInOS/heyoo-meco' },
  { from: '"owner": "openkursar"', to: '"owner": "LangInOS"' },
  { from: "owner: 'openkursar'", to: "owner: 'LangInOS'" },
  { from: 'hello-halo.cc', to: 'heyoo-meco.cc' },
  { from: 'hello-halo', to: 'heyoo-meco' },
  { from: 'HALO', to: 'MECO' },
  { from: 'Halo', to: 'Meco' },
  { from: 'halo', to: 'meco' }
]

// Inside whitelisted files, references to entities that keep their Halo names
// (the preload bridge, deep-link protocol, halo-named modules and data dir)
// stay halo — matching the v1 curated state
const PROTECT_RULES = [
  // Electron bridge keeps the preload-exposed halo name
  { from: "'meco' in window", to: "'halo' in window" },
  { from: 'window.meco', to: 'window.halo' },
  // Deep-link protocol stays halo:// end to end (v1 kept it original)
  { from: 'meco://', to: 'halo://' },
  // Data directory identity: the dev data dir stays ~/.halo-dev (v1 decision)
  { from: 'MECO_DATA_DIR', to: 'HALO_DATA_DIR' },
  { from: '.meco-dev', to: '.halo-dev' },
  // Modules and files that keep their Halo names on disk
  { from: 'meco-file-url', to: 'halo-file-url' },
  { from: 'mecoFileUrlToPath', to: 'haloFileUrlToPath' },
  { from: 'toMecoFileUrl', to: 'toHaloFileUrl' },
  { from: 'MECO_FILE_SCHEME', to: 'HALO_FILE_SCHEME' },
  { from: 'meco-file://', to: 'halo-file://' },
  { from: 'meco-local', to: 'halo-local' },
  { from: 'meco-sdk', to: 'halo-sdk' },
  { from: '@heyoo-meco/agent-sdk', to: '@hello-halo/agent-sdk' },
  { from: 'MecoLogo', to: 'HaloLogo' },
  { from: 'meco.adapter', to: 'halo.adapter' },
  // Android package declaration is bound to the com/halo/mobile directory path
  { from: 'package com.meco.mobile', to: 'package com.halo.mobile' }
]

// User-visible source files (proven scope of the v1 rebrand, mapped to the
// current tree; missing files are skipped)
const USER_VISIBLE_FILES = [
  'src/main/apps/conversation-mcp/index.ts',
  'src/main/apps/manager/seed.ts',
  'src/main/apps/runtime/dispatch-inbound.ts',
  'src/main/apps/runtime/im-auto-sync.ts',
  'src/main/apps/runtime/im-channels/wecom-bot-default-spec.ts',
  'src/main/apps/runtime/im-channels/wecom-bot.provider.ts',
  'src/main/foundation/product-config.ts',
  'src/main/http/server.ts',
  'src/main/http/invite-page.ts',
  'src/main/index.ts',
  'src/main/openai-compat-router/server/provider-adapters.ts',
  'src/main/platform/background/index.ts',
  'src/main/platform/background/tray.ts',
  'src/main/services/agent/capabilities.ts',
  'src/main/services/agent/codex/options.ts',
  'src/main/services/agent/codex/transport/server-request-handler.ts',
  'src/main/services/agent/system-prompt.ts',
  'src/main/services/ai-browser/index.ts',
  'src/main/services/ai-sources/providers/zhipu-coding-oauth.provider.ts',
  'src/main/services/health/recovery-manager/strategies.ts',
  'src/main/services/health/recovery-manager/ui.ts',
  'src/main/services/notification.service.ts',
  'src/main/services/notify-channels/email.ts',
  'src/main/services/notify-channels/webhook.ts',
  'src/main/services/onboarding.service.ts',
  'src/main/services/search.service.ts',
  'src/main/services/security-policy.ts',
  'src/main/services/space.service.ts',
  'src/main/store/publish/dispatchers/github-pr.ts',
  'android/app/src/main/java/com/halo/mobile/ForegroundServicePlugin.java',
  'android/app/src/main/java/com/halo/mobile/HaloForegroundService.java',
  'src/renderer/App.tsx',
  'src/renderer/api/transport.ts',
  'src/renderer/components/ErrorBoundary.tsx',
  'src/renderer/components/apps/AppInstallDialog.tsx',
  'src/renderer/components/chat/ChatView.tsx',
  'src/renderer/components/onboarding/onboardingData.ts',
  'src/renderer/components/pulse/PulseList.tsx',
  'src/renderer/components/settings/AboutSection.tsx',
  'src/renderer/components/settings/RecommendSection.tsx',
  'src/renderer/components/settings/RegistrySection.tsx',
  'src/renderer/components/settings/nav-config.ts',
  'src/renderer/components/setup/PreferencesStep.tsx',
  'src/renderer/components/setup/ServerConnect.tsx',
  'src/renderer/components/setup/SetupProviderConfig.tsx',
  'src/renderer/pages/SettingsPage.tsx',
  'src/renderer/pages/SetupPage.tsx',
  'src/renderer/pages/SplashPage.tsx',
  'src/renderer/stores/chat.store.ts',
  'tests/unit/apps/runtime/im-auto-sync.test.ts',
  'tests/unit/services/space.test.ts',
  'scripts/translate-i18n.mjs',
  'gateway/internal/invite/page.html'
]

// Identity configs: full brand replacement (identity-only files)
const IDENTITY_FULL_FILES = [
  'product.example.json',
  'product.pro.json',
  'server.product.json',
  'capacitor.config.ts',
  'src/renderer/index.html',
  'android/app/src/main/res/values/strings.xml',
  'ios/App/App/Info.plist',
  'resources/installer.nsh',
  'resources/README.txt'
]

// Identity configs with path-bound content: replace only the identity field
const IDENTITY_TARGETED_FILES = [
  {
    file: 'package.json',
    rules: [
      { from: '"name": "halo"', to: '"name": "heyoo-meco"' },
      { from: '"author": "Halo Team"', to: '"author": "Meco Team"' }
    ]
  },
  {
    file: 'android/app/build.gradle',
    rules: [{ from: 'applicationId "com.halo.mobile"', to: 'applicationId "com.meco.mobile"' }]
  },
  {
    file: 'ios/App/App.xcodeproj/project.pbxproj',
    rules: [
      { from: 'PRODUCT_BUNDLE_IDENTIFIER = com.halo.mobile', to: 'PRODUCT_BUNDLE_IDENTIFIER = com.meco.mobile' }
    ]
  }
]

// Reverse rules restore a scope (e.g. src/sdk/halo-sdk) to upstream original
const REVERSE_RULES = [
  { from: 'LangInOS/heyoo-meco', to: 'openkursar/hello-halo' },
  { from: '"owner": "LangInOS"', to: '"owner": "openkursar"' },
  { from: "owner: 'LangInOS'", to: "owner: 'openkursar'" },
  { from: 'heyoo-meco.cc', to: 'hello-halo.cc' },
  { from: 'heyoo-meco', to: 'hello-halo' },
  { from: 'MECO', to: 'HALO' },
  { from: 'Meco', to: 'Halo' },
  { from: 'meco', to: 'halo' }
]

const REVERSE_PROTECT_RULES = [{ from: '"name": "hello-halo"', to: '"name": "halo"' }]

const SCOPE_EXCLUDE_DIRS = ['node_modules', 'dist', 'out', '.git']

function applyRules(content, rules) {
  let result = content
  for (const { from, to } of rules) {
    result = result.split(from).join(to)
  }
  return result
}

/**
 * Per-file protect rules derived from the file's own original content: every
 * halo-form identifier (HaloFoo/haloFoo), kebab word (halo-xxx), event name
 * (halo:xxx) and SHOUTING_CASE constant (HALO_XXX) keeps its name, so replaced
 * and untouched files stay consistent across every coupling.
 */
function dynamicProtect(content) {
  const rules = []
  for (const ident of new Set(content.match(/[Hh]alo[A-Z]\w*/g) || [])) {
    const stem = ident.slice(4)
    rules.push({ from: (ident[0] === 'H' ? 'Meco' : 'meco') + stem, to: ident })
  }
  for (const word of new Set(content.match(/\bhalo-[a-z0-9-]+\b/g) || [])) {
    rules.push({ from: 'meco-' + word.slice(5), to: word })
  }
  for (const name of new Set(content.match(/\bhalo:[a-z0-9-]+\b/g) || [])) {
    rules.push({ from: 'meco:' + name.slice(5), to: name })
  }
  for (const constant of new Set(content.match(/\bHALO_[A-Z_]+\b/g) || [])) {
    rules.push({ from: 'MECO_' + constant.slice(5), to: constant })
  }
  return rules
}

function walkFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SCOPE_EXCLUDE_DIRS.includes(entry.name)) walkFiles(fullPath, files)
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }
  return files
}

/** Asset copies take every file — icons and splash images are binary */
function walkAllFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SCOPE_EXCLUDE_DIRS.includes(entry.name)) walkAllFiles(fullPath, files)
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }
  return files
}

function processFile(file, rules, dryRun) {
  const content = fs.readFileSync(file, 'utf-8')
  const updated = applyRules(content, rules)
  if (updated === content) return false
  if (!dryRun) fs.writeFileSync(file, updated, 'utf-8')
  console.log(`  ✓ ${path.relative(ROOT_DIR, file)}`)
  return true
}

function copyBrandAssets(dryRun) {
  if (!fs.existsSync(REBRAND_ASSETS_DIR)) return 0
  let copied = 0
  for (const src of walkAllFiles(REBRAND_ASSETS_DIR)) {
    if (path.basename(src) === 'README.txt') continue
    const target = path.join(ROOT_DIR, path.relative(REBRAND_ASSETS_DIR, src))
    if (dryRun) {
      console.log(`  ✓ ${path.relative(ROOT_DIR, target)} (asset)`)
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.copyFileSync(src, target)
    }
    copied++
  }
  return copied
}

function checkState() {
  const pkgPath = path.join(ROOT_DIR, 'product.example.json')
  try {
    const product = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    if (product.name === 'Meco') return 'meco'
    if (product.name === 'Halo') return 'halo'
  } catch {}
  return 'unknown'
}

function runRebrand(dryRun) {
  let changed = 0

  console.log('\n[1/5] i18n locale files (UI + notification text)\n')
  for (const file of walkFiles(LOCALES_DIR)) {
    if (processFile(file, BRAND_RULES, dryRun)) changed++
  }

  console.log('\n[2/5] user-visible source files (v1 whitelist)\n')
  for (const rel of USER_VISIBLE_FILES) {
    const file = path.join(ROOT_DIR, rel)
    if (!fs.existsSync(file)) continue
    const rules = [...BRAND_RULES, ...dynamicProtect(fs.readFileSync(file, 'utf-8')), ...PROTECT_RULES]
    if (processFile(file, rules, dryRun)) changed++
  }

  console.log('\n[3/5] identity configs (full replacement)\n')
  for (const rel of IDENTITY_FULL_FILES) {
    const file = path.join(ROOT_DIR, rel)
    if (fs.existsSync(file) && processFile(file, BRAND_RULES, dryRun)) changed++
  }

  console.log('\n[4/5] identity configs (targeted fields)\n')
  for (const { file, rules } of IDENTITY_TARGETED_FILES) {
    const fullPath = path.join(ROOT_DIR, file)
    if (fs.existsSync(fullPath) && processFile(fullPath, rules, dryRun)) changed++
  }

  console.log('\n[5/5] brand assets\n')
  changed += copyBrandAssets(dryRun)

  console.log(`\n${dryRun ? 'Would change' : 'Changed'} ${changed} file(s).`)
}

function runReverse(scope, dryRun) {
  const base = path.join(ROOT_DIR, scope)
  if (!fs.existsSync(base)) {
    console.error(`Scope does not exist: ${scope}`)
    process.exit(1)
  }
  const rules = [...REVERSE_RULES, ...REVERSE_PROTECT_RULES]
  let changed = 0
  for (const file of walkFiles(base)) {
    if (processFile(file, rules, dryRun)) changed++
  }
  console.log(`\n${dryRun ? 'Would restore' : 'Restored'} ${changed} file(s) in ${scope}.`)
}

function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  if (args.includes('--check')) {
    const state = checkState()
    console.log(`Current state: ${state}`)
    console.log(state === 'halo' ? '✓ Codebase is Halo (ready for rebrand)' : '✓ Codebase is Meco (ready for regeneration)')
    return
  }

  if (args.includes('--reverse')) {
    const scopeArg = args.find((arg) => arg.startsWith('--scope='))
    if (!scopeArg) {
      console.error('Reverse requires --scope=<relative-dir> (it only restores a scope to upstream original)')
      process.exit(1)
    }
    runReverse(scopeArg.split('=').slice(1).join('='), dryRun)
    return
  }

  runRebrand(dryRun)
}

main()
