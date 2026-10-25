#!/usr/bin/env node
/**
 * Rebrand script v2: minimal user-visible Halo → Meco replacement.
 *
 * Scope follows the proven v1 curated rebrand — replace only what the user
 * sees, keep everything else at upstream original so no internal reference
 * can break:
 *   1. src/renderer/i18n/locales/*.json — UI and notification text
 *   2. src/renderer files containing brand words — UI layer; protect rules
 *      keep references to halo-named files/modules intact
 *   3. A fixed list of main-process files with user-visible strings (tray,
 *      notifications, IM templates, onboarding, system prompt, ...)
 *   4. Identity configs: product*.json, capacitor.config.ts, Android/iOS
 *      display identity, package.json name/author
 *   5. Brand assets copied from resources/rebrand-assets onto their original
 *      paths (app icons, tray, splash, renderer brand mark)
 *
 * The SDK (src/sdk), internal modules, tests, scripts and docs are never
 * touched.
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
const RENDERER_DIR = path.join(ROOT_DIR, 'src', 'renderer')

// Brand replacement applied inside user-visible files and locale files only
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

// Inside replaced files, references to entities that keep their Halo names on
// disk (files/directories are not renamed) must stay halo
const PROTECT_RULES = [
  { from: 'assets/brand/meco-mark-animated', to: 'assets/brand/halo-mark-animated' },
  { from: 'MecoLogo', to: 'HaloLogo' },
  { from: 'MecoForegroundService', to: 'HaloForegroundService' },
  { from: 'meco.adapter', to: 'halo.adapter' },
  { from: 'meco-file-url', to: 'halo-file-url' },
  { from: 'mecoFileUrlToPath', to: 'haloFileUrlToPath' },
  { from: 'toMecoFileUrl', to: 'toHaloFileUrl' },
  { from: 'MECO_FILE_SCHEME', to: 'HALO_FILE_SCHEME' },
  { from: 'meco-file://', to: 'halo-file://' },
  { from: 'meco-local', to: 'halo-local' },
  { from: 'meco-sdk', to: 'halo-sdk' },
  { from: '@heyoo-meco/agent-sdk', to: '@hello-halo/agent-sdk' }
]

// Main-process files with user-visible strings (proven scope of the v1 rebrand)
const MAIN_VISIBLE_FILES = [
  'src/main/apps/conversation-mcp/index.ts',
  'src/main/apps/manager/seed.ts',
  'src/main/apps/runtime/dispatch-inbound.ts',
  'src/main/apps/runtime/im-auto-sync.ts',
  'src/main/apps/runtime/im-channels/wecom-bot-default-spec.ts',
  'src/main/apps/runtime/im-channels/wecom-bot.provider.ts',
  'src/main/foundation/product-config.ts',
  'src/main/http/server.ts',
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
  'src/main/store/publish/dispatchers/github-pr.ts'
]

// Identity configs: full brand replacement (identity-only files, no path-bound content)
const IDENTITY_FULL_FILES = [
  'product.example.json',
  'product.pro.json',
  'server.product.json',
  'capacitor.config.ts',
  'src/renderer/index.html',
  'android/app/src/main/res/values/strings.xml',
  'ios/App/App/Info.plist'
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

const REVERSE_PROTECT_RULES = [
  { from: '"name": "hello-halo"', to: '"name": "halo"' }
]

const SCOPE_EXCLUDE_DIRS = ['node_modules', 'dist', 'out', '.git']
const TEXT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.html', '.css', '.scss', '.svg']

function applyRules(content, rules) {
  let result = content
  for (const { from, to } of rules) {
    result = result.split(from).join(to)
  }
  return result
}

/**
 * Per-file protect rules derived from the file's own original content: every
 * halo-form identifier, kebab word and SHOUTING_CASE constant keeps its name
 * after the brand pass, so exports defined in a replaced file stay resolvable
 * for consumers that are not replaced.
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
    } else if (entry.isFile() && TEXT_EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(fullPath)
    }
  }
  return files
}

/** Files under a directory whose content contains brand words */
function findBrandFiles(dir) {
  return walkFiles(dir).filter((file) => {
    const content = fs.readFileSync(file, 'utf-8')
    return /halo/i.test(content) && path.basename(file) !== 'halo-mark-animated.svg'
  })
}

function processFile(file, rules, dryRun, label) {
  const content = fs.readFileSync(file, 'utf-8')
  const updated = applyRules(content, rules)
  if (updated === content) return false
  if (!dryRun) fs.writeFileSync(file, updated, 'utf-8')
  console.log(`  ✓ ${label || path.relative(ROOT_DIR, file)}`)
  return true
}

function processFileWithRules(file, rules, dryRun) {
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
  for (const src of walkFiles(REBRAND_ASSETS_DIR)) {
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

  console.log('\n[2/5] renderer files containing brand words (UI layer)\n')
  for (const file of findBrandFiles(RENDERER_DIR)) {
    const rules = [...BRAND_RULES, ...dynamicProtect(fs.readFileSync(file, 'utf-8')), ...PROTECT_RULES]
    if (processFileWithRules(file, rules, dryRun)) changed++
  }

  console.log('\n[3/5] main-process user-visible files\n')
  for (const rel of MAIN_VISIBLE_FILES) {
    const file = path.join(ROOT_DIR, rel)
    if (!fs.existsSync(file)) continue
    const rules = [...BRAND_RULES, ...dynamicProtect(fs.readFileSync(file, 'utf-8')), ...PROTECT_RULES]
    if (processFileWithRules(file, rules, dryRun)) changed++
  }

  console.log('\n[4/5] identity configs\n')
  for (const rel of IDENTITY_FULL_FILES) {
    const file = path.join(ROOT_DIR, rel)
    if (fs.existsSync(file) && processFile(file, BRAND_RULES, dryRun)) changed++
  }
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
    if (processFile(file, rules, dryRun, path.relative(ROOT_DIR, file))) changed++
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
      console.error('v2 reverse requires --scope=<relative-dir> (it only restores a scope to upstream original)')
      process.exit(1)
    }
    runReverse(scopeArg.split('=').slice(1).join('='), dryRun)
    return
  }

  runRebrand(dryRun)
}

main()
