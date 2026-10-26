# Meco 发布流程（Release Runbook）

本文档是 Meco 发布到 GitHub Releases 的唯一操作手册。上游同步流程见 `upstream-sync.md`。

## 1. 分支模型

```
dev          开发分支——所有代码与发布说明的唯一源头
  │  （git reset --hard dev + npm run rebrand）
  ▼
public       发布快照——每次从 dev 重建，永不增量更新；action 在此分支上触发
main         默认分支——仅承载 workflow 文件供 GitHub 注册（dispatch 时实际执行的是 public 上的副本）
archive/*    历史归档，只读
```

**为什么不能直接在 public 上开发**：public 是 rebrand 生成的 Meco 品牌树，任何直接提交都会在下次重建时被抹掉，且会污染"public 完全由脚本生成"这一不变式。开发只发生在 dev。

**为什么 workflow 和发布说明必须放在 dev**：它们是 public 重建后必须存活的文件。rebrand 是白名单制（只处理语言包、用户可见源文件清单、身份配置、品牌素材），不碰 `.github/` 与 `docs/release-notes/`——所以它们会原样跟随 dev 进入 public。

## 2. 发布前检查

- [ ] dev 上功能开发已完成并推送（`git push origin dev`）
- [ ] 发布说明已写入 dev：`docs/release-notes/<版本号>.md`
- [ ] 两个仓库工作区均干净（`git status --short` 无输出）
- [ ] `gh auth status` 正常

## 3. 发布说明格式（gate 硬性要求）

文件路径：`docs/release-notes/<版本号>.md`（版本号不带 `v` 前缀）。

- **双语**：先一整块英文，再一整块中文，中间用 `---` 分隔
- **不得出现**：上游项目名、Halo 字样、"基于某项目"之类的来源表述——这就是 Meco 自己的产品
- 功能清单可参考上游对应版本的 README 改写成 Meco 自有文案
- 必须包含下载表（列名与实际产物名一致）与源码构建步骤
- gate 在构建前校验该文件存在，缺失即失败，不会发出只有自动生成描述的发布

## 4. 发布流程

### 步骤 1：在 dev 完成开发并推送

```bash
git checkout dev
# ……开发、提交……
git push origin dev
```

### 步骤 2：写发布说明并提交到 dev

```bash
# 新建 docs/release-notes/1.0.1.md（格式见第 3 节）
git add docs/release-notes/1.0.1.md
git commit -m "docs: add release notes for 1.0.1"
git push origin dev
```

### 步骤 3：本地重建 public

```bash
git checkout public
git reset --hard dev          # 抹掉旧快照，完全对齐 dev
npm run rebrand               # 应用 Meco 品牌替换
git status --short            # 预期只有品牌替换产生的改动
```

### 步骤 4：提交快照并推送

```bash
git add -A
git commit -m "chore: generate Meco public snapshot from dev @ <dev-sha>"
git push origin public
```

### 步骤 5：触发发布

```bash
gh workflow run release.yml --ref public -f version=1.0.1
```

或在 GitHub Actions 页面 → Release → Run workflow → 输入版本号。

### 步骤 6：监控与验证

```bash
gh run watch <run-id> --exit-status --interval 60
gh release view v1.0.1 --json assets --jq '[.assets[].name]'
```

## 5. Gate 校验规则

触发后第一个 job（`gate`）在一切构建之前执行，任一不满足即中止：

| 校验 | 规则 |
|---|---|
| 版本格式 | `^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$`，允许带 `v` 前缀（自动剥离） |
| 发布说明 | `docs/release-notes/<版本号>.md` 必须在被检出的分支上存在 |

## 6. 构建矩阵

| Job | Runner | 命令要点 | 产物 |
|---|---|---|---|
| build-macos | macos-latest | prepare-binaries(mac-arm64) → build → electron-builder dmg+zip，ad-hoc 签名 | `Meco-<v>-arm64.dmg`、`Meco-<v>-arm64-mac.zip`（+blockmap） |
| build-windows | windows-latest | prepare-binaries(win) → build → electron-builder NSIS | `Meco-Setup-<v>.exe`、`latest.yml`（+blockmap） |
| build-linux | ubuntu-latest | prepare-binaries(linux) → build → electron-builder AppImage+deb，注入 maintainer | `Meco-<v>.AppImage`、`Meco-<v>-amd64.deb`、`latest-linux.yml` |
| build-android | ubuntu-latest | cap:sync → gradlew assembleDebug（JDK 21） | `Meco-<v>-android.apk` |
| github-release | ubuntu-latest | 下载全部产物 → `gh release create --notes-file` → `gh release upload --clobber` | Release |

**版本号机制**：构建期通过 `--config.extraMetadata.version` 注入，**不修改仓库里的 package.json**。产物文件名、`latest-*.yml` 自动更新元数据与 `v<version>` tag 三者由此保证一致。

**CI 特有的两处适配**（均在 workflow 内完成，不影响本地开发）：
- `npm install` 而非 `npm ci`（lock 文件与 package.json 存在不同步）
- 删除 `android/gradle.properties` 里提交的本机 `org.gradle.java.home`（上游自带的本机工件）

## 7. 幂等重跑

Release 已存在时，`github-release` job 不会重复创建，仅用 `--clobber` 覆盖上传产物。因此某个平台构建失败时，修好 workflow 后**重新触发同一个版本号**即可，已成功的平台会重跑并覆盖同名产物，无副作用。

## 8. 当前签名状态

| 平台 | 状态 | 用户侧影响 |
|---|---|---|
| macOS | ad-hoc 签名，未公证 | 首次打开需右键 → 打开，或 `xattr -cr` |
| Windows | 无证书签名 | SmartScreen 提示，需"仍要运行" |
| Linux | 未签名 | 无影响，AppImage 需 `chmod +x` |
| Android | debug 签名 | 需允许未知来源 |
| iOS | 不提供产物 | 发布说明中给出源码构建步骤 |

将来要正式签名：把证书配成 GitHub Secrets 后改 workflow 的构建参数即可，流程结构不变。

## 9. 常用命令速查

```bash
# 完整发布（步骤 3–5 合并）
git checkout public && git reset --hard dev && npm run rebrand \
  && git add -A && git commit -m "chore: generate Meco public snapshot from dev" \
  && git push origin public \
  && gh workflow run release.yml --ref public -f version=<版本号>

# 查看/监控
gh run list --workflow=release.yml --limit 1
gh run watch <run-id> --exit-status --interval 60
gh run view <run-id> --log-failed

# 只修正 release 说明（无需重新构建）
gh release edit v<版本号> --notes-file docs/release-notes/<版本号>.md

# 本地单平台构建对照（CI 之外的手动验证）
npm run build:mac      # macOS dmg + zip
npm run build:win      # Windows NSIS
npm run build:linux    # Linux AppImage + deb
npm run cap:sync && ./android/gradlew -p android assembleDebug
```
