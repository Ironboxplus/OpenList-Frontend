# Development Journal

## 2026-05-26 — Movi Player 集成 + 前端同步

### 1. 前端仓库同步

本地 `main` 与 `ironbox/main` 已分叉（相同 4 个自定义 commit，hash 不同因 rebase）。`git pull --rebase ironbox main` 同步完成，本地 `main` 与 `ironbox/main` 一致。

删除了不再使用的 `.github/workflows/sync_repo.yml`（Gitee 镜像同步 workflow），commit `e5a0ba4`。

### 2. Movi Player 集成

#### 目标

将 [movi-player](https://github.com/MrUjjwalG/movi-player) 作为视频播放第二选项加入前端，利用其 FFmpeg WASM + WebCodecs 能力播放 Artplayer 原生不支持的格式（MKV 内 HEVC、AV1 等）。

#### 实施步骤

1. `pnpm add movi-player` 安装依赖
2. 新建 `src/pages/home/previews/movi_video.tsx` — 封装 `<movi-player>` Web Component
3. 在 `src/pages/home/previews/index.ts` 注册，`prior: false`（Artplayer 仍为默认）
4. 在 `src/lang/en/home.json` 添加 i18n key `movi_video: "Movi Player"`

#### 遇到的问题与解决

**问题 1：`document.createElement('movi-player')` 报 NotSupportedError**

- 原因：movi-player 的 Web Component 构造函数在 `constructor()` 里设置了属性，违反 HTML spec
- 解决：改用 `innerHTML` 创建元素，绕过 `createElement` 的严格检查

**问题 2：Security Headers Missing**

- 原因：movi-player 的 WASM 需要 `SharedArrayBuffer`，要求 `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless`
- 尝试 1：在 vite.config.ts 加 headers → 只解决了前端页面，视频 fetch 跨域仍失败
- 尝试 2：在 vite.config.ts 加 `/d` 代理 → **触发 IDM 死循环捕获**（movi-player 用 fetch 下载视频，IDM 拦截每个请求）
- 尝试 3：在 vite.config.ts 加 `/p` 代理 → **仍然触发 IDM**
- 最终解决：**在后端 Go 服务器（`server/router.go`）的 `Cors()` 函数中添加 COOP/COEP middleware**，前后端同源（都在 5244 端口），彻底解决 CORS + headers 问题

**问题 3：IDM（Internet Download Manager）死循环**

- 根因：Artplayer 用 `<video src>` 标签（浏览器原生流式加载，IDM 不拦截），movi-player 用 `fetch()` 下载视频数据给 WASM 解码，IDM 拦截 fetch 请求
- 教训：**不要在 vite proxy 里代理 `/d`（下载路径）**，IDM 会捕获所有经过的大文件请求并弹出无限下载框
- 最终：vite.config.ts 不做任何 header/proxy 改动，全部由后端处理

**问题 4：前端 dist 未被后端加载**

- 现象：后端返回 "Frontend is not bundled"
- 原因：后端 config.json 的 `dist_dir` 为空
- 解决：设置 `dist_dir` 指向 `D:\tool\alist-windows-amd64\frontend_dist\dist`

**问题 5：外挂 ASS 字幕不加载**

- 现象：字幕在 UI 菜单中出现（`01.ass ()`），但选择后无请求、无显示
- 根因：movi-player 的 `selectSubtitleLang()` 只有 VTT/SRT 解析器，ASS 走 `parseVTT` 失败
- 第一次尝试：前端做 ASS→SRT blob URL 转换 → 用户指出 ASS 是矢量格式，转换丢失太多
- 最终解决：**修改 movi-player 源码**，添加 `parseASS()` 方法，原生支持 ASS 外挂字幕
  - 从 npm 包复制预编译 WASM 到源码 `dist/wasm/`
  - 只运行 `npm run build:ts` 编译 TypeScript
  - 前端改用本地路径依赖 `pnpm add ../movi-player`

**问题 6：Dolby Vision 紫色色偏**

- 现象：DV 内容画面整体紫色
- 原因：movi-player WASM 解码器无 DV enhancement layer 处理
- 状态：movi-player 架构限制，无法修复。DV 内容建议用 Artplayer 或外部播放器

### 3. 验证结果（后端同源 localhost:5244）

| 测试项        | 结果       | 测试文件                                                        |
| ------------- | ---------- | --------------------------------------------------------------- |
| MKV 播放      | ✅         | Leon.1994 (x265), SAMPLE.mkv (x265 HDR10)                       |
| AV1 解码      | ✅         | av1_recode_Leon.1994                                            |
| 多音轨检测    | ✅         | 3 条音轨（English TrueHD, English DD, Mandarin DD）             |
| 内嵌 PGS 字幕 | ✅         | SAMPLE.mkv（3 条 PGS：English SDH, French, Spanish）            |
| HDR 检测      | ✅         | 控制栏显示 HDR 按钮                                             |
| 播放器切换    | ✅         | 下拉框正确显示 Video Player / Movi Player / Video360 / Download |
| 外挂 ASS 字幕 | ✅（文本） | 1917 目录的 .ass 文件                                           |
| 零控制台错误  | ✅         |                                                                 |
| DV 内容       | ❌ 紫偏    | Wake.Up.Dead.Man（DV H.265）                                    |

### 4. 后端改动（E:\Go\Openlist\OP）

`server/router.go` — `Cors()` 函数末尾添加 COOP/COEP middleware：

```go
r.Use(func(c *gin.Context) {
    c.Header("Cross-Origin-Opener-Policy", "same-origin")
    c.Header("Cross-Origin-Embedder-Policy", "credentialless")
})
```

`D:\tool\alist-windows-amd64\data\config.json` — 设置 `dist_dir`：

```json
"dist_dir": "D:\\tool\\alist-windows-amd64\\frontend_dist\\dist"
```

从 OP 源码构建新二进制替换了 `D:\tool\alist-windows-amd64\alist.exe`。

---

### 5. 外挂字幕完整渲染 — 未完成，方案反复

#### 问题

movi-player 外挂字幕只支持 SRT/VTT 文本解析。用户要求完整支持 ASS（矢量绘图、样式、特效）和 SUP/PGS（图片字幕）。

#### 失败尝试记录

**尝试 1：movi-player 源码加 parseASS**

- 在 `MoviPlayer.ts` 添加 `parseASS()` + `parseASSTime()`
- 结果：解析出 1114 条文本 cue，但只提取纯文本，丢失所有样式/矢量绘图
- 用户拒绝：ASS 是矢量格式，strip 标签只留文本不是"原生支持"

**尝试 2：前端做 ASS→SRT 转换**

- fetch ASS 文件，JS 解析后生成 SRT blob URL 喂给 movi-player
- 用户拒绝：同样丢失样式

**尝试 3：@jellyfin/libass-wasm (SubtitlesOctopus) canvas 模式**

- 项目已有此依赖（Artplayer 的 ASS 插件在用）
- 问题：SubtitlesOctopus 的 canvas-only 模式 worker 崩溃（`Worker error: [object ErrorEvent]`），只有 video 元素模式正常
- movi-player 没有 video 元素（用 Canvas 渲染），无法使用 video 模式

**尝试 4：JASSUB + libpgs，自动加载**

- 安装 `jassub`（libass WASM 现代封装，支持 canvas-only + `manualRender`）和 `libpgs`（PGS 浏览器渲染）
- 检测到 ASS 文件时自动初始化 JASSUB overlay canvas
- 问题 1：`manualRender` 在 `ready` promise resolve 前被调用 → `_resizeCanvas` undefined 崩溃
- 修复后问题 2：overlay canvas 放在 movi-player 的 light DOM 里 → shadow DOM 覆盖，canvas 实际渲染尺寸 0x0
- 修复后问题 3：自动加载没有用户控制（无开关按钮），用户拒绝

**尝试 5：JASSUB + libpgs，拦截 movi-player CC 菜单**

- 所有字幕放 `<track>` 让 movi-player CC 菜单显示
- monkey-patch `selectSubtitleLang()`：ASS/SUP 选中时拦截，启动 JASSUB/libpgs；SRT/VTT 走原生
- 代码质量差，未测试就部署，反复出错

#### 最终解决方案 — SubtitleManager 架构（2026-05-26）

重新调研后，从头设计了系统性的方案，不修改 movi-player 源码，不 patch 任何内部方法：

**架构：**

- `SubtitleManager` 类（`subtitle-manager.ts`）管理所有外挂字幕渲染器的生命周期
- 所有字幕注册为 `<track>` 放在 movi-player light DOM → CC 菜单自然显示
- 监听 `subtitleTrackChange` DOM 事件 → 检查选中的格式 → 启动对应渲染器
- ASS: JASSUB canvas-only mode + overlay canvas（movi-player 外部 sibling）+ manualRender 同步
- SUP/PGS: libpgs + 同样的 overlay canvas + renderAtTimestamp 同步
- SRT/VTT: movi-player 原生处理
- 字幕延迟: `subtitledelaychange` 事件 → 同步到 JASSUB/libpgs timeOffset

**关键发现：**

- movi-player 对 ASS/SUP 文件尝试 VTT 解析 → 0 cues → 不会乱显示（安全）
- overlay canvas 必须放 shadow DOM 外面，作为 movi-player 的 sibling
- JASSUB 必须 `await ready` 后才能 `manualRender`
- JASSUB `transferControlToOffscreen()` 在 constructor 中调用，canvas 不能已有 context

**测试：25 个单元测试，覆盖格式检测、渲染器生命周期、延迟同步、清理幂等性**

#### 外挂字幕实际部署测试发现的问题

**问题 A：`subtitleTrackChange` 事件不触发（外挂字幕选择时）**

- Root cause：movi-player 的 `selectSubtitleLang()` 通过 `player.emit()` 发事件，但 MoviElement 只监听 `trackManager.on("subtitleTrackChange")` 转发 DOM 事件。外挂字幕选择走的是 player.emit，不经过 trackManager，所以 DOM 事件不触发。
- 解决：改用轮询 `getSubtitleLangs()` 每 500ms 检测 active track 变化，替代事件监听。

**问题 B：ResizeObserver 修改 canvas 尺寸导致崩溃**

- Root cause：JASSUB 在 constructor 中调用 `transferControlToOffscreen()` 拿走 canvas 控制权。之后 ResizeObserver 回调里 `canvas.width = ...` 报错 `Cannot resize canvas after call to transferControlToOffscreen()`。
- 解决：ResizeObserver 不再修改 canvas 尺寸，JASSUB 通过 `manualRender()` 参数自行管理。

**问题 C（BLOCKING）：JASSUB worker Comlink 通信失败**

- Root cause：**Vite 把 JASSUB worker (`jassub/dist/worker/worker.js`) 打包成 IIFE 格式。abslink 的 `expose(ASSRenderer)` 调用在 IIFE 末尾执行，但 worker 永远不响应 Comlink 消息。** `ready` promise 永远不 resolve，`startSync()` 永远不执行。
- 验证：手动创建 `new Worker('/assets/worker-ChFaa8_5.js', { name: 'jassub-worker', type: 'module' })`，发送 Comlink CONSTRUCT 消息，10 秒后超时无响应。
- 尝试 1：移除 `workerUrl` 让 Vite 默认打包 → 相同结果
- 尝试 2：用 esbuild 单独打包 worker (`--format=esm`) → worker 初始化崩溃（错误信息 `undefined`）
- 尝试 3：esbuild bundle 放 `public/static/` → Go 后端 SPA fallback 返回 HTML（`Unexpected token '<'`），因为文件不在嵌入的 dist 中

### 问题 C 最终解决过程（2026-05-27）

#### 错误尝试 1：`?worker&url` 导入 `dist/wasm/jassub-worker.js`

```typescript
// ❌ 错误：这个文件是 Emscripten WASM 模块，没有 abslink expose()
const workerUrl = (await import("jassub/dist/wasm/jassub-worker.js?worker&url"))
  .default
```

现象：Worker 加载成功，WASM 也获取到了，但 `ready` 永远不 resolve。
原因：`dist/wasm/jassub-worker.js` 只是 Emscripten 模块（`export default Module`），不包含 abslink 的 `expose(ASSRenderer)` 调用，Comlink 消息无人响应。

#### 错误尝试 2：静态路径加载原始 worker

```typescript
// ❌ 错误：同样的文件，只是换了加载方式
workerUrl: `/static/jassub/jassub-worker.js`
```

`viteStaticCopy` 复制的也是 `dist/wasm/jassub-worker.js`，同样没有 `expose()` 调用。

#### 错误尝试 3：设 `worker: { format: 'es' }`

```typescript
// vite.config.ts
worker: {
  format: "es"
}
```

原以为 worker 打包格式导致 IIFE 破坏 abslink。实际上 format 不是根因——用的 worker 文件本身就不对。

#### 根因确认：CDP 调试 + 文件审计

通过 Chrome DevTools Protocol 在生产环境执行 JS 调试：

```javascript
// 手动创建 JASSUB 实例，ready 永不 resolve
const renderer = new JASSUB({
  canvas,
  subUrl,
  workerUrl: "/static/jassub/jassub-worker.js",
})
await Promise.race([renderer.ready, timeout(8000)]) // → TIMEOUT
```

然后审计 JASSUB npm 包的文件结构：

```
jassub/dist/
├── jassub.js          ← 主库（创建 Worker，用 abslink wrap）
├── wasm/
│   ├── jassub-worker.js    ← ❌ Emscripten 模块，无 expose()
│   ├── jassub-worker.wasm
│   └── jassub-worker-modern.wasm
└── worker/
    └── worker.js           ← ✅ 真正的 worker 入口！
```

`dist/worker/worker.js` 的关键代码：

```javascript
import { expose } from "abslink/w3c"
import WASM from "../wasm/jassub-worker.js"
export class ASSRenderer {
  /* ... */
}
if (self.name === "jassub-worker") {
  expose(ASSRenderer) // ← 建立 Comlink 通信
}
```

**根因：一直在用错误的 worker 文件。`dist/wasm/jassub-worker.js` 是 Emscripten 模块，`dist/worker/worker.js` 才是包含 abslink `expose()` 的真正 worker 入口。**

#### 正确方案

```typescript
// ✅ 正确：导入 dist/worker/worker.js（有 expose 调用）
const jassubWorkerUrl = (
  await import("jassub/dist/worker/worker.js?worker&url")
).default
```

Vite 用 `?worker&url` 打包 `worker.js`，解析其 `import` 依赖（abslink、Emscripten 模块等），输出一个 self-contained 的 ES module worker bundle。JASSUB 创建 Worker 时使用 `{ name: 'jassub-worker', type: 'module' }`，worker 末尾的 `if (self.name === 'jassub-worker') expose(ASSRenderer)` 正确执行，Comlink 通信建立，`ready` resolve。

### 问题 D：中文字体显示为方框

JASSUB 渲染英文正常，但中文显示为 □□□。

#### 错误尝试 1：`fallbackFont` 设为字体名

```typescript
// ❌ JASSUB 没有 fallbackFont 选项
fallbackFont: "Source Han Sans CN"
```

这个选项不存在，被 JASSUB 忽略。

#### 错误尝试 2：`fallbackFont` 设为 URL

```typescript
// ❌ JASSUB 也没有 fallbackFont URL 选项（SubtitlesOctopus 有，JASSUB 没有）
fallbackFont: `${fontBase}/SourceHanSansCN-Bold.woff2`
```

查看 JASSUB 源码 `dist/jassub.js`，发现 API 是：

- `availableFonts`: `{ "字体名小写": "URL" }` — 注册字体
- `defaultFont`: 字符串，默认字体**名称**（不是 URL），默认值 `'liberation sans'`

#### 正确方案

```typescript
defaultFont: "source han sans cn",
availableFonts: {
    "source han sans cn": `${fontBase}/SourceHanSansCN-Bold.woff2`,
    "times new roman": `${fontBase}/TimesNewRoman.ttf`,
}
```

JASSUB 下载 `availableFonts` 里的字体文件，注册到 libass。当 ASS 文件请求的字体（如"微软雅黑"）不在 `availableFonts` 时，libass 使用 `defaultFont` 指定的字体作为 fallback。

### 问题 E：部署后浏览器加载旧版本

现象：dist_dir 已更新文件，但浏览器仍加载旧 JS hash。

根因：Go 后端启动时读取 `dist_dir` 内容并缓存 `index.html`。运行时替换 dist_dir 文件不会生效，必须重启服务。

解决：每次更新 dist_dir 后重启 openlist 服务。

### 最终状态（2026-05-27）

- movi-player 作为默认播放器 ✅
- 视频播放、HDR、多音轨、内嵌字幕 ✅ movi-player 原生处理
- 外挂 SRT/VTT 字幕 ✅ movi-player 原生处理
- **外挂 ASS 矢量字幕 ✅ JASSUB 渲染，中文字体正常**
- 外挂 SUP/PGS 字幕 — 代码已写（libpgs），无测试文件验证
- 内嵌 ASS 字幕 — movi-player 原生处理（纯文本，无矢量特效）
- 内嵌 PGS 字幕 ✅ movi-player 原生处理
- 视频列表树状结构 ✅
- 25 单元测试 ✅ 全部通过
- 字幕延迟同步 ✅ 代码已写（subtitledelaychange 事件）

### 6. 视频列表树状重构

替换了 VideoBox 中的扁平下拉框为 `VideoTreeList` 树状组件：

- 同级视频文件 + 子文件夹同时展示
- 文件夹可展开（懒加载，调用 `/api/fs/list`）
- 点击视频直接播放
- 当前播放视频高亮

### 7. movi-player 设为默认播放器

`index.ts` 中 movi_video `prior: true`，Artplayer video `prior: false`。
movi-player 排在 Artplayer 前面，作为视频的首选播放器。
