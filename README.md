# dsh-tab

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）会话区加一排书页式会话标签页：一个会话一个标签，切换不刷新页面，可以固定、关闭、归档、拖拽排序；同一工作区的多个标签会自动聚合成一个 Chrome 风格标签组，点击标签也不会挤动其他标签的位置。

Browser-style conversation tabs for DeepSeek Harness (DSH): one tab per conversation, Chrome-style workspace tab groups with collapse, drag reorder, pin / close / archive — and selecting a tab never shifts the others. Built on official DSH slots, services and theme tokens.

[![npm](https://img.shields.io/npm/v/dsh-tab.svg?color=cb3837)](https://www.npmjs.com/package/dsh-tab)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/imchangchang/dsh-tab/blob/main/LICENSE)
[![DSH](https://img.shields.io/badge/DSH-0.2.1--rc.5-4d93f8.svg)](#兼容性)
[![Platform](https://img.shields.io/badge/platform-web%20%7C%20desktop-6b7280.svg)](#兼容性)

npm 包名：**`dsh-tab`**。

![标签栏特写](https://cdn.jsdelivr.net/gh/imchangchang/dsh-tab@d7b3ced/docs/images/bar-closeup.png)

## 功能

- **一个会话一个标签页**：打开、恢复已有会话时自动入签；全新的空白会话在有输入内容后才入签。点击标签走官方 `uiWorkspace.openSession`，不刷新页面。当前会话的标签和下面的会话页连成一张纸，形成「书页」效果。
- **顶部和左侧可同时显示**：在插件详情中独立开关。左侧标签紧凑排列在原生工作区树上方，共用顶部的标签和排序，随侧栏收起。
- **工作区角标**：未参与分组的标签显示彩色工作区角标。左侧角标直接显示完整工作区名，较长时换行。顶部角标随标签宽度截断。
- **工作区标签组（Chrome 风格）**：同一工作区有 2 个以上未固定会话标签时聚合为一组，彩色组头可折叠。折叠后只留组头、标签数量和活动点。顶部和左侧分别保存分组折叠状态。固定标签、面板标签不参与聚合，拖拽只在同一组内排序。
- **新建会话**：`+` 在最后一个标签右侧；标签多到放不下时，可用横向滚动条或直接滚动鼠标滚轮，`+` 始终可见。
- **侧栏页面也是标签页**：点侧栏的「插件」「自动化任务」等全局面板时，会新增（或切换到已存在的）对应标签，不再顶掉当前会话标签；点回会话标签就收起面板、回到会话。面板标签同样可以关闭、固定、拖拽排序和持久化，面板卸载后标签自动移除。
- **固定 / 取消固定**：固定标签在顶部排最左，在左侧排最上，和普通标签之间有分隔线。
- **拖拽排序**：按显示方向拖动标签，落点有强调色标记。固定标签和普通标签各自在自己的分组内排序，顺序存 `localStorage`，刷新保持。`Esc` 或窗口失焦取消本次拖拽。
- **右键菜单**：关闭标签页 / 关闭右侧 / 关闭其他 / 关闭全部 / 固定（取消固定）/ 归档会话。归档走官方 `uiWorkspace.archiveSession`，会话正在运行或等待回复时先确认「停止并归档」。
- **状态点**：蓝色呼吸点 = 正在运行，黄色 = 等你回复，绿色 = 有新的完成内容。
- **键盘**：标签获得焦点时，顶部用 `←` / `→`，左侧用 `↑` / `↓` 切换相邻标签。右键菜单里用 `Esc` 关闭。
- **点击不位移**：点击标签不会改变任何标签的宽度或高度，也不会挤动左右位置；「被拿到前面」只靠白底、描边和很淡的投影表达，会话内容立即切换。
- **浅色 / 深色**：全部颜色走 `--dsw-alias-*` token，自动跟随主题。

## 截图

下面四张截图全部用模拟数据生成（左侧栏、工作区、会话标题都是虚构的），原始页面在 [`docs/mock/demo.html`](https://github.com/imchangchang/dsh-tab/blob/main/docs/mock/demo.html)，可以本地打开或跑 `npm run docs:mock` 重新生成。

浅色主题：

![浅色主题](https://cdn.jsdelivr.net/gh/imchangchang/dsh-tab@d7b3ced/docs/images/tabs-light.png)

深色主题：

![深色主题](https://cdn.jsdelivr.net/gh/imchangchang/dsh-tab@d7b3ced/docs/images/tabs-dark.png)

工作区标签组折叠后（只剩组头胶囊、数量和活动点）：

![工作区标签组折叠](https://cdn.jsdelivr.net/gh/imchangchang/dsh-tab@d7b3ced/docs/images/group-collapsed.png)

右键菜单（固定标签、关闭、归档）：

![右键菜单](https://cdn.jsdelivr.net/gh/imchangchang/dsh-tab@d7b3ced/docs/images/context-menu.png)

## 安装

要求：DSH 桌面版或 Web GUI，0.2.1-rc.5 附近版本（用法见「兼容性」）。

**从 npm 安装（推荐）**：让 Agent 执行

```
plugin_manager install_bundle target=dsh-tab
```

或先本地下载包再安装：

```bash
npm pack dsh-tab          # 或在 npmjs.com/package/dsh-tab 下载 tgz
```

安装后刷新窗口（macOS 上 `Cmd+R`）生效。

**从源码安装**：

```bash
git clone https://github.com/imchangchang/dsh-tab.git
```

然后在 DSH 里把仓库目录作为本地插件安装：设置 → 插件 → 添加插件，选择 `dsh-tab` 目录；或让 Agent 执行 `plugin_manager install_bundle target=<dsh-tab 的绝对路径>`。

插件没有构建步骤，`client.js` 由 DSH 直接加载；安装/升级后在设置里确认依赖版本是刚发布的版本。

## 使用

| 操作 | 方式 |
| --- | --- |
| 切换会话 | 左键点击标签页 |
| 关闭标签页 | 标签页上的 `×` / 鼠标中键 / 右键菜单 |
| 新建会话 | 最后一个标签右侧的 `+` |
| 打开侧栏页面 | 点侧栏的「插件」「自动化任务」等，自动新增/切换对应标签页 |
| 折叠 / 展开工作区标签组 | 点组头的彩色胶囊 |
| 关闭项目的所有标签页 | 中键点击顶部或左侧的项目组头，或从组头右键菜单选择，包含项目的固定标签。左侧工作区角标的右键菜单也提供此操作 |
| 调整顺序 | 按住标签左右拖拽（同组内） |
| 固定 / 取消固定 | 右键菜单 → 固定标签页 / 取消固定标签页 |
| 关闭一批 | 右键菜单 → 关闭右侧 / 关闭其他 / 关闭全部 |
| 归档会话 | 右键菜单 → 归档会话（运行中会先确认是否停止） |
| 键盘切换 | 标签聚焦时 `←` / `→` |

关闭最后一个标签后的行为和草稿标签的去留，可在「插件 → dsh-tab」里设置。详见[标签与草稿](manual/tabs.md)。

## 工作原理

插件分两半：

| 部分 | 文件 | 说明 |
| --- | --- | --- |
| 宿主半 | `index.js` | 空 `apply()`，只负责让 DSH 认识这个包 |
| 浏览器半 | `client.js` | 标签栏、右键菜单、拖拽、帧布局样式、`localStorage` 持久化 |

浏览器半用到的官方扩展点：

| 扩展点 | 用途 |
| --- | --- |
| `shell.overlay` 座位 | 标签栏放在会话列顶部，绝对定位、横跨「会话列 + 右侧产物栏」 |
| 帧布局样式 | 显示顶部标签时为它留出 44px，左侧标签挂载在 `sidebar.workspaces` 标记前，沿用原生侧栏宽度和抽屉 |
| `plugins.bundle.config` 座位 | 标签显示位置和会话行为，复用原生设置表单和开关 |
| `ctx.uiWorkspace.openSession / startSession / archiveSession` | 切换、新建、归档会话 |
| `ctx.sessions.list` | 读当前会话（`retainedBy.mainView > 0`）与会话状态 |
| `useWorkspaces` | 取工作区标题与会话归属，生成角标并按工作区聚合标签组 |
| `ctx.slots.inject('shell.overlay', …)` | 注册 React 组件，标准 props 直接可用 |
| `ctx.locale.register / bind` | 中英文文案 |
| 主题 token | `--dsw-alias-*`，浅色 / 深色自动跟随 |

标签顺序、固定状态、含草稿的标签 ID 与设置保存在浏览器 `localStorage` 的 `dsh.tab.view.v2` 里。旧键 `dsh.tab.openSessions.v1` 会自动迁移。草稿内容由 DSH 保存。

## 兼容性

- 开发和验证环境：DSH 桌面版 **0.2.1-rc.5**（macOS），Web GUI 同版本。
- 双栏布局、原生设置表单、横向滚动及草稿行为在 DSH Web **0.2.3-alpha.2** 验证。
- 帧布局依赖 DSH 原生帧和工作区座位的标记。原生侧栏展开且无法定位工作区座位时，会在顶部显示标签。
- 插件使用官方座位、服务和主题 token。左侧标签使用插件自己的容器，原生工作区树由 DSH 渲染。

## 数据与隐私

- 标签顺序、固定状态只存在浏览器 `localStorage`，不上传，不发网络请求。
- 不收集会话内容；工作区角标只读官方工作区标题。
- 关闭标签页不等于删除会话；归档会话走官方归档接口，可在官方归档列表中恢复。

## 开发

不需要构建：

```bash
npm run check      # node --check 语法检查
npm run docs:mock  # 从 client.js 的 CSS 生成 docs/mock/demo.html（模拟数据截图页）
npm pack --dry-run # 查看要发布到 npm 的文件
```

本地开发时把仓库目录 link 到 DSH profile 的依赖里（或直接用「安装」里的步骤），改 `client.js` 后 HMR 会应用浏览器半，刷新窗口生效。

目录：

```
client.js             浏览器半：标签栏 / 菜单 / 拖拽 / 帧布局样式 / 持久化
index.js              宿主半（空 apply）
cordis.patch.yml      bundle patch：插入一个 loader 行
locale/zh.json        插件元数据（中文）
locale/en.json        插件元数据（英文）
icon.svg              插件图标
docs/mock/demo.html   模拟数据演示页（截图用）
docs/images/          README 截图
scripts/make-demo.mjs 生成演示页
```

## 已知边界

- 顶部普通标签最多 180px，固定标签宽 40px。两处的长会话标题都可以悬停查看全文。
- 长工作区名在顶部角标里可能截断，在左侧角标里会换行。已分组的工作区名显示在组头。
- 工作区标签组依赖官方 `useWorkspaces` 的 `sessionIds` 映射；没有被任何工作区收录的会话标签不会参与聚合。
- 拖拽只在同一分组内生效，不能把固定标签拖成普通标签；拖到另一端时不会自动滚标签条。
- 未实现全局快捷键（`⌘T` / `⌘W` 等）；右键菜单不支持方向键导航（标签本身支持 `←` / `→`）。
- 设置、账号菜单这类界面是官方弹窗（overlay），不是全局面板，因此仍以弹窗形式覆盖在当前标签页上；如果要让它们也变成标签页，需要额外接管弹窗的打开/关闭，暂未实现。
- 只在 macOS 的 DSH 桌面版和 Chrome 系 Web GUI 上验证过，其他平台尚未测试。

## License

[MIT](https://github.com/imchangchang/dsh-tab/blob/main/LICENSE)
