# dsh-regview

[![CI](https://github.com/AExiaoliou/dsh-regview/actions/workflows/ci.yml/badge.svg)](https://github.com/AExiaoliou/dsh-regview/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

DeepSeek Harness Web Client 的**只读注册表查看器**。它在左侧栏增加一个「注册中心」入口，用一个面板集中展示当前运行页面里实际注册的：

| 分类 | 数据来源 | 注册方 |
|---|---|---|
| 资源协议 | `ctx.resources` 的 provider 表 | 内置提示 / 未公开（DSH 未提供 owner 元数据） |
| 右栏 Tab 类型 | `ctx.sidebarRightTabs.entries()` | 实现 id（DSH 约定的实现身份，通常为包名） |
| 会话视图 Tab | `ctx.slots.entries('conversation.view')` | Slot 条目的 `registrant`（fiber name） |
| 文档预览扩展 | `ctx.documentPreviews.getSnapshot()` | 从实现 id 的包前缀推断 |
| Web Client Slots | `ctx.slots.snapshot()` | Slot/Factory occupant 的 `registrant` |

「会话视图 Tab」就是截图里「对话 / 轨迹 / 上下文 / 编队」这一行的注册项。它们不是 `sidebarRightTabs`，而是 `conversation.view` list Slot 的条目；本面板把两套 tab 系统分开列出，避免混淆。

面板只读：不调用 `provider.open`，不修改任何注册表，不写 Session 或持久化数据。

## 结构

```text
dsh-regview/
├── packages/
│   ├── core/                  # @aexiaoliou/dsh-regview-core
│   │   └── 提供 ctx.regview 服务、全局面板、表格/树 UI、搜索/刷新/locale
│   ├── resources/             # @aexiaoliou/dsh-regview-resources
│   ├── sidebar-tabs/          # @aexiaoliou/dsh-regview-sidebar-tabs
│   ├── conversation-views/    # @aexiaoliou/dsh-regview-conversation-views
│   ├── document-previews/     # @aexiaoliou/dsh-regview-document-previews
│   └── slots/                 # @aexiaoliou/dsh-regview-slots
├── scripts/                   # 构建校验、profile 安装、Chrome 冒烟
└── cordis.patch.yml           # 开发 overlay（相对路径）
```

`@aexiaoliou/dsh-regview-core` 是基座插件：它提供浏览器侧 `ctx.regview` 服务，声明 5 个分类的公共 UI，并注册 `sidebar.panellist` 图标与 `main` 面板。5 个 feature 包各自通过 `ctx.regview.register(source)` 注册一个数据源；只安装其中一部分时，面板只显示已安装的分类。

每个包同时是独立的 DSH bundle（`dsh.bundle.patch`）和 client plugin（`dsh.client`），可以单独安装。

## 环境

- DeepSeek Harness `0.2.1-rc.2`（`engines.dsh: >=0.2.1-rc.2 <0.3.0`）
- Node.js `^22.19.0 || >=24.0.0`
- pnpm `11.28.5`
- 已有可运行的 `dsh web` profile（默认 `web`）

## 构建

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm verify
```

`pnpm build` 对每个包执行：

1. `tsc -p tsconfig.build.json`：`src` → `lib/types`（JS + 声明）。
2. `tsdown`：`lib/types/index.js` → `lib/index.js`；`lib/types/client/index.js` → `lib/client.js`。

浏览器产物是 Web Client 模块表要求的 lazy-CJS 形式：

```js
window.__ModuleLoader__.load({ id: '@aexiaoliou/dsh-regview-core', factory: (require) => { ... } })
```

`pnpm verify` 会检查每个包的 wrapper id、`lib/index.js`、声明文件、`exports["./client"]`，并确认浏览器 bundle 只 require 平台模块。

## 安装

### 方式一：写入当前运行 profile（推荐，可热更新）

```sh
node scripts/install-live.mjs --profile web
```

脚本会：

- 检查 6 个包的 `lib/index.js` / `lib/client.js` 是否存在；
- 在 `~/.dsh/profiles/web/cordis.patch.yml` 末尾追加一个带 marker 的 `- insert:` 块，使用**绝对文件路径**；
- 写前备份为 `cordis.patch.yml.bak-regview-<timestamp>`；
- 用 YAML 解析校验整份文件，失败则不写；
- 运行中的 profile 会监听该文件，Loader 重组后 HMR 把新 client row 推给页面。

已开着的页面若没有自动出现入口，刷新一次页面。

Dry run：

```sh
node scripts/install-live.mjs --profile web --dry-run
```

### 方式二：开发 overlay（另起端口）

```sh
cd /home/aexiaoliou/workspace/deepseek-harness
pnpm dsh web --patch /home/aexiaoliou/workspace/dsh-regview/cordis.patch.yml --port 3081 --no-open
```

根 `cordis.patch.yml` 使用相对路径 `./packages/*/lib/index.js`，适合本地调试；它不会改动 profile 文件。

### 方式三：作为正式 bundle 安装

```sh
cd /home/aexiaoliou/workspace/deepseek-harness
pnpm dsh plugin --profile web add \
  /home/aexiaoliou/workspace/dsh-regview/packages/core \
  /home/aexiaoliou/workspace/dsh-regview/packages/resources \
  /home/aexiaoliou/workspace/dsh-regview/packages/sidebar-tabs \
  /home/aexiaoliou/workspace/dsh-regview/packages/conversation-views \
  /home/aexiaoliou/workspace/dsh-regview/packages/document-previews \
  /home/aexiaoliou/workspace/dsh-regview/packages/slots
```

每个包声明了自己的 `dsh.bundle`，profile 会得到 6 个 bundle 层。修改源码后重新 `pnpm build`；client bundle 由 HMR 重新读取。

## 使用

1. 打开 Web GUI，左侧栏出现「注册中心」图标。
2. 点击后进入面板；顶部五个分类 tab：
   - **资源协议**：协议名、注册方提示、地址形态；展开可看 `provider.open` 类型、注册顺序、地址示例。
   - **右栏 Tab 类型**：kind、实现 id、优先级带、地址 patterns、Guide 条目数；展开可看 `multiple` / `keepMounted` / `canOpen` 与 Guide 标题。
   - **会话视图 Tab**：`conversation.view` 的 id、标题、order、registrant。
   - **文档预览扩展**：实现 id、推断 owner、扩展名、二进制后缀、优先级、加载模式、换行。
   - **Web Client Slots**：可折叠的 Slot/Factory 树，按层级缩进；每行显示 kind、scope、声明方、occupant 数，点「详情」展开 occupant 的 registrant/key/id/order/priority/active。支持「展开全部 / 折叠全部」，每 1.5 秒自动比对一次。
3. 搜索框对 id、所有单元格、details 做大小写不敏感过滤。
4. 「刷新」重新读取当前分类；Slots 自动轮询，其余分类在注册表自身通知或手动刷新时更新。
5. 窄屏（≤720px）下普通表格会自动切换为带字段标签的卡片行，避免列被挤压换行；分类 tab 可横向滚动。

## 注册方规则与已知限制

- **资源协议**：`ctx.resources` 的公开接口只有 `register/pin/source`，provider 不携带 owner 元数据。本插件读取运行时 `providers` Map 来枚举协议，内置 3 个协议显示编译期提示：
  - `file` → `@deepseek-ai/dsh-api-workspace-files`
  - `subagentchat` → `@deepseek-ai/dsh-client-ui-subagent`
  - `plan` → `@deepseek-ai/dsh-client-ui-plan`

  其他协议显示「未公开（DSH 未暴露）」。要获得精确归属，需要上游给 `ResourceProvider`/Registry 增加 owner 字段；本仓库不修改 DSH。
- **右栏 Tab 类型**：`entries()` 只返回当前生效实现；被 `extension` 覆盖的 builtin 不在公开 API 中，因此不列出。
- **文档预览 owner**：从实现 id 的最后一个 `/` 前缀推断（如 `@deepseek-ai/dsh-client-ui-sidebar-documentpreview/markdown`），不是 DSH 记录的独立字段。
- **Slots**：只列出运行时已声明的 Slot/Factory；未挂载的声明在运行时不存在，因此不是编译期 `SlotMap` 全量 catalog。
- **浏览器侧 client plugin 不接收 Loader row config**（DSH 的 client entry 只以包名创建），所以本插件没有部署配置项；用安装哪些 feature 包来控制分类。
- 写入 profile patch 是本地 checkout 方案，路径是绝对的；移动仓库后需重新运行安装脚本或改用正式 bundle 安装。
- 未实现 GitHub 直装所需的 `prepare` 自构建；请在仓库内构建后再安装。

## 开发命令

```sh
pnpm clean          # 删除各包 lib/
pnpm typecheck      # 所有包 tsc --noEmit
pnpm test           # vitest，包含 core 组件测试
pnpm build          # 所有包 tsc + tsdown
pnpm verify         # 构建产物契约校验
pnpm check          # typecheck + test + build + verify
pnpm print-patch    # 打印绝对路径安装块
pnpm install-live -- --profile web
pnpm uninstall-live -- --profile web
pnpm smoke -- --url http://127.0.0.1:3080
```

`pnpm smoke` 使用本机 `google-chrome --headless=new`、CDP 和 Node 内置 `WebSocket`：等待侧栏入口、点击、断言 5 个分类 tab，并输出 `artifacts/regview-panel.png`。

## 发布 npm 包

仓库包含 6 个可发布的 `@aexiaoliou/dsh-regview-*` 包，根目录只作为 pnpm workspace 容器。发布工作流位于 `.github/workflows/publish.yml`：

1. 在 npm 的每个包设置中添加 Trusted Publisher，Provider 选择 **GitHub Actions**，Repository 填 `AExiaoliou/dsh-regview`，Workflow filename 填 `.github/workflows/publish.yml`，不要填写 Environment。
2. 6 个包都要分别配置一次 Trusted Publisher；npm 目前按包保存信任关系。
3. 建议先在 Actions → Publish packages 中手动运行，保持 `dry_run=true`，确认每个 tarball 的内容。
4. 准备发布时创建并发布一个 GitHub Release；`release.published` 事件会自动运行正式发布。
5. 所有包的版本写在各自的 `packages/*/package.json`。发布新版本前请统一修改版本号并提交；同一个版本已经存在于 npm 的包会被自动跳过。

工作流会先安装 npm 11.15+，再运行 `pnpm check`，按包检查 npm 上是否已有对应版本，并以 `--access public --provenance` 发布。它使用 GitHub OIDC Trusted Publishing，不需要保存 `NPM_TOKEN`，也不需要勾选绕过 2FA 的 token 选项。

## 回滚

```sh
node scripts/uninstall-live.mjs --profile web
```

脚本只移除 marker 块，并保留时间戳备份。若使用 `dsh plugin add` 安装：

```sh
cd /home/aexiaoliou/workspace/deepseek-harness
pnpm dsh plugin --profile web remove @aexiaoliou/dsh-regview-core @aexiaoliou/dsh-regview-resources \
  @aexiaoliou/dsh-regview-sidebar-tabs @aexiaoliou/dsh-regview-conversation-views \
  @aexiaoliou/dsh-regview-document-previews @aexiaoliou/dsh-regview-slots
```

## 设计要点

- 分类数据只通过 `ctx.regview.register(RegViewSource)` 进入基座；feature 包不导入基座运行时，也不渲染 React。
- 基座在面板挂载时才订阅 source（demand-driven），卸载即解除；Slots 轮询不会在后台常驻。
- 所有 source 读取都有 try/catch，单个注册表失败只影响该分类。
- 源快照按 `JSON.stringify` 去重，只有内容变化才发布新 Map，避免无意义重渲染。
- CSS 全部使用 `--dsw-*` / `--ds-font-family-code` 设计 token；不引入组件库或 CSS 框架。
- 所有可见文案在 `zh` / `en` 字典中，`en` 以 `satisfies Record<keyof typeof zh, string>` 保证完整。

## 已验证

在从 `web` 模板创建的临时 profile 上，用 `google-chrome --headless=new` + CDP 实测（`pnpm smoke`）：

- 资源协议：3 项（`file` / `plan` / `subagentchat`，均显示内置 owner 提示）。
- 右侧边栏 Tab：8 项（含 `guide`、`subagentchat`、`changes-review` 等）。
- 会话视图：2 项（`chat`、`trajectory`；其他视图取决于当前 profile 安装了哪些插件）。
- 文档预览：8 项（text / markdown / html / image / pdf / office / excel / code）。
- Slot 组合：106 项（root 及各层子 Slot/Factory）。
- 截图：[`artifacts/regview-panel.png`](artifacts/regview-panel.png)；每个分类各一张：`regview-resources.png`、`regview-sidebar-tabs.png`、`regview-conversation-views.png`、`regview-document-previews.png`、`regview-slots.png`。

`pnpm check` 全绿：6 个包 typecheck、94 个测试、6 个 client bundle 契约校验。

窄屏 404px 的验证截图：`artifacts/regview-narrow-panel.png`、`regview-narrow-sidebar-tabs.png`、`regview-narrow-slots.png`。
