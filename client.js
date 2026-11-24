/**
 * dsh-tab —— dsh Web GUI 的浏览器式会话标签页（浏览器半）。
 *
 * ## 层级
 * 顶部标签栏横跨会话列和右侧产物栏。左侧标签位于工作区树前，两处可同时显示。
 * 切换标签页 = 切换整页会话（右侧产物栏跟随会话）。
 *
 * ## 外观
 * 书页标签：标签栏是一条比页面底色浅一号的「书脊」，选中的标签抬到页面底色、
 * 左右描边、不画底部横线，直接和下面的会话页连成一张纸。标签宽度跟着标题文字
 * 自适应，普通标签最多 180px，切换时尺寸不变。固定标签只显示图标。
 *
 * ## 右键菜单
 * 关闭标签页 / 关闭右侧标签页 / 关闭其他标签页 / 关闭全部标签页 /
 * 固定（取消固定）标签页 / 归档会话。归档有任务在跑的会话时先询问，确认后走
 * 官方的「停止并归档」路径。
 *
 * ## 座位与机制（全部官方公开 API）
 * - 标签控制器 = `shell.overlay` 座位。顶部启用时由帧布局预留 44px；左侧通过
 *   原生 `sidebar.workspaces` 座位标记定位插件容器，两个列表共用同一标签状态。
 * - 切换会话 = `ctx.uiWorkspace.openSession(id)`（官方侧栏行同一入口）；
 * - 新建对话 = `ctx.uiWorkspace.startSession()`（官方「新会话」入口，复用空白会话）；
 * - 归档会话 = `ctx.uiWorkspace.archiveSession(id, { stopActivity })`（官方归档入口）；
 * - 当前会话 = 官方会话目录里 `retainedBy.mainView > 0` 的那一条（官方 DocumentTitle 同款读法）；
 * - 运行/等待/未读 = 官方 `useSessionStatus` 投影；
 * - 文字 = `ctx.locale.register` + 座位 `locale` 选项注入的 `t`。
 *
 * 最右侧的产物侧栏开关沿用官方会话头部角上的按钮（位于标签栏下一行最右）。
 *
 * 标签页是视图层记录（浏览器本地 localStorage 持久化）：点击标签页切换当前会话，
 * 不并行渲染多个会话（官方 Conversation 一页一条会话）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-tab',
  factory(require) {
    const React = require('react')
    const { createPortal } = require('react-dom')
    const { SettingsForm, Switch, IconChevronDownOutlineRegular, IconChevronRightOutlineRegular } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement
    const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } = React

    const NS = 'dsh-tab'
    const STORAGE_KEY = 'dsh.tab.view.v2'
    const COLLAPSED_GROUPS_KEY = 'dsh.tab.groups.collapsed.v1'
    const SIDEBAR_GROUPS_KEY = 'dsh.tab.sidebar.groups.collapsed.v1'
    const LEGACY_STORAGE_KEY = 'dsh.tab.openSessions.v1'
    const EMPTY_PANEL_ID = 'dsh-tab.empty'

    // ── 文案（官方 locale 命名空间；en 为必填回退） ──────────────────────────
    const ZH = {
      'tab.list': '会话标签页',
      'tab.sidebar': '已打开',
      'tab.sidebarList': '左侧已打开的标签页',
      'tab.new': '新建会话',
      'tab.newSession': '新会话',
      'tab.untitled': '未命名',
      'tab.close': '关闭标签页：{title}',
      'tab.running': '运行中',
      'tab.pending': '等待回复',
      'tab.unread': '有新完成内容',
      'tab.pinned': '已固定',
      'tab.workspace': '工作区：{name}',
      'tab.workspaceGroupTip': '{name} · {n} 个标签',
      'tab.workspaceGroupCollapse': '折叠工作区标签组：{name}',
      'tab.workspaceGroupExpand': '展开工作区标签组：{name}',
      'menu.close': '关闭标签页',
      'menu.closeRight': '关闭右侧标签页',
      'menu.closeBelow': '关闭下方标签页',
      'menu.closeOthers': '关闭其他标签页',
      'menu.closeAll': '关闭全部标签页',
      'menu.pin': '固定标签页',
      'menu.unpin': '取消固定标签页',
      'menu.archive': '归档会话',
      'menu.archiveRunning': '这个会话还有任务在运行。归档会先停止它，再归档。',
      'menu.archiveStop': '停止并归档',
      'menu.archiveBusy': '正在归档…',
      'menu.archiveFailed': '归档失败：{message}',
      'menu.retryStop': '停止并重试',
      'menu.cancel': '取消',
      'settings.reopenAfterClose': '关闭最后一个标签后自动打开会话',
      'settings.closeDraftTabs': '离开新会话时自动关闭草稿标签',
      'settings.showHorizontal': '显示顶部标签栏',
      'settings.showVertical': '显示左侧标签栏',
      'settings.save': '保存',
    }
    const EN = {
      'tab.list': 'Conversation tabs',
      'tab.sidebar': 'Open tabs',
      'tab.sidebarList': 'Open tabs in sidebar',
      'tab.new': 'New conversation',
      'tab.newSession': 'New session',
      'tab.untitled': 'Untitled',
      'tab.close': 'Close tab: {title}',
      'tab.running': 'Running',
      'tab.pending': 'Waiting for you',
      'tab.unread': 'New completed response',
      'tab.pinned': 'Pinned',
      'tab.workspace': 'Workspace: {name}',
      'tab.workspaceGroupTip': '{name} · {n} tabs',
      'tab.workspaceGroupCollapse': 'Collapse workspace tab group: {name}',
      'tab.workspaceGroupExpand': 'Expand workspace tab group: {name}',
      'menu.close': 'Close tab',
      'menu.closeRight': 'Close tabs to the right',
      'menu.closeBelow': 'Close tabs below',
      'menu.closeOthers': 'Close other tabs',
      'menu.closeAll': 'Close all tabs',
      'menu.pin': 'Pin tab',
      'menu.unpin': 'Unpin tab',
      'menu.archive': 'Archive conversation',
      'menu.archiveRunning': 'This conversation still has work running. Archiving stops it first.',
      'menu.archiveStop': 'Stop and archive',
      'menu.archiveBusy': 'Archiving…',
      'menu.archiveFailed': 'Archive failed: {message}',
      'menu.retryStop': 'Stop and retry',
      'menu.cancel': 'Cancel',
      'settings.reopenAfterClose': 'Open a session after closing the last tab',
      'settings.closeDraftTabs': 'Close draft tabs when leaving a new session',
      'settings.showHorizontal': 'Show top tabs',
      'settings.showVertical': 'Show sidebar tabs',
      'settings.save': 'Save',
    }

    // ── 帧布局（把 shell.bottom 那行搬到三栏上方，横跨会话列 + 右栏列） ─────
    // 只依赖官方既有标记：帧上的 data-shell-bottom / data-shell-overlay，
    // 拖拽把手上的 data-side。官方改这些标记时本段失效，标签栏会回落到三栏下方
    // （不会崩溃），此时需要按新版 DOM 更新选择器。
    const FRAME_CSS = `
/* 帧改成三行：第 1 行标签栏（44px 空行，标签栏由 shell.overlay 座位绝对定位填入）、
   第 2 行会话内容、第 3 行官方 shell.bottom（诊断面板等）。 */
div:has(> [data-shell-bottom]):has(> [data-shell-overlay]) {
  grid-template-rows: 44px minmax(0, 1fr) auto !important;
}
/* 右侧产物栏全屏时标签栏隐藏，首行归零，否则全屏面板上方留一条 44px 死区 */
div:has(> [data-shell-bottom])[data-rightbar-fullscreen]:has(> [data-shell-overlay]) {
  grid-template-rows: 0 minmax(0, 1fr) auto !important;
}
/* 窄屏抽屉的遮罩排在三栏之前，不参与三栏定位。左栏贯穿第 1、2 行。 */
div:has(> [data-shell-bottom]):has(> [data-shell-overlay]) > :nth-child(1 of :not([data-sidebar-mask])) {
  grid-row: 1 / 3 !important;
  grid-column: 1 !important;
}
/* 会话列、右栏列下移到第 2 行 */
div:has(> [data-shell-bottom]):has(> [data-shell-overlay]) > :nth-child(2 of :not([data-sidebar-mask])) {
  grid-row: 2 !important;
  grid-column: 2 !important;
}
div:has(> [data-shell-bottom]):has(> [data-shell-overlay]) > :nth-child(3 of :not([data-sidebar-mask])) {
  grid-row: 2 !important;
  grid-column: 3 !important;
}
/* 官方 shell.bottom 座位回到第 3 行（整宽） */
[data-shell-bottom] {
  grid-row: 3 !important;
  grid-column: 1 / -1 !important;
}
/* 列宽拖拽把手恢复成会话内容整高（第 1、2 行，不盖到第 3 行） */
div:has(> [data-shell-bottom]):has(> [data-shell-overlay]) > [data-side] {
  grid-area: 1 / 1 / 3 / -1 !important;
}
/* Windows 标题栏：圆角原本在会话列左上，现在改由标签栏承载 */
[data-windows-titlebar] div:has(> [data-shell-bottom]) > :nth-child(2) {
  border-top-left-radius: 0 !important;
}
div[data-rightbar-fullscreen]:has(> [data-shell-overlay]):has([data-dsh-tab-empty-main]) {
  grid-template-rows: 44px minmax(0, 1fr) auto !important;
}
`

    const EMPTY_FRAME_CSS = `
/* 空白主面板跨到右栏，原会话的右栏暂时隐藏，返回后沿用原布局。 */
div:has(> [data-shell-bottom]):has(> [data-shell-overlay]) > :has([data-global-panel] [data-dsh-tab-empty-main]) {
  grid-column: 2 / -1 !important;
}
div:has(> [data-shell-overlay]):has([data-dsh-tab-empty-main]) > :is([data-rightbar-col],[data-side=rightbar]) {
  visibility: hidden;
}
`

    // ── 标签栏外观（书页标签 + 右键菜单） ──────────────────────────────────
    const CSS = `
/* 书脊条：比页面底色浅一号，底部一条细线 */
.dsh-tab-pagebar{position:absolute;top:0;right:0;z-index:2;pointer-events:auto;box-sizing:border-box;
  left:max(var(--dsh-tab-left, 0px), var(--dsh-frame-leading-clearance, 0px));
  display:flex;align-items:center;height:44px;padding:0 16px 0 20px;
  background:var(--dsw-alias-bg-module-platform);
  box-shadow:inset 0 -.5px 0 var(--dsw-alias-border-l2);
  -webkit-app-region:drag;
  --dsh-tab-max-width:180px}
/* 抽屉悬浮在主列上方。标签栏只给原生侧栏按钮留空间。 */
[data-sidebar-drawer] .dsh-tab-pagebar:not([data-orientation=vertical]){left:var(--dsh-frame-leading-clearance, 0px)}
html[data-windows-titlebar] .dsh-tab-pagebar:not([data-orientation=vertical]){top:var(--dsh-windows-titlebar-height, 0px);
  border-top-left-radius:var(--dsh-windows-content-radius, 16px);corner-shape:round}
[data-rightbar-fullscreen] .dsh-tab-pagebar:not([data-orientation=vertical]):not([data-main-empty=true]){display:none}
.dsh-tab-pagebar__strip{display:flex;align-items:flex-end;flex:0 1 auto;min-width:0;
  height:100%;overflow-x:auto;overflow-y:hidden;scroll-padding-inline:8px;-webkit-app-region:no-drag}
.dsh-tab-pagebar__strip::-webkit-scrollbar{height:6px}
.dsh-tab-pagebar__strip::-webkit-scrollbar-thumb{border-radius:6px;background:var(--dsw-alias-label-dimmed)}
.dsh-tab-pagebar__strip::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-label-tertiary)}
@supports not selector(::-webkit-scrollbar){.dsh-tab-pagebar__strip{scrollbar-width:thin}}
/* 短标签：书脊上的一张纸签 */
.dsh-tab-pagebar__tab{position:relative;box-sizing:border-box;display:flex;align-items:center;gap:7px;
  flex:0 1 auto;min-width:72px;max-width:var(--dsh-tab-max-width);height:32px;padding:0 6px 0 12px;
  border:.5px solid transparent;border-bottom:none;border-radius:8px 8px 0 0;
  background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:13px;line-height:18px;
  cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-app-region:no-drag;touch-action:pan-y;
  animation:dsh-tab-enter .16s ease;
  transition:background-color .1s ease,color .1s ease,border-color .1s ease,box-shadow .1s ease}
.dsh-tab-pagebar__tab:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
/* 选中标签通过底色和上方圆角与会话区相连，宽高和位置不变。 */
.dsh-tab-pagebar__tab[aria-selected=true]{z-index:1;background:var(--dsw-alias-bg-base);
  border-color:var(--dsw-alias-border-l2);border-radius:8px 8px 0 0;color:var(--dsw-alias-label-primary);
  box-shadow:0 2px 8px 0 rgba(15,20,40,.07)}
.dsh-tab-pagebar__tab[aria-selected=true]:hover{background:var(--dsw-alias-bg-base);
  color:var(--dsw-alias-label-primary)}
/* 固定标签：只剩图标、宽度固定 40px；激活时也不展开 */
.dsh-tab-pagebar__tab[data-pinned=true]{width:40px;min-width:40px;max-width:40px;flex:none;padding:0;
  justify-content:center;gap:4px}
.dsh-tab-pagebar__tab[data-pinned=true] .dsh-tab-pagebar__label,
.dsh-tab-pagebar__tab[data-pinned=true] .dsh-tab-pagebar__close{display:none}
.dsh-tab-pagebar__divider{flex:none;align-self:center;width:1px;height:20px;margin:0 6px;
  background:var(--dsw-alias-border-l2)}
.dsh-tab-pagebar__tab:focus-visible{outline:1.5px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}
/* 拖拽排序：拖动中的标签变淡，落点画一条竖线 */
.dsh-tab-pagebar__tab[data-dragging=true]{opacity:.55;cursor:grabbing}
.dsh-tab-pagebar__tab[data-drop=before]{box-shadow:inset 2px 0 0 var(--dsw-alias-state-business-primary)}
.dsh-tab-pagebar__tab[data-drop=after]{box-shadow:inset -2px 0 0 var(--dsw-alias-state-business-primary)}
/* 左上角小角标：所属工作区（短名，悬停看全名） */
/* 工作区标签组：参考 Chrome 标签组——淡色底 + 组头胶囊 + 组底部色线，色线绕过激活标签 */
.dsh-tab-pagebar__group{position:relative;z-index:1;flex:none;display:flex;align-items:center;align-self:flex-end;
  height:38px;margin:0 6px;padding:0 3px 0 2px;box-sizing:border-box;border-radius:10px 10px 0 0;
  background:transparent}
.dsh-tab-pagebar__group::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;z-index:0;
  background:hsl(var(--dsh-tab-group-hue, 214) 65% 42%);border-radius:1px;pointer-events:none}
.dsh-tab-pagebar__group[data-collapsed=true]{height:auto;padding:0;margin:0 4px;background:transparent;border-radius:0}
.dsh-tab-pagebar__group[data-collapsed=true]::after{display:none}
.dsh-tab-pagebar__group-chip{flex:none;display:inline-flex;align-items:center;gap:4px;max-width:170px;
  height:26px;padding:0 10px;margin-right:4px;border:none;border-radius:999px;color:#fff;font-family:inherit;
  font-size:11px;font-weight:600;line-height:26px;cursor:pointer;overflow:hidden;white-space:nowrap;
  background:hsl(var(--dsh-tab-group-hue, 214) 65% 42%);
  box-shadow:0 0 0 .5px hsl(var(--dsh-tab-group-hue, 214) 60% 32% / .35)}
.dsh-tab-pagebar__group[data-collapsed=true] .dsh-tab-pagebar__group-chip{margin-right:0;height:28px;line-height:28px}
.dsh-tab-pagebar__group[data-active=true] .dsh-tab-pagebar__group-chip{box-shadow:0 0 0 1.5px hsl(var(--dsh-tab-group-hue, 214) 65% 42% / .35)}
.dsh-tab-pagebar__group-chip:hover{filter:brightness(1.08)}
.dsh-tab-pagebar__group-chip{-webkit-app-region:no-drag}
.dsh-tab-pagebar__group-chip:focus-visible{outline:1.5px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dsh-tab-pagebar__group-name{overflow:hidden;text-overflow:ellipsis}
.dsh-tab-pagebar__group-count{flex:none;min-width:15px;height:15px;padding:0 4px;border-radius:999px;text-align:center;
  font-size:9px;line-height:15px;background:#ffffff3d}
.dsh-tab-pagebar__group-dot{flex:none;width:6px;height:6px;border-radius:50%;background:#fff}
/* 组内标签：统一 38 高、无底色；分隔线用伪元素（不占宽度），激活态只用 inset 描边，不改变任何尺寸 */
.dsh-tab-pagebar__tab[data-group-workspace]{position:relative;height:38px;z-index:1;background:transparent;box-shadow:none}
.dsh-tab-pagebar__tab[data-group-workspace]::before{content:"";position:absolute;left:0;top:9px;bottom:7px;width:1px;
  background:color-mix(in srgb, hsl(var(--dsh-tab-group-hue, 214) 65% 45%) 40%, transparent);pointer-events:none}
.dsh-tab-pagebar__tab[data-group-workspace]:not([aria-selected=true]){color:var(--dsw-alias-label-secondary)}
.dsh-tab-pagebar__tab[data-group-workspace]:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-tab-pagebar__group-chip + .dsh-tab-pagebar__tab[data-group-workspace]::before{display:none}
.dsh-tab-pagebar__tab[data-group-workspace][aria-selected=true]{background:var(--dsw-alias-bg-base);
  color:var(--dsw-alias-label-primary);border-color:transparent;border-radius:8px 8px 0 0;
  box-shadow:inset 0 2px 0 hsl(var(--dsh-tab-group-hue, 214) 65% 42%),
    inset 2px 0 0 hsl(var(--dsh-tab-group-hue, 214) 65% 42%),
    inset -2px 0 0 hsl(var(--dsh-tab-group-hue, 214) 65% 42%)}
.dsh-tab-pagebar__tab[data-group-workspace][aria-selected=true]::before{display:none}
.dsh-tab-pagebar__badge{position:absolute;left:5px;top:-5px;box-sizing:border-box;max-width:50%;height:10px;
  padding:0 3px;border-radius:3px;color:#fff;font-size:8.5px;font-weight:600;line-height:10px;letter-spacing:.01em;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;opacity:.96}
.dsh-tab-pagebar__tab[data-pinned=true] .dsh-tab-pagebar__badge{left:2px;max-width:38px;padding:0 1px;font-size:7.5px}
.dsh-tab-pagebar__icon{position:relative;flex:none;width:16px;height:16px;display:grid;place-items:center;
  color:var(--dsw-alias-label-tertiary)}
.dsh-tab-pagebar__tab[aria-selected=true] .dsh-tab-pagebar__icon{color:var(--dsw-alias-label-secondary)}
.dsh-tab-pagebar__label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-tab-pagebar__dot{flex:none;width:6px;height:6px;border-radius:50%}
.dsh-tab-pagebar__dot[data-signal=running]{background:var(--dsw-alias-state-business-primary);
  animation:dsh-tab-pulse 1.6s ease-in-out infinite}
.dsh-tab-pagebar__dot[data-signal=pending]{background:var(--dsw-alias-state-warn-primary)}
.dsh-tab-pagebar__dot[data-signal=unread]{background:var(--dsw-alias-state-success-primary)}
.dsh-tab-pagebar__close{flex:none;width:18px;height:18px;display:grid;place-items:center;padding:0;
  border:none;border-radius:5px;background:transparent;color:inherit;cursor:pointer;-webkit-app-region:no-drag;
  opacity:0;pointer-events:none;transition:opacity .1s ease,background-color .1s ease}
.dsh-tab-pagebar__tab:hover .dsh-tab-pagebar__close,
.dsh-tab-pagebar__tab[aria-selected=true] .dsh-tab-pagebar__close,
.dsh-tab-pagebar__tab:focus-within .dsh-tab-pagebar__close{opacity:1;pointer-events:auto}
.dsh-tab-pagebar__close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-tab-pagebar__close:focus-visible{outline:1.5px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
.dsh-tab-pagebar__new{flex:none;align-self:flex-end;width:30px;height:30px;display:grid;place-items:center;padding:0;
  margin:0 0 4px 6px;border:none;border-radius:var(--dsw-radius-sm);background:transparent;
  color:var(--dsw-alias-label-secondary);cursor:pointer;-webkit-app-region:no-drag;
  transition:background-color .12s ease,color .12s ease}
.dsh-tab-pagebar__new:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh-tab-pagebar__new:focus-visible{outline:1.5px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}

/* 右键菜单 */
.dsh-tab-menu{position:fixed;z-index:100;box-sizing:border-box;min-width:188px;max-width:260px;padding:5px;
  border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-shadow-lv2);
  color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px;
  -webkit-app-region:no-drag;user-select:none;-webkit-user-select:none}
.dsh-tab-menu__item{display:flex;align-items:center;width:100%;height:30px;padding:0 8px;border:none;border-radius:6px;
  background:transparent;color:inherit;font:inherit;text-align:left;white-space:nowrap;cursor:pointer}
.dsh-tab-menu__item:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dsh-tab-menu__item:disabled{color:var(--dsw-alias-label-dimmed);cursor:default;background:transparent}
.dsh-tab-menu__item[data-danger=true]:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);
  color:var(--dsw-alias-state-error-primary)}
.dsh-tab-menu__sep{height:.5px;margin:4px 6px;background:var(--dsw-alias-border-l2)}
.dsh-tab-menu__hint{padding:4px 8px 6px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:17px;
  white-space:normal}
@keyframes dsh-tab-pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes dsh-tab-enter{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.dsh-tab-pagebar__dot[data-signal=running]{animation:none}}
@media (prefers-reduced-motion:reduce){
  .dsh-tab-pagebar__tab,.dsh-tab-pagebar__new,.dsh-tab-pagebar__close{transition:none;animation:none}
}
`

    const SIDEBAR_CSS = `
[data-dsh-tab-sidebar-mount]{flex:none;min-width:0}
[data-sidebar-collapsed] [data-dsh-tab-sidebar-mount]{display:none}
.dsh-tab-pagebar[data-orientation=vertical]{position:relative;inset:auto;z-index:auto;display:block;height:auto;
  padding:0 0 4px;background:transparent;box-shadow:none;-webkit-app-region:no-drag}
.dsh-tab-pagebar__heading{display:flex;align-items:center;gap:4px;width:100%;min-height:24px;padding:0 4px;
  background:transparent;border:0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;
  cursor:pointer;text-align:start}
.dsh-tab-pagebar__heading:hover{color:var(--dsw-alias-label-primary)}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__strip{display:block;height:auto;
  max-height:min(34vh,320px);max-height:min(34cqh,320px);overflow-x:hidden;overflow-y:auto}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__strip::-webkit-scrollbar{width:6px}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__strip[hidden]{display:none}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__tab{width:100%;min-width:0;max-width:none;height:auto;
  min-height:26px;gap:5px;padding:1px 4px 1px 7px;border:.5px solid transparent;border-radius:6px;
  justify-content:flex-start;font-size:12px;line-height:17px}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__tab[aria-selected=true]{
  border-color:var(--dsw-alias-border-l2);box-shadow:none}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__label{display:block;flex:1}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__badge{position:static;order:1;flex:0 1 auto;min-width:0;
  max-width:60%;height:auto;padding:1px 3px;font-size:9px;line-height:11px;white-space:normal;overflow-wrap:anywhere}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__dot{order:2}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__close{order:3;width:16px;height:16px}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__divider{display:block;width:auto;height:1px;margin:3px 4px}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__group{display:block;height:auto;padding:0 0 0 4px;
  margin:2px 0;border-radius:0}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__group::after{inset:0 auto 0 1px;width:2px;height:auto}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__group-chip{height:auto;min-height:19px;max-width:100%;
  margin:0 0 1px;padding:1px 6px;line-height:14px;border-radius:6px}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__group-name{white-space:normal;overflow-wrap:anywhere}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__tab[data-group-workspace]::before{display:none}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__tab[data-drop=before]{box-shadow:inset 0 2px var(--dsw-alias-state-business-primary)}
.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__tab[data-drop=after]{box-shadow:inset 0 -2px var(--dsw-alias-state-business-primary)}
@media (hover:none){.dsh-tab-pagebar[data-orientation=vertical] .dsh-tab-pagebar__close{opacity:1;pointer-events:auto}}
`

    // ── 图标（16px 线性图标，currentColor 跟随主题） ─────────────────────────
    function svg(children) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 16,
          height: 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        children,
      )
    }
    function IconConversation() {
      return svg(
        h('path', {
          d: 'M13.2 8c0 2.6-2.3 4.7-5.2 4.7-.6 0-1.2-.1-1.8-.3L3.5 13.2l.7-2c-.9-.8-1.4-2-1.4-3.2C2.8 5.4 5.1 3.3 8 3.3s5.2 2.1 5.2 4.7Z',
        }),
      )
    }
    function IconCompass() {
      return svg([
        h('circle', { key: 'c', cx: 8, cy: 8, r: 5.4 }),
        h('path', { key: 'n', d: 'M9.9 6.1 8.7 8.7 6.1 9.9l1.2-2.6 2.6-1.2Z' }),
      ])
    }
    function IconPanel() {
      return svg([
        h('rect', { key: 'a', x: 2.8, y: 2.8, width: 4.4, height: 4.4, rx: 1.2 }),
        h('rect', { key: 'b', x: 8.8, y: 2.8, width: 4.4, height: 4.4, rx: 1.2 }),
        h('rect', { key: 'c', x: 2.8, y: 8.8, width: 4.4, height: 4.4, rx: 1.2 }),
        h('rect', { key: 'd', x: 8.8, y: 8.8, width: 4.4, height: 4.4, rx: 1.2 }),
      ])
    }
    /** 官方 IconNewChatOutline16：侧栏新建对话按钮同款图标。 */
    function IconNewChat() {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 16,
          height: 16,
          fill: 'none',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', {
          d: 'M8.00003 0.3237C3.76075 0.3237 0.32373 3.76072 0.32373 8C0.32373 9.17603 0.589121 10.2922 1.0632 11.2901L1.35291 11.8989L2.5705 11.3205L2.28079 10.7117C1.89079 9.89074 1.67301 8.97167 1.67301 8C1.67301 4.50546 4.50549 1.67298 8.00003 1.67298C11.4946 1.67298 14.3271 4.50546 14.3271 8C14.3271 11.4945 11.4946 14.327 8.00003 14.327C7.28473 14.327 6.76077 14.277 6.29621 14.1487C5.83857 14.0224 5.40441 13.8109 4.88514 13.4488C4.12569 12.919 3.03778 12.7316 2.141 13.2978L2.12682 13.307L2.11264 13.3171L1.34886 13.854L1.79659 15.188L2.86122 14.4384C3.19068 14.2305 3.68325 14.2542 4.11326 14.5539C4.72789 14.9826 5.30042 15.2724 5.93762 15.4484C6.56803 15.6224 7.22776 15.6763 8.00003 15.6763C12.2393 15.6763 15.6763 12.2393 15.6763 8C15.6763 3.76072 12.2393 0.3237 8.00003 0.3237ZM7.32033 4.82535V7.32536H4.82538V8.67464H7.32033V11.1747H8.6696V8.67464H11.1747V7.32536H8.6696V4.82535H7.32033Z',
          fill: 'currentColor',
        }),
      )
    }
    function IconClose() {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 12,
          height: 12,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', { d: 'M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6' }),
      )
    }

    // ── 持久化（视图态，不进会话日志） ───────────────────────────────────────
    function sanitizeIds(value) {
      if (!Array.isArray(value)) return []
      const seen = new Set()
      const ids = []
      for (const item of value) {
        if (typeof item !== 'string' || item.length === 0 || seen.has(item)) continue
        seen.add(item)
        ids.push(item)
      }
      return ids
    }

    function tabSettingsOf(value) {
      return Object.freeze({
        showHorizontal: value?.showHorizontal !== false,
        showVertical: value?.showVertical === true,
        reopenAfterClose: value?.reopenAfterClose !== false,
        closeDraftTabs: value?.closeDraftTabs === true,
      })
    }

    function readStoredState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw !== null) {
          const value = JSON.parse(raw)
          if (value !== null && typeof value === 'object') {
            const ids = sanitizeIds(value.tabs)
            const pinned = sanitizeIds(value.pinned).filter((id) => ids.includes(id))
            const drafts = sanitizeIds(value.drafts).filter((id) => ids.includes(id))
            return { ids, pinned, drafts, settings: tabSettingsOf(value.settings) }
          }
        }
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (legacy !== null) return { ids: sanitizeIds(JSON.parse(legacy)), pinned: [], drafts: [], settings: tabSettingsOf() }
      } catch (error) {
        /* 存储不可用 / 内容损坏：从空列表开始，标签页只是视图态 */
      }
      return { ids: [], pinned: [], drafts: [], settings: tabSettingsOf() }
    }

    function createTabStore() {
      const stored = readStoredState()
      let ids = stored.ids
      let pinned = stored.pinned
      let settings = stored.settings
      // 仅记录已确认有草稿的标签；仅附件的草稿由原生页面持有，刷新后随附件一起退出标签记录。
      const drafts = new Map(stored.drafts.map((id) => [id, true]))
      const suppressed = new Map()
      const makeSnapshot = () => Object.freeze({ ids: Object.freeze(ids.slice()), pinned: Object.freeze(pinned.slice()), settings })
      let snapshot = makeSnapshot()
      const listeners = new Set()
      const publish = () => {
        snapshot = makeSnapshot()
        try {
          const savedIds = ids.filter((id) => drafts.get(id) !== false)
          const savedPinned = pinned.filter((id) => drafts.get(id) !== false)
          const savedDrafts = [...drafts].filter(([, durable]) => durable).map(([id]) => id)
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs: savedIds, pinned: savedPinned, drafts: savedDrafts, settings }))
          localStorage.removeItem(LEGACY_STORAGE_KEY)
        } catch (error) {
          /* 无痕模式 / 存储禁用：标签页只是视图态，存不进不影响会话数据 */
        }
        for (const listener of [...listeners]) listener()
      }
      return {
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        getSnapshot() {
          return snapshot
        },
        has(id) {
          return ids.includes(id)
        },
        add(id, draft) {
          const exists = ids.includes(id)
          if (exists && drafts.get(id) === draft) return
          if (!exists) ids = [...ids, id]
          if (draft === undefined) drafts.delete(id)
          else drafts.set(id, draft)
          publish()
        },
        hasDraft(id) {
          return drafts.has(id)
        },
        setSettings(value) {
          const next = tabSettingsOf(value)
          if (Object.keys(next).every((key) => settings[key] === next[key])) return
          settings = next
          publish()
        },
        pin(id) {
          if (!ids.includes(id) || pinned.includes(id)) return
          pinned = [...pinned, id]
          publish()
        },
        unpin(id) {
          if (!pinned.includes(id)) return
          pinned = pinned.filter((item) => item !== id)
          publish()
        },
        removeMany(removed) {
          const drop = new Set(removed)
          if (!ids.some((id) => drop.has(id))) return
          ids = ids.filter((item) => !drop.has(item))
          pinned = pinned.filter((item) => !drop.has(item))
          for (const id of drop) drafts.delete(id)
          publish()
        },
        /** 固定分组内拖动排序（referenceId 目标标签，place 表示放在它前/后）。 */
        movePinned(id, referenceId, place) {
          if (!pinned.includes(id) || !pinned.includes(referenceId) || id === referenceId) return
          const next = pinned.filter((item) => item !== id)
          const referenceIndex = next.indexOf(referenceId)
          if (referenceIndex < 0) return
          next.splice(place === 'after' ? referenceIndex + 1 : referenceIndex, 0, id)
          pinned = next
          publish()
        },
        /** 未固定分组内拖动排序（显示顺序就是 ids 顺序）。 */
        moveUnpinned(id, referenceId, place) {
          if (!ids.includes(id) || id === referenceId) return
          const next = ids.filter((item) => item !== id)
          const referenceIndex = next.indexOf(referenceId)
          if (referenceIndex < 0) return
          next.splice(place === 'after' ? referenceIndex + 1 : referenceIndex, 0, id)
          ids = next
          publish()
        },
        /** 主动关掉的标签不立即加回。保留原生编辑器时，继续编辑或发送就可以重新入签。 */
        suppress(id, draft) {
          suppressed.set(id, draft === undefined ? null : { revision: draft.draftRev, attachments: draft.attachmentIds })
        },
        isSuppressed(id, draft) {
          const closed = suppressed.get(id)
          if (closed === undefined) return false
          if (closed === null || (draft?.draftRev === closed.revision && draft?.attachmentIds === closed.attachments)) return true
          suppressed.delete(id)
          return false
        },
        unsuppress(id) {
          suppressed.delete(id)
        },
        pruneSuppressed(keepId) {
          for (const id of suppressed.keys()) if (id !== keepId) suppressed.delete(id)
        },
      }
    }

    // ── 官方会话目录里读「当前会话」 ─────────────────────────────────────────
    function currentSessionIdOf(catalog) {
      if (catalog === undefined || catalog === null) return undefined
      const rows = catalog.byId ?? {}
      for (const id of catalog.ids ?? []) {
        const row = rows[id]
        if (row !== undefined && (row.retainedBy?.mainView ?? 0) > 0) return id
      }
      return undefined
    }

    function draftHasText(draft) {
      return Boolean(draft?.draft?.trim()) || (draft?.occurrences?.length ?? 0) > 0
    }

    function draftIsSubmitting(draft) {
      return draft?.phase === 'adjudicating' || draft?.phase === 'sending' || draft?.phase === 'submitting'
    }

    function sessionStatusSignal(status) {
      if (status === undefined || status === null) return undefined
      if (status.pendingInteraction !== undefined && status.pendingInteraction !== null) return 'pending'
      if (status.running === true) return 'running'
      if (status.completionUnread === true) return 'unread'
      return undefined
    }

    /** 路径最后一段（兼容 / 与 \\）。 */
    function basenameOf(path) {
      if (typeof path !== 'string') return ''
      const parts = path.split(/[\\/]/).filter((part) => part.length > 0)
      return parts.length === 0 ? '' : parts[parts.length - 1]
    }

    /** 工作区名 → 角标颜色（固定色相，同一工作区在任何主题下颜色一致）。 */
    function workspaceHue(key) {
      let hash = 0
      for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) % 360
      return hash
    }

    function errorMessageOf(error) {
      if (error === undefined || error === null) return ''
      if (typeof error === 'string') return error
      if (typeof error.message === 'string' && error.message.length > 0) return error.message
      return String(error)
    }

    // 全局面板（侧栏「插件」「自动化任务」等）也作为标签页：用 panel:<id> 与会话 id 区分。
    const PANEL_TAB_PREFIX = 'panel:'
    const isPanelTab = (id) => typeof id === 'string' && id.startsWith(PANEL_TAB_PREFIX)
    const panelIdOf = (id) => id.slice(PANEL_TAB_PREFIX.length)
    const panelTabKey = (panelId) => `${PANEL_TAB_PREFIX}${panelId}`
    /** 宿主没有 layout 面板信息时退化成「始终在会话页」。 */
    function useNoPanelInfo(selector) {
      return selector({ activePanelId: null })
    }

    /** 读取 / 保存被折叠的工作区标签组。 */
    function readCollapsedGroups(key) {
      try {
        const raw = localStorage.getItem(key)
        if (raw === null) return new Set()
        const value = JSON.parse(raw)
        if (!Array.isArray(value)) return new Set()
        return new Set(value.filter((item) => typeof item === 'string' && item.length > 0))
      } catch (error) {
        return new Set()
      }
    }
    function writeCollapsedGroups(key, collapsed) {
      try {
        localStorage.setItem(key, JSON.stringify([...collapsed]))
      } catch (error) {
        /* 视图态，存储不可用时忽略 */
      }
    }

    /**
     * 按工作区聚合标签：同一工作区有 2 个以上（未固定）会话标签时合成一个 Chrome 风格标签组。
     * 固定标签、面板标签、无法识别工作区的标签不参与聚合。
     */
    function groupTabsByWorkspace(list, workspaceMap) {
      const members = new Map()
      for (const tab of list) {
        if (tab.pinned || isPanelTab(tab.id)) continue
        const workspace = workspaceMap.get(tab.id)
        if (workspace === undefined || workspace.workspaceId === undefined) continue
        const group = members.get(workspace.workspaceId) ?? {
          workspaceId: workspace.workspaceId,
          label: workspace.label,
          hue: workspace.hue,
          tabs: [],
        }
        group.tabs.push(tab)
        members.set(workspace.workspaceId, group)
      }
      const groups = new Map()
      for (const [workspaceId, group] of members) if (group.tabs.length >= 2) groups.set(workspaceId, group)
      const groupedIds = new Set([...groups.values()].flatMap((group) => group.tabs.map((tab) => tab.id)))
      const items = []
      const emittedGroups = new Set()
      for (const tab of list) {
        if (!tab.pinned && !isPanelTab(tab.id)) {
          const workspace = workspaceMap.get(tab.id)
          const group = workspace === undefined ? undefined : groups.get(workspace.workspaceId)
          if (group !== undefined) {
            if (!emittedGroups.has(group.workspaceId)) {
              emittedGroups.add(group.workspaceId)
              items.push({ kind: 'group', group })
            }
            continue
          }
        }
        if (groupedIds.has(tab.id)) continue
        items.push({ kind: 'tab', tab })
      }
      return items
    }

    /**
     * 显示顺序：固定标签在最左（按固定顺序），其余按打开顺序。
     * 切换标签不改变顺序；激活标签只是变宽、和下面的会话页连成一张纸。
     */
    function displayTabs(snapshot) {
      const pinnedSet = new Set(snapshot.pinned)
      const pinnedTabs = snapshot.pinned
        .filter((id) => snapshot.ids.includes(id))
        .map((id) => ({ id, pinned: true }))
      const rest = snapshot.ids.filter((id) => !pinnedSet.has(id)).map((id) => ({ id, pinned: false }))
      return [...pinnedTabs, ...rest]
    }

    // ── 单个标签页 ──────────────────────────────────────────────────────────
    function TabItem(props) {
      const {
        id, title, active, tabIndex, vertical, signal, blank, pinned, panel, grouped, badge,
        drop, dragging, t, onSelect, onClose, onMenu, onArrow, onDragStart,
      } = props
      const statusLabel =
        signal === 'running' ? t('tab.running') : signal === 'pending' ? t('tab.pending') : signal === 'unread' ? t('tab.unread') : undefined
      return h(
        'div',
        {
          className: 'dsh-tab-pagebar__tab',
          role: 'tab',
          tabIndex,
          'aria-selected': active,
          'data-session-id': id,
          'data-pinned': pinned ? 'true' : 'false',
          'data-panel-tab': panel ? 'true' : undefined,
          'data-group-workspace': grouped ? 'true' : undefined,
          'data-dragging': dragging ? 'true' : 'false',
          'data-drop': drop === null || drop === undefined ? undefined : drop,
          title: pinned ? `${title} · ${t('tab.pinned')}` : title,
          onClick: () => onSelect(id),
          onPointerDown: (event) => {
            if (event.button !== 0) return
            const target = event.target
            if (target !== null && typeof target.closest === 'function' && target.closest('.dsh-tab-pagebar__close') !== null) return
            onDragStart(event)
          },
          onContextMenu: (event) => onMenu(event, id),
          onAuxClick: (event) => {
            if (event.button === 1) {
              event.preventDefault()
              onClose(id)
            }
          },
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(id)
              return
            }
            if (event.key === (vertical ? 'ArrowDown' : 'ArrowRight')) {
              event.preventDefault()
              onArrow(id, 1)
              return
            }
            if (event.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) {
              event.preventDefault()
              onArrow(id, -1)
            }
          },
        },
        badge === null || badge === undefined
          ? null
          : h(
              'span',
              {
                key: 'badge',
                className: 'dsh-tab-pagebar__badge',
                style: { backgroundColor: `hsl(${badge.hue} 46% 38%)` },
                title: vertical ? undefined : t('tab.workspace', { name: badge.label }),
                'aria-hidden': vertical ? undefined : 'true',
              },
              badge.label,
            ),
        h('span', { className: 'dsh-tab-pagebar__icon' }, panel ? h(IconPanel) : blank ? h(IconCompass) : h(IconConversation)),
        h('span', { className: 'dsh-tab-pagebar__label' }, title),
        signal !== undefined
          ? h('span', {
              key: 'dot',
              className: 'dsh-tab-pagebar__dot',
              'data-signal': signal,
              role: 'img',
              'aria-label': statusLabel,
              title: statusLabel,
            })
          : null,
        pinned
          ? null
          : h(
              'button',
              {
                type: 'button',
                tabIndex: -1,
                className: 'dsh-tab-pagebar__close',
                title: t('tab.close', { title }),
                'aria-label': t('tab.close', { title }),
                onClick: (event) => {
                  event.stopPropagation()
                  onClose(id)
                },
                onContextMenu: (event) => {
                  event.preventDefault()
                  onMenu(event, id)
                },
                onKeyDown: (event) => {
                  event.stopPropagation()
                },
              },
              h(IconClose),
            ),
      )
    }

    // ── 右键菜单 ────────────────────────────────────────────────────────────
    function TabMenu(props) {
      const { x, y, hint, items, trigger, onClose } = props
      const menuRef = useRef(null)
      const [position, setPosition] = useState({ x, y })

      // 打开后按实际尺寸夹到窗口内，避免菜单跑出屏幕
      useLayoutEffect(() => {
        const element = menuRef.current
        if (element === null) return
        const rect = element.getBoundingClientRect()
        const nextX = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))
        const nextY = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))
        if (nextX !== position.x || nextY !== position.y) setPosition({ x: nextX, y: nextY })
        // 菜单挂在 body，先交出焦点，避免移动端原生抽屉的焦点循环把菜单隔开。
        if (!element.contains(document.activeElement)) element.querySelector('button:not(:disabled)')?.focus({ preventScroll: true })
      }, [x, y, hint, items.length])

      useEffect(() => {
        const onPointerDown = (event) => {
          if (menuRef.current !== null && menuRef.current.contains(event.target)) return
          onClose()
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onClose()
            if (trigger?.isConnected) trigger.focus({ preventScroll: true })
          }
        }
        const onDismiss = () => onClose()
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        window.addEventListener('scroll', onDismiss, true)
        window.addEventListener('resize', onDismiss)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
          window.removeEventListener('scroll', onDismiss, true)
          window.removeEventListener('resize', onDismiss)
        }
      }, [onClose, trigger])

      return h(
        'div',
        {
          ref: menuRef,
          className: 'dsh-tab-menu',
          role: 'menu',
          style: { left: `${position.x}px`, top: `${position.y}px` },
          onContextMenu: (event) => event.preventDefault(),
        },
        hint === undefined || hint === null ? null : h('div', { key: 'hint', className: 'dsh-tab-menu__hint' }, hint),
        items.map((item) =>
          item.separator === true
            ? h('div', { key: item.key, className: 'dsh-tab-menu__sep', role: 'separator' })
            : h(
                'button',
                {
                  key: item.key,
                  type: 'button',
                  role: 'menuitem',
                  className: 'dsh-tab-menu__item',
                  disabled: item.disabled === true,
                  'data-danger': item.danger === true ? 'true' : 'false',
                  onClick: () => item.run(),
                },
                item.label,
              ),
        ),
      )
    }

    // ── 插件详情页设置 ──────────────────────────────────────────────────────
    function createTabSettings(store) {
      return function TabSettings({ t }) {
        const { settings } = useSyncExternalStore(store.subscribe, store.getSnapshot)
        const [edited, setEdited] = useState(settings)
        const keys = Object.keys(settings)
        return h(
          SettingsForm,
          {
            labels: { save: t('settings.save') },
            state: { available: true, writable: true, dirty: keys.some((key) => edited[key] !== settings[key]) },
            onSave: () => store.setSettings(edited),
            onDiscard: () => {},
          },
          keys.map((key) => {
            const label = t(`settings.${key}`)
            return h(
              'label',
              { key, style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
              label,
              h(Switch, {
                label,
                checked: edited[key],
                onChange: (checked) => setEdited((previous) => ({ ...previous, [key]: checked })),
              }),
            )
          }),
        )
      }
    }

    /** 在原生工作区座位前插入插件自己的容器。侧栏内容更新后重新定位，保留原生树。 */
    function useSidebarMount(enabled, rootRef) {
      const [mount, setMount] = useState(null)
      useLayoutEffect(() => {
        if (!enabled) return
        const frame = rootRef.current.closest('[data-shell-overlay]')?.parentElement
        if (!frame) return
        const target = document.createElement('div')
        target.setAttribute('data-dsh-tab-sidebar-mount', '')
        let sidebar
        const sync = () => {
          const column = frame.querySelector(':scope > :nth-child(1 of :not([data-sidebar-mask]))')
          if (column !== sidebar) {
            sidebar = column
            observer.disconnect()
            observer.observe(frame, { childList: true, attributes: true, attributeFilter: ['data-sidebar-collapsed'] })
            if (sidebar) observer.observe(sidebar, { childList: true, subtree: true })
          }
          const workspace = sidebar?.querySelector('[data-slot="sidebar.workspaces"]')
          if (workspace) {
            if (target.nextElementSibling !== workspace) workspace.before(target)
            setMount(target)
          } else {
            target.remove()
            // 只有展开的侧栏缺少工作区座位时才回退到顶部。原生折叠不改变布局偏好。
            setMount(frame.hasAttribute('data-sidebar-collapsed') ? null : 'horizontal')
          }
        }
        const observer = new MutationObserver(sync)
        sync()
        return () => {
          observer.disconnect()
          target.remove()
          setMount(null)
        }
      }, [enabled, rootRef])
      return mount
    }

    // ── 标签栏 ──────────────────────────────────────────────────────────────
    function createTabBars(actions) {
      function TabBar(props) {
        const {
          orientation, rows, statuses, panelById, workspaceBadges, workspaceGroupItems, orderedTabs,
          visualActiveId, emptyPanel, requestSelect, t,
        } = props
        const vertical = orientation === 'vertical'
        const groupStorageKey = vertical ? SIDEBAR_GROUPS_KEY : COLLAPSED_GROUPS_KEY
        const [menu, setMenu] = useState(null)
        const [sidebarOpen, setSidebarOpen] = useState(true)
        const [collapsedGroups, setCollapsedGroups] = useState(() => readCollapsedGroups(groupStorageKey))
        const toggleCollapsedGroup = useCallback((workspaceId) => {
          setCollapsedGroups((previous) => {
            const next = new Set(previous)
            if (next.has(workspaceId)) next.delete(workspaceId)
            else next.add(workspaceId)
            writeCollapsedGroups(groupStorageKey, next)
            return next
          })
        }, [groupStorageKey])
        const tabs = workspaceGroupItems.flatMap((item) => {
          if (item.kind === 'tab') return [item.tab]
          return collapsedGroups.has(item.group.workspaceId) ? [] : item.group.tabs
        })
        const focusId = tabs.some((tab) => tab.id === visualActiveId) ? visualActiveId : tabs[0]?.id
        const pinnedCount = tabs.filter((tab) => tab.pinned).length
        const bucketById = new Map()
        for (const item of workspaceGroupItems) {
          if (item.kind === 'tab') {
            bucketById.set(item.tab.id, 'plain')
            continue
          }
          const bucket = `workspace:${item.group.workspaceId}`
          for (const tab of item.group.tabs) bucketById.set(tab.id, bucket)
        }

        const stripRef = useRef(null)
        const barRef = useRef(null)

        useEffect(() => {
          const bar = barRef.current
          const strip = stripRef.current
          const axis = vertical ? 'scrollTop' : 'scrollLeft'
          const onWheel = (event) => {
            if (!event.cancelable || event.defaultPrevented || event.ctrlKey || event.deltaY === 0) return
            if (vertical) {
              if (!strip.contains(event.target) || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
            } else if (event.deltaX !== 0) {
              return // 保留触控板的原生横向输入。
            }
            const visibleSize = vertical ? strip.clientHeight : strip.clientWidth
            if ((vertical ? strip.scrollHeight : strip.scrollWidth) <= visibleSize) return
            const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? visibleSize : 1
            const previous = strip[axis]
            strip[axis] += event.deltaY * unit
            // 原生侧栏也处理滚轮。左侧标签滚到边缘后，交还给工作区树。
            if (!vertical || strip[axis] !== previous) event.preventDefault()
          }
          bar.addEventListener('wheel', onWheel, { passive: false })
          return () => bar.removeEventListener('wheel', onWheel)
        }, [vertical])

        // ── 拖拽排序 ────────────────────────────────────────────────────────
        const [dragState, setDragState] = useState(null)
        const dragRef = useRef(null)
        const dragCleanupRef = useRef(null)
        const selectGuardRef = useRef(0)
        useEffect(
          () => () => {
            if (dragCleanupRef.current !== null) dragCleanupRef.current()
          },
          [],
        )
        const onTabSelect = useCallback(
          (id) => {
            if (performance.now() < selectGuardRef.current) return
            requestSelect(id)
          },
          [requestSelect],
        )
        const beginDrag = (event, id, pinned) => {
          if (event.button !== 0 || dragCleanupRef.current !== null) return
          // 前一次拖拽只屏蔽松手生成的 click。新的按下意味着一次独立点击。
          selectGuardRef.current = 0
          const strip = stripRef.current
          if (strip === null) return
          const dragBucket = bucketById.get(id) ?? 'plain'
          const positionOf = (pointer) => vertical ? pointer.clientY : pointer.clientX
          const candidates = tabs
            .filter((tab) => tab.pinned === pinned && (bucketById.get(tab.id) ?? 'plain') === dragBucket)
            .map((tab) => {
              const element = strip.querySelector(`[data-session-id="${tab.id}"]`)
              if (element === null) return null
              const rect = element.getBoundingClientRect()
              return { id: tab.id, mid: vertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2 }
            })
            .filter((candidate) => candidate !== null)
          if (candidates.length < 2) return
          dragRef.current = { id, pinned, start: positionOf(event), moved: false, candidates, drop: null }
          const stop = () => {
            if (dragCleanupRef.current !== stop) return
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp, true)
            window.removeEventListener('pointercancel', onCancel, true)
            window.removeEventListener('blur', onCancel)
            document.removeEventListener('keydown', onKeyDown, true)
            dragCleanupRef.current = null
          }
          const onCancel = () => {
            stop()
            dragRef.current = null
            setDragState(null)
          }
          const onKeyDown = (keyEvent) => {
            if (keyEvent.key === 'Escape') {
              keyEvent.preventDefault()
              onCancel()
            }
          }
          const onMove = (moveEvent) => {
            const drag = dragRef.current
            if (drag === null) return
            const position = positionOf(moveEvent)
            if (!drag.moved) {
              if (Math.abs(position - drag.start) < 5) return
              drag.moved = true
              selectGuardRef.current = performance.now() + 500
            }
            if (moveEvent.cancelable) moveEvent.preventDefault()
            const remaining = drag.candidates.filter((candidate) => candidate.id !== drag.id)
            if (remaining.length === 0) return
            const insertIndex = remaining.findIndex((candidate) => position < candidate.mid)
            const reference = insertIndex < 0 ? remaining[remaining.length - 1] : remaining[insertIndex]
            const place = insertIndex < 0 ? 'after' : 'before'
            const previous = drag.drop
            if (previous === null || previous.referenceId !== reference.id || previous.place !== place) {
              drag.drop = { referenceId: reference.id, place }
              setDragState({ id: drag.id, referenceId: reference.id, place })
            }
          }
          const onUp = () => {
            const drag = dragRef.current
            stop()
            dragRef.current = null
            setDragState(null)
            if (drag === null || !drag.moved || drag.drop === null) return
            try {
              if (drag.pinned) actions.store.movePinned(drag.id, drag.drop.referenceId, drag.drop.place)
              else actions.store.moveUnpinned(drag.id, drag.drop.referenceId, drag.drop.place)
            } catch (error) {
              console.error('dsh-tab: reordering tabs failed', error)
            }
          }
          dragCleanupRef.current = stop
          window.addEventListener('pointermove', onMove, { passive: false })
          window.addEventListener('pointerup', onUp, true)
          window.addEventListener('pointercancel', onCancel, true)
          window.addEventListener('blur', onCancel)
          document.addEventListener('keydown', onKeyDown, true)
        }

        // 当前标签滚入可见范围（只滚标签条自身，不滚页面）；切换标签时平滑滚动，
        // 标签条因侧栏拖动变宽变窄时直接对齐。
        useEffect(() => {
          const strip = stripRef.current
          if (strip === null || (vertical && !sidebarOpen)) return undefined
          const reduceMotion =
            typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
          const revealActive = (smooth) => {
            const active = strip.querySelector('[aria-selected="true"]')
            if (active === null) return
            // 工作区组是定位容器。用视口坐标换算，组内外标签都按同一滚动条计算。
            const bounds = active.getBoundingClientRect()
            const viewport = strip.getBoundingClientRect()
            const visibleSize = vertical ? strip.clientHeight : strip.clientWidth
            if (visibleSize === 0) return
            const axis = vertical ? 'scrollTop' : 'scrollLeft'
            const position = strip[axis]
            const start = position + (vertical ? bounds.top - viewport.top : bounds.left - viewport.left)
            const end = start + (vertical ? bounds.height : bounds.width)
            let target = position
            if (start < position) target = Math.max(0, start - 8)
            else if (end > position + visibleSize) target = end - visibleSize + 8
            if (Math.abs(target - position) < 1) return
            if (!smooth || reduceMotion || typeof strip.scrollTo !== 'function') strip[axis] = target
            else strip.scrollTo({ [vertical ? 'top' : 'left']: target, behavior: 'smooth' })
          }
          revealActive(true)
          if (typeof ResizeObserver !== 'function') return undefined
          const observer = new ResizeObserver(() => revealActive(false))
          observer.observe(strip)
          return () => observer.disconnect()
        }, [visualActiveId, tabs.length, vertical, sidebarOpen])

        // 标签栏在 shell.overlay 里绝对定位：左边缘跟住左栏宽度（左栏折叠时为 0，
        // 桌面端折叠侧栏时由 CSS 的 clearance 变量继续右移，避开窗口按钮）
        useEffect(() => {
          if (vertical) return
          const bar = barRef.current
          const overlay = bar === null ? null : bar.closest('[data-shell-overlay]')
          const frame = overlay === null ? null : overlay.parentElement
          if (frame === null) return undefined
          let sidebarCol = null
          const resolveSidebarCol = () => {
            const sidebarSlot = document.querySelector('[data-slot="sidebar"]')
            if (sidebarSlot === null) return null
            return [...frame.children].find((el) => el.contains(sidebarSlot)) ?? null
          }
          const sync = () => {
            if (sidebarCol !== null && !sidebarCol.isConnected) sidebarCol = null
            if (sidebarCol === null) {
              sidebarCol = resolveSidebarCol()
              if (sidebarCol !== null && observer !== undefined) observer.observe(sidebarCol)
            }
            const width = sidebarCol === null ? 0 : sidebarCol.getBoundingClientRect().width
            bar.style.setProperty('--dsh-tab-left', `${Math.round(width)}px`)
          }
          let observer
          if (typeof ResizeObserver === 'function') {
            observer = new ResizeObserver(sync)
            observer.observe(frame)
          }
          sidebarCol = resolveSidebarCol()
          if (sidebarCol !== null && observer !== undefined) observer.observe(sidebarCol)
          sync()
          // 座位可能比 sidebar 晚挂载：补几次重试，避免左缘永远算成 0
          const retryTimers = [100, 500, 1500].map((delay) => setTimeout(sync, delay))
          return () => {
            for (const timer of retryTimers) clearTimeout(timer)
            if (observer !== undefined) observer.disconnect()
          }
        }, [vertical])

        // 菜单指向的标签被关掉 / 归档后自动收起
        useEffect(() => {
          if (menu === null) return
          if (!tabs.some((tab) => tab.id === menu.tabId)) setMenu(null)
        }, [menu, tabs])

        const dismissMenu = useCallback(() => setMenu(null), [])
        const openMenu = useCallback((event, tabId) => {
          event.preventDefault()
          event.stopPropagation()
          const trigger = event.currentTarget.closest('[role="tab"]')
          setMenu({ x: event.clientX, y: event.clientY, tabId, trigger, step: 'list', error: undefined })
        }, [])

        const menuTabIndex = menu === null ? -1 : tabs.findIndex((tab) => tab.id === menu.tabId)
        const menuTab = menuTabIndex < 0 ? undefined : tabs[menuTabIndex]
        const menuTabIsPanel = menuTab !== undefined && isPanelTab(menuTab.id)

        const runMenu = (fn) => () => {
          dismissMenu()
          fn()
        }

        const startArchive = (stopActivity) => {
          if (menu === null) return
          const tabId = menu.tabId
          setMenu((current) => (current === null ? current : { ...current, step: 'busy', error: undefined }))
          actions.archive(tabId, stopActivity).then((result) => {
            if (result.ok) {
              setMenu((current) => (current !== null && current.tabId === tabId ? null : current))
              return
            }
            setMenu((current) =>
              current !== null && current.tabId === tabId ? { ...current, step: 'error', error: result.message } : current,
            )
          })
        }

        // 方向键在标签之间移动并激活（自动激活式 tablist）。
        // 切换会话后官方会把焦点交给输入框，所以这里延后一两帧把焦点抢回标签。
        const focusRelative = (id, direction) => {
          if (tabs.length < 2) return
          const index = tabs.findIndex((tab) => tab.id === id)
          if (index < 0) return
          const target = tabs[(index + direction + tabs.length) % tabs.length]
          if (target === undefined) return
          requestSelect(target.id)
          const focusTarget = () => {
            const strip = stripRef.current
            if (strip === null) return
            const element = strip.querySelector(`[data-session-id="${target.id}"]`)
            if (element !== null && typeof element.focus === 'function') element.focus({ preventScroll: true })
          }
          focusTarget()
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
              focusTarget()
              setTimeout(focusTarget, 60)
            })
          }
        }

        let menuHint
        let menuItems = []
        if (menu !== null) {
          if (menu.step === 'busy') {
            menuHint = t('menu.archiveBusy')
          } else if (menu.step === 'error') {
            menuHint = t('menu.archiveFailed', { message: menu.error ?? '' })
            menuItems = [
              { key: 'retry-stop', label: t('menu.retryStop'), danger: true, run: () => startArchive(true) },
              { key: 'cancel', label: t('menu.cancel'), run: dismissMenu },
            ]
          } else if (menu.step === 'archive-confirm') {
            menuHint = t('menu.archiveRunning')
            menuItems = [
              { key: 'archive-stop', label: t('menu.archiveStop'), danger: true, run: () => startArchive(true) },
              { key: 'cancel', label: t('menu.cancel'), run: dismissMenu },
            ]
          } else if (menuTab !== undefined) {
            const following = orderedTabs.slice(orderedTabs.findIndex((tab) => tab.id === menuTab.id) + 1)
            const otherCount = orderedTabs.filter((tab) => tab.id !== menuTab.id && !tab.pinned).length
            menuItems = [
              { key: 'close', label: t('menu.close'), run: runMenu(() => actions.closeOne(menuTab.id, orderedTabs)) },
              {
                key: 'close-right',
                label: t(vertical ? 'menu.closeBelow' : 'menu.closeRight'),
                disabled: following.length === 0,
                run: runMenu(() => actions.closeFollowing(menuTab.id, following)),
              },
              {
                key: 'close-others',
                label: t('menu.closeOthers'),
                disabled: otherCount === 0,
                run: runMenu(() => actions.closeOthers(menuTab.id)),
              },
              { key: 'sep-1', separator: true },
              { key: 'close-all', label: t('menu.closeAll'), run: runMenu(() => actions.closeAll()) },
              { key: 'sep-2', separator: true },
              menuTab.pinned
                ? { key: 'unpin', label: t('menu.unpin'), run: runMenu(() => actions.unpin(menuTab.id)) }
                : { key: 'pin', label: t('menu.pin'), run: runMenu(() => actions.pin(menuTab.id)) },
              ...(menuTabIsPanel
                ? []
                : [
                    { key: 'sep-3', separator: true },
                    {
                      key: 'archive',
                      label: t('menu.archive'),
                      danger: true,
                      run: runMenu(() => {
                        const status = statuses?.get(menuTab.id)
                        const busy =
                          status?.running === true ||
                          (status?.pendingInteraction !== undefined && status?.pendingInteraction !== null)
                        if (busy)
                          setMenu({
                            ...menu,
                            step: 'archive-confirm',
                            error: undefined,
                          })
                        else startArchive(false)
                      }),
                    },
                  ]),
            ]
          }
        }

        return h(
          React.Fragment,
          null,
          h(
            'div',
            {
              ref: barRef,
              className: 'dsh-tab-pagebar',
              'data-dsh-tab-bar': '',
              'data-orientation': orientation,
              'data-tabs': String(tabs.length),
              'data-empty': tabs.length === 0 ? 'true' : 'false',
              'data-main-empty': emptyPanel ? 'true' : undefined,
              'data-window-drag': vertical ? undefined : '',
            },
            vertical ? h(
              'button',
              {
                type: 'button',
                className: 'dsh-tab-pagebar__heading',
                'aria-expanded': sidebarOpen,
                onClick: () => setSidebarOpen((previous) => !previous),
              },
              h(sidebarOpen ? IconChevronDownOutlineRegular : IconChevronRightOutlineRegular, { size: 12, 'aria-hidden': true }),
              t('tab.sidebar'),
            ) : null,
            h(
              'div',
              {
                key: 'strip',
                ref: stripRef,
                className: 'dsh-tab-pagebar__strip',
                role: 'tablist',
                'aria-label': t(vertical ? 'tab.sidebarList' : 'tab.list'),
                'aria-orientation': orientation,
                hidden: vertical && !sidebarOpen,
              },
              (() => {
                const orderIndex = new Map(tabs.map((tab, index) => [tab.id, index]))
                const renderTab = (tab, grouped) => {
                  const panelTab = isPanelTab(tab.id)
                  const panel = panelTab ? panelById.get(panelIdOf(tab.id)) : undefined
                  const row = panelTab ? undefined : rows[tab.id]
                  const knownBadge = panelTab || grouped ? undefined : workspaceBadges.get(tab.id)
                  const cwdLabel = panelTab || grouped ? '' : basenameOf(row?.cwd)
                  const badge = grouped
                    ? null
                    : knownBadge ?? (cwdLabel.length === 0 ? null : { label: cwdLabel, hue: workspaceHue(cwdLabel) })
                  const index = orderIndex.get(tab.id) ?? 0
                  const node = h(TabItem, {
                    key: tab.id,
                    id: tab.id,
                    active: tab.id === visualActiveId,
                    tabIndex: tab.id === focusId ? 0 : -1,
                    vertical,
                    blank: panelTab ? false : row?.blank === true,
                    pinned: tab.pinned,
                    panel: panelTab,
                    grouped: grouped === true,
                    badge,
                    dragging: dragState !== null && dragState.id === tab.id,
                    drop: dragState !== null && dragState.referenceId === tab.id ? dragState.place : null,
                    title: panelTab
                      ? panel?.label ?? panelIdOf(tab.id)
                      : row?.blank === true
                        ? t('tab.newSession')
                        : row?.displayTitle || row?.title || t('tab.untitled'),
                    signal: panelTab ? undefined : sessionStatusSignal(statuses?.get(tab.id)),
                    t,
                    onSelect: onTabSelect,
                    onClose: (id) => actions.closeOne(id, orderedTabs),
                    onMenu: openMenu,
                    onArrow: focusRelative,
                    onDragStart: (event) => beginDrag(event, tab.id, tab.pinned),
                  })
                  const isLastPinned = tab.pinned && index === pinnedCount - 1 && tabs.length > pinnedCount
                  return isLastPinned
                    ? [node, h('span', { key: 'divider', className: 'dsh-tab-pagebar__divider', 'aria-hidden': true })]
                    : [node]
                }
                return workspaceGroupItems.flatMap((item) => {
                  if (item.kind === 'tab') return renderTab(item.tab, false)
                  const group = item.group
                  const collapsed = collapsedGroups.has(group.workspaceId)
                  const groupActive = group.tabs.some((tab) => tab.id === visualActiveId)
                  return h(
                    'div',
                    {
                      key: `workspace:${group.workspaceId}`,
                      className: 'dsh-tab-pagebar__group',
                      role: 'group',
                      'data-tab-group': group.workspaceId,
                      'data-collapsed': collapsed ? 'true' : 'false',
                      'data-active': groupActive ? 'true' : 'false',
                      'aria-label': t('tab.workspaceGroupTip', { name: group.label, n: group.tabs.length }),
                      style: { '--dsh-tab-group-hue': String(group.hue) },
                    },
                    h(
                      'button',
                      {
                        key: 'chip',
                        type: 'button',
                        className: 'dsh-tab-pagebar__group-chip',
                        title: collapsed
                          ? t('tab.workspaceGroupExpand', { name: group.label })
                          : t('tab.workspaceGroupCollapse', { name: group.label }),
                        'aria-expanded': collapsed ? 'false' : 'true',
                        onPointerDown: (event) => event.stopPropagation(),
                        onClick: (event) => {
                          event.stopPropagation()
                          toggleCollapsedGroup(group.workspaceId)
                        },
                      },
                      h('span', { key: 'name', className: 'dsh-tab-pagebar__group-name' }, group.label),
                      collapsed
                        ? h('span', { key: 'count', className: 'dsh-tab-pagebar__group-count' }, String(group.tabs.length))
                        : null,
                      collapsed && groupActive
                        ? h('span', { key: 'active', className: 'dsh-tab-pagebar__group-dot', 'aria-hidden': true })
                        : null,
                    ),
                    ...(collapsed ? [] : group.tabs.flatMap((tab) => renderTab(tab, true))),
                  )
                })
              })(),
            ),
            vertical ? null : h(
              'button',
              {
                key: 'new',
                type: 'button',
                className: 'dsh-tab-pagebar__new',
                title: t('tab.new'),
                'aria-label': t('tab.new'),
                onClick: actions.create,
              },
              h(IconNewChat),
            ),
          ),
          menu === null
            ? null
            : createPortal(h(TabMenu, {
                key: 'menu',
                x: menu.x,
                y: menu.y,
                hint: menuHint,
                items: menuItems,
                trigger: menu.trigger,
                onClose: dismissMenu,
              }), document.body),
        )
      }

      return function TabBars(props) {
        const { useSessions, useSessionStatus, useWorkspaces, usePanelInfo, t } = props
        const catalog = useSessions((state) => state)
        const statuses = useSessionStatus((state) => state)
        const workspaces = useWorkspaces((state) => state)
        const snapshot = useSyncExternalStore(actions.store.subscribe, actions.store.getSnapshot)

        const rows = catalog?.byId ?? {}
        const archived = useMemo(() => new Set(workspaces?.archivedSessionIds ?? []), [workspaces])
        const activeId = currentSessionIdOf(catalog)

        // 全局面板（插件 / 自动化任务 …）：选中项来自官方 layout.panelInfo，
        // 面板清单与标题来自 sidebar.panellist 槽条目（由 apply 里同步进 panelStore）。
        const panels = useSyncExternalStore(actions.panelStore.subscribe, actions.panelStore.getSnapshot)
        const usePanelInfoHook = typeof usePanelInfo === 'function' ? usePanelInfo : useNoPanelInfo
        const activePanelId = usePanelInfoHook((info) => info.activePanelId) ?? null
        const emptyPanel = activePanelId === EMPTY_PANEL_ID
        const activePanelKey = activePanelId === null || emptyPanel ? null : panelTabKey(activePanelId)
        const visibleSessionId = activePanelId === null ? activeId : undefined
        const activeTabId = activePanelKey ?? visibleSessionId
        const panelById = useMemo(() => new Map(panels.list.map((panel) => [panel.id, panel])), [panels.list])
        useLayoutEffect(() => {
          actions.setView({
            activePanelId,
            panelList: panels.list,
            panelsReady: panels.ready,
          })
        }, [activePanelId, panels])

        // 会话 → 所属工作区（角标用）。工作区标题为空时用目录名，再退到 workspaceId。
        const workspaceBadges = useMemo(() => {
          const map = new Map()
          for (const item of workspaces?.items ?? []) {
            const title = typeof item.title === 'string' && item.title.trim().length > 0 ? item.title.trim() : ''
            const label = title || basenameOf(item.path) || (item.workspaceId === undefined ? '' : String(item.workspaceId))
            if (label.length === 0) continue
            const hue = workspaceHue(item.workspaceId === undefined ? label : String(item.workspaceId))
            for (const sessionId of item.sessionIds ?? []) {
              if (!map.has(sessionId)) map.set(sessionId, { workspaceId: item.workspaceId, label, hue })
            }
          }
          return map
        }, [workspaces])

        // 草稿是否入签由原生输入状态决定。空白面板期间清理抑制标记，允许侧栏重开同一会话。
        useLayoutEffect(() => {
          actions.store.pruneSuppressed(emptyPanel ? undefined : activeId)
          return actions.observeSessionTabs(visibleSessionId, archived)
        }, [actions, activeId, archived, catalog, emptyPanel, visibleSessionId, snapshot.settings.closeDraftTabs])

        const flatTabs = displayTabs(snapshot).filter((tab) => {
          if (isPanelTab(tab.id)) return panels.ready ? panelById.has(panelIdOf(tab.id)) : true
          return rows[tab.id] !== undefined && !archived.has(tab.id)
        })
        const workspaceGroupItems = groupTabsByWorkspace(flatTabs, workspaceBadges)
        const orderedTabs = workspaceGroupItems.flatMap((item) => item.kind === 'tab' ? [item.tab] : item.group.tabs)
        // 打开全局面板时给它一个独立标签（已有则复用）；面板注销后摘掉对应标签。
        useLayoutEffect(() => {
          if (activePanelKey === null) return
          if (!actions.store.has(activePanelKey)) actions.store.add(activePanelKey)
        }, [activePanelKey])
        useEffect(() => {
          if (!panels.ready) return
          const keys = new Set(panels.list.map((panel) => panelTabKey(panel.id)))
          const stale = actions.store.getSnapshot().ids.filter((id) => isPanelTab(id) && !keys.has(id))
          if (stale.length > 0) actions.store.removeMany(stale)
        }, [panels])

        const rootRef = useRef(null)
        const { showHorizontal, showVertical } = snapshot.settings
        const sidebarMount = useSidebarMount(showVertical, rootRef)
        const showTop = showHorizontal || (showVertical && sidebarMount === 'horizontal')
        const shared = {
          rows, statuses, panelById, workspaceBadges, workspaceGroupItems, orderedTabs, emptyPanel, t,
          visualActiveId: activeTabId,
          requestSelect(id) {
            if (id !== activeTabId) actions.activate(id)
          },
        }

        return h(
          React.Fragment,
          null,
          h('span', { ref: rootRef, hidden: true }),
          h('style', { 'data-plugin': NS, 'data-plugin-css': 'dsh-tab/frame.css' },
            (showTop ? FRAME_CSS : '') + EMPTY_FRAME_CSS,
          ),
          h('style', null, CSS + (showVertical ? SIDEBAR_CSS : '')),
          showTop ? h(TabBar, { ...shared, orientation: 'horizontal' }) : null,
          showVertical && sidebarMount !== null && sidebarMount !== 'horizontal'
            ? createPortal(h(TabBar, { ...shared, orientation: 'vertical' }), sidebarMount)
            : null,
        )
      }
    }

    // ── 插件入口 ────────────────────────────────────────────────────────────
    return {
      inject: ['slots', 'locale', 'sessions', 'uiWorkspace', 'workspaces', 'layout'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'dsh-tab: dictionaries')

        const sessions = ctx.sessions
        const uiWorkspace = ctx.uiWorkspace
        const layout = ctx.layout
        const store = createTabStore()

        // 侧栏「全局面板」清单：sidebar.panellist 的条目就是可打开的面板（id + 本地化标题）。
        const createPanelStore = () => {
          let snapshot = Object.freeze({ ready: false, list: Object.freeze([]) })
          const listeners = new Set()
          return {
            subscribe(listener) {
              listeners.add(listener)
              return () => listeners.delete(listener)
            },
            getSnapshot() {
              return snapshot
            },
            setList(list) {
              snapshot = Object.freeze({ ready: true, list: Object.freeze(list.slice()) })
              for (const listener of [...listeners]) listener()
            },
          }
        }
        const panelStore = createPanelStore()
        const resolvePanelLabel = (label) => (typeof label === 'function' ? label() : label)
        const syncPanels = () => {
          try {
            const list = ctx.slots
              .entriesOfSlot('sidebar.panellist')
              .map(({ options }) => ({
                id: options.id,
                order: options.order ?? 0,
                label: resolvePanelLabel(options.label) ?? options.id,
              }))
              .sort((left, right) => left.order - right.order)
            panelStore.setList(list)
          } catch (error) {
            console.error('dsh-tab: reading global panels failed', error)
          }
        }
        ctx.effect(() => {
          syncPanels()
          const offPanels = ctx.slots.subscribe('sidebar.panellist', syncPanels)
          const offLocale = ctx.locale.subscribe(syncPanels)
          return () => {
            offPanels()
            offLocale()
          }
        }, 'dsh-tab: global panel entries')

        // 组件把当前视图态同步进来，关闭操作据此判断「正在显示的标签」是会话还是面板。
        const viewState = { activePanelId: null, panelList: [], panelsReady: false }

        /** 当前显示顺序（与渲染层同一套过滤规则，供关闭操作计算左右邻位）。 */
        const tabsNow = () => {
          const catalog = sessions.list.getSnapshot()
          const rows = catalog?.byId ?? {}
          const archived = new Set(ctx.workspaces.list.getSnapshot().archivedSessionIds ?? [])
          const panelKeys = new Set(viewState.panelList.map((panel) => panelTabKey(panel.id)))
          return displayTabs(store.getSnapshot()).filter((tab) => {
            if (isPanelTab(tab.id)) return viewState.panelsReady ? panelKeys.has(tab.id) : true
            return rows[tab.id] !== undefined && !archived.has(tab.id)
          })
        }

        const inputStateFor = (id) => {
          const binding = sessions.binding?.(id)
          return binding === undefined ? undefined : ctx.get('conversation')?.input?.for(binding.ctx).state
        }

        /** 旧版本的后台空白标签没有草稿标记，通过 DSH 读取本地草稿，无需打开远端会话。 */
        const readStoredDraft = (id) => {
          const input = inputStateFor(id)
          if (input !== undefined) return input.getSnapshot()
          const resolver = ctx.get('conversation')?.input
          if (resolver === undefined) return undefined
          const reference = sessions.retain(id, { source: NS, connection: false })
          try {
            return resolver.for(reference.binding.ctx).state.getSnapshot()
          } finally {
            reference.release()
          }
        }

        /** 订阅当前原生输入框。草稿内容由 DSH 持有，插件只记录相应的标签。 */
        const observeSessionTabs = (visibleId, archived) => {
          const { byId } = sessions.list.getSnapshot()
          const input = visibleId !== undefined && byId[visibleId]?.blank === true ? inputStateFor(visibleId) : undefined
          const pending = new Map()
          const { ids, settings } = store.getSnapshot()
          if (settings.closeDraftTabs) {
            for (const id of ids) {
              if (id === visibleId || byId[id]?.blank !== true) continue
              const source = inputStateFor(id)
              if (draftIsSubmitting(source?.getSnapshot())) pending.set(id, source)
            }
          }
          const sync = () => {
            const catalog = sessions.list.getSnapshot()
            if (catalog?.phase !== 'ready') return
            const { ids, settings } = store.getSnapshot()
            const rows = catalog.byId
            const stale = ids.filter((id) => {
              if (isPanelTab(id)) return false
              if (rows[id] === undefined || archived.has(id)) return true
              if (rows[id].blank !== true) {
                if (store.hasDraft(id)) store.add(id)
                return false
              }
              if (id === visibleId) return false
              // 首条消息还在提交时，目录仍将其标为 blank。等原生输入状态结算再决定是否摘签。
              if (settings.closeDraftTabs) return !draftIsSubmitting(pending.get(id)?.getSnapshot())
              if (store.hasDraft(id)) return false
              const draft = readStoredDraft(id)
              const hasText = draftHasText(draft)
              if (!hasText && !(draft?.attachmentIds?.length > 0)) return true
              store.add(id, hasText)
              return false
            })
            store.removeMany(stale)
            const visible = visibleId === undefined ? undefined : rows[visibleId]
            if (visible === undefined || archived.has(visibleId)) return
            const draft = visible.blank === true ? input?.getSnapshot() : undefined
            if (store.isSuppressed(visibleId, draft)) return
            if (visible.blank !== true) {
              store.add(visibleId)
              return
            }
            const hasText = draftHasText(draft)
            if (hasText || (draft?.attachmentIds?.length ?? 0) > 0) {
              store.add(visibleId, hasText)
            } else if (draft !== undefined ? !draftIsSubmitting(draft) : !store.hasDraft(visibleId)) {
              store.removeMany([visibleId])
            }
          }
          const stops = [...pending.values()].map((source) => source.subscribe(sync))
          if (input !== undefined) stops.push(input.subscribe(sync))
          sync()
          return () => {
            for (const stop of stops) stop()
          }
        }

        /** 切到某个标签：会话标签走 openSession，面板标签走 layout.selectPanel。 */
        const activate = (id) => {
          if (isPanelTab(id)) {
            try {
              layout.selectPanel(panelIdOf(id))
            } catch (error) {
              console.error('dsh-tab: switching to global panel failed', error)
            }
            return
          }
          try {
            const current = currentSessionIdOf(sessions.list.getSnapshot())
            // 同一个会话在面板页下面时，只需要把面板收回、露出会话。
            if (current === id) {
              layout.selectPanel(null)
              return
            }
            uiWorkspace.openSession(id)
          } catch (error) {
            console.error('dsh-tab: switching conversation failed', error)
          }
        }

        /** 关掉一批标签后优先切到邻签。没有剩余标签时按设置决定主区的去向。 */
        const closeIds = (idsToClose, nextId) => {
          if (idsToClose.length === 0) return
          const catalog = sessions.list.getSnapshot()
          const current = currentSessionIdOf(catalog)
          const currentRow = current === undefined ? undefined : catalog?.byId?.[current]
          const activePanelId = viewState.activePanelId
          const activePanelKey = activePanelId === null || activePanelId === EMPTY_PANEL_ID ? null : panelTabKey(activePanelId)
          const activeKey = activePanelKey ?? (current === undefined ? null : current)
          for (const id of idsToClose) {
            if (isPanelTab(id)) continue
            const draft = id === current && currentRow?.blank === true ? inputStateFor(id)?.getSnapshot() : undefined
            store.suppress(id, draft)
          }
          store.removeMany(idsToClose)
          const remaining = tabsNow()
          if (remaining.length === 0 && !store.getSnapshot().settings.reopenAfterClose) {
            layout.selectPanel(EMPTY_PANEL_ID)
            return
          }
          if (activeKey === null || !idsToClose.includes(activeKey)) return
          if (nextId !== undefined && store.has(nextId) && nextId !== activeKey) {
            activate(nextId)
            return
          }
          if (remaining.length > 0) {
            activate(remaining[0].id)
            return
          }
          // 从面板返回下方的会话。确认关掉的草稿标签仍然保持关闭。
          if (activePanelKey !== null && current !== undefined) {
            if (currentRow?.blank !== true) store.unsuppress(current)
            layout.selectPanel(null)
            return
          }
          // 当前已是原生编辑器时，DSH 会复用同一个空白会话，直接保留编辑器即可。
          if (currentRow?.blank !== true) uiWorkspace.startSession()
        }

        const actions = {
          store,
          panelStore,
          observeSessionTabs,
          setView(next) {
            viewState.activePanelId = next.activePanelId
            viewState.panelList = next.panelList
            viewState.panelsReady = next.panelsReady
          },
          activate,
          select(id) {
            activate(id)
          },
          closeOne(id, tabs) {
            try {
              const index = tabs.findIndex((tab) => tab.id === id)
              const next = tabs[index + 1]?.id ?? tabs[index - 1]?.id
              closeIds([id], next)
            } catch (error) {
              console.error('dsh-tab: closing tab failed', error)
            }
          },
          closeFollowing(id, following) {
            try {
              closeIds(following.map((tab) => tab.id), id)
            } catch (error) {
              console.error('dsh-tab: closing following tabs failed', error)
            }
          },
          closeOthers(id) {
            try {
              const closing = tabsNow().filter((tab) => tab.id !== id && !tab.pinned).map((tab) => tab.id)
              closeIds(closing, id)
            } catch (error) {
              console.error('dsh-tab: closing other tabs failed', error)
            }
          },
          closeAll() {
            try {
              const all = store.getSnapshot().ids
              closeIds(all, undefined)
            } catch (error) {
              console.error('dsh-tab: closing all tabs failed', error)
            }
          },
          pin(id) {
            store.pin(id)
          },
          unpin(id) {
            store.unpin(id)
          },
          archive(sessionId, stopActivity) {
            return uiWorkspace
              .archiveSession(sessionId, stopActivity === true ? { stopActivity: true } : undefined)
              .then(() => {
                store.suppress(sessionId)
                store.removeMany([sessionId])
                return { ok: true }
              })
              .catch((error) => {
                console.error('dsh-tab: archiving conversation failed', error)
                return { ok: false, message: errorMessageOf(error) }
              })
          },
          create() {
            try {
              const catalog = sessions.list.getSnapshot()
              const current = currentSessionIdOf(catalog)
              if (current !== undefined && catalog.byId?.[current]?.blank === true) store.unsuppress(current)
              uiWorkspace.startSession()
            } catch (error) {
              console.error('dsh-tab: creating conversation failed', error)
            }
          },
        }

        const TabBars = createTabBars(actions)
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: EMPTY_PANEL_ID },
          () => h('div', { 'data-dsh-tab-empty-main': '' }),
        ))
        const TabSettings = createTabSettings(store)
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name: 'plugins.bundle.config', key: NS, locale: NS }, TabSettings))
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'dsh-tab-bar',
              order: -100,
              locale: NS,
            },
            TabBars,
          ),
        )
      },
    }
  },
})
