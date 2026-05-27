# OpenList Frontend — Movi Player Integration & Video Refactoring Plan

> **Write-once plan.** After approval, only checkboxes may be toggled. No structural edits.
> Created: 2026-05-26

---

## Prerequisites & Constraints

- **Libraries only** — no custom parsers, decoders, or rendering algorithms
- **No monkey-patching** — all integration through public APIs and DOM events
- **TDD** — tests written before implementation for each phase
- **CI-safe** — all dependencies from npm registry, no local paths
- **Minimal change** — reuse movi-player's built-in CC menu, delay controls, keyboard shortcuts

### Key Research Findings

| Topic                          | Finding                                                                                                                                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JASSUB canvas-only mode**    | Constructor with `canvas` only (no `video`) → no RVFC, ResizeObserver watches canvas. Must `await ready` before `manualRender()`. Canvas dimensions set by us, not JASSUB. Uses `transferControlToOffscreen()` internally. |
| **JASSUB manualRender()**      | Params: `{expectedDisplayTime, width, height, mediaTime}`. `mediaTime` in seconds. First call triggers resize (0→actual). `timeOffset` property for delay.                                                                 |
| **libpgs manual mode**         | `renderAtTimestamp(seconds)` — sends to worker. Canvas auto-resized to subtitle composition dimensions. `timeOffset` in seconds. `dispose()` terminates worker. No SharedArrayBuffer.                                      |
| **movi-player public API**     | `selectSubtitleLang(lang\|null)`, `getSubtitleLangs()`, `getCanvas()`, `currentTime`, `setSubtitleDelay()`, `getSubtitleDelay()`. Shadow DOM mode: open.                                                                   |
| **movi-player track system**   | `<track>` elements read from light DOM. `data-format` stored internally. `subtitleTrackChange` event dispatched on element. Native parsing: SRT/VTT only (regex-based). ASS/SUP → 0 cues parsed (no broken display).       |
| **movi-player subtitle delay** | `subtitledelaychange` CustomEvent with `detail.subtitleDelay`. +/- keyboard shortcuts built-in.                                                                                                                            |
| **Overlay strategy**           | Canvas OUTSIDE shadow DOM, sibling of `<movi-player>`. Wrapper `position: relative`. Overlay `position: absolute; pointer-events: none; z-index: 10`. ResizeObserver for sync.                                             |
| **movi-player npm**            | v0.2.3 on npm. Requires COOP/COEP headers for SharedArrayBuffer (shows "Security Headers Missing" error without them).                                                                                                     |

### Integration Architecture (No Patching)

```
User clicks CC menu → movi-player calls selectSubtitleLang(lang) internally
  → For SRT/VTT: movi-player parses and renders natively ✓
  → For ASS: movi-player parses 0 cues (no damage), subtitleTrackChange fires
  → For SUP: movi-player parses 0 cues (no damage), subtitleTrackChange fires

Our subtitleTrackChange listener:
  1. getSubtitleLangs() → find active track
  2. Look up format in our subInfoMap
  3. If ASS → destroy old renderers, activate JASSUB on overlay canvas
  4. If SUP → destroy old renderers, activate libpgs on overlay canvas
  5. If SRT/VTT → destroy external renderers (native handles it)
  6. If null (off) → destroy external renderers

Subtitle delay sync:
  subtitledelaychange event → sync to JASSUB.timeOffset / libpgs.timeOffset
```

---

## Phase 1: Project Setup & Dependencies

- [x] **1.1** Switch `movi-player` dependency from `link:E:/Go/Openlist/movi-player` to npm `^0.2.3`
- [x] **1.2** Add test dependencies: `vitest`, `@solidjs/testing-library`, `jsdom`
- [x] **1.3** Add `vitest.config.ts` with SolidJS + jsdom setup
- [x] **1.4** Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to package.json
- [x] **1.5** Verify existing `viteStaticCopy` entries for jassub and libpgs WASM/worker files are correct
- [x] **1.6** Run `pnpm install` and verify `pnpm build` passes in clean state

## Phase 2: SubtitleManager Module (TDD)

Extract all subtitle rendering logic into a standalone, testable module.

### 2.1 Tests First

- [x] **2.1.1** Create `src/pages/home/previews/__tests__/subtitle-manager.test.ts`
- [x] **2.1.2** Test: `detectFormat(filename)` returns correct format for .ass, .sup, .srt, .vtt extensions
- [x] **2.1.3** Test: `SubtitleManager.registerTracks()` populates internal subInfoMap correctly
- [x] **2.1.4** Test: `SubtitleManager.handleTrackChange()` with ASS track → calls JASSUB activation
- [x] **2.1.5** Test: `SubtitleManager.handleTrackChange()` with SUP track → calls libpgs activation
- [x] **2.1.6** Test: `SubtitleManager.handleTrackChange()` with SRT track → destroys external renderers
- [x] **2.1.7** Test: `SubtitleManager.handleTrackChange()` with null (off) → destroys external renderers
- [x] **2.1.8** Test: `SubtitleManager.setTimeOffset()` syncs to active renderer's timeOffset
- [x] **2.1.9** Test: `SubtitleManager.destroy()` cleans up all resources (renderers, timers, observers, canvas)
- [x] **2.1.10** Test: double `destroy()` call is safe (idempotent)

### 2.2 Implementation

- [x] **2.2.1** Create `src/pages/home/previews/subtitle-manager.ts`
- [x] **2.2.2** Implement `detectFormat(filename: string): 'ass' | 'sup' | 'srt' | 'vtt'`
- [x] **2.2.3** Implement `SubtitleManager` class:
  - Constructor: receives movi-player element reference
  - `registerTracks(subtitles: Array<{name, url}>)`: builds `<track>` HTML + internal subInfoMap
  - `getTrackHTML()`: returns track tags string for innerHTML injection
  - `handleTrackChange()`: reads active track from movi-player, activates correct renderer
  - `setTimeOffset(seconds)`: propagates to active renderer
  - `destroy()`: full cleanup
- [x] **2.2.4** Implement private `activateASS(url)`:
  - Create/reuse overlay canvas (sibling of movi-player, wrapper position: relative)
  - Initialize JASSUB with `{canvas, subUrl, workerUrl, wasmUrl, modernWasmUrl, availableFonts}`
  - `await ready`
  - Start sync loop: `setInterval(() => manualRender({...}), 50)` reading `moviEl.currentTime`
- [x] **2.2.5** Implement private `activateSUP(url)`:
  - Create/reuse overlay canvas
  - Initialize PgsRenderer with `{canvas, subUrl, workerUrl}`
  - Start sync loop: `setInterval(() => renderAtTimestamp(moviEl.currentTime), 50)`
- [x] **2.2.6** Implement private `destroyRenderers()`:
  - Stop sync interval
  - Destroy JASSUB (if active, check `_destroyed` flag, call `destroy()`)
  - Dispose libpgs (if active, call `dispose()`)
  - Remove overlay canvas from DOM
- [x] **2.2.7** Implement overlay canvas management:
  - `getOrCreateOverlay()`: creates canvas as sibling of movi-player, sets up ResizeObserver
  - ResizeObserver syncs `canvas.width/height` to movi-player element's `clientWidth/clientHeight`
- [x] **2.2.8** All tests pass

## Phase 3: movi_video.tsx Clean Rewrite (TDD)

### 3.1 Tests First

- [x] **3.1.1** Create `src/pages/home/previews/__tests__/movi-video.test.tsx`
- [x] **3.1.2** Test: component mounts and creates `<movi-player>` element with correct src
- [x] **3.1.3** Test: component passes subtitle `<track>` elements in movi-player light DOM
- [x] **3.1.4** Test: component cleans up on unmount (destroys player + SubtitleManager)
- [x] **3.1.5** Test: auto-next triggers navigation when enabled

### 3.2 Implementation

- [x] **3.2.1** Rewrite `src/pages/home/previews/movi_video.tsx` from scratch:
  - Create movi-player element via innerHTML (workaround for constructor spec violation)
  - Pass `src`, `controls`, `theme="dark"`, `hdr` attributes
  - Include `<track>` elements from SubtitleManager
  - Listen for `ended` event (auto-next)
  - Listen for `subtitleTrackChange` event → delegate to SubtitleManager
  - Listen for `subtitledelaychange` event → delegate to SubtitleManager
  - Cleanup on SolidJS `onCleanup`
- [x] **3.2.2** Wire up `VideoBox` wrapper (same pattern as existing video.tsx)
- [x] **3.2.3** All tests pass

### 3.3 Registration & Priority

- [x] **3.3.1** In `src/pages/home/previews/index.ts`: set movi_video `prior: true`
- [x] **3.3.2** In `src/pages/home/previews/index.ts`: set video (Artplayer) `prior: false`
- [x] **3.3.3** Move movi_video entry BEFORE the video (Artplayer) entry in the array (order matters for prior=true items)
- [x] **3.3.4** Verify i18n key exists: `src/lang/en/home.json` → `"movi_video": "Movi Player"`

## Phase 4: Video List Tree Refactoring (TDD)

### 4.1 Tests First

- [x] **4.1.1** Create `src/pages/home/previews/__tests__/video-tree.test.ts`
- [x] **4.1.2** Test: `buildVideoTree()` correctly nests files under folder nodes
- [x] **4.1.3** Test: `buildVideoTree()` handles flat directory (no subfolders)
- [x] **4.1.4** Test: `buildVideoTree()` filters only video files
- [x] **4.1.5** Test: tree node click triggers navigation to correct path

### 4.2 Data Layer

- [x] **4.2.1** Create `src/pages/home/previews/video-tree.ts`:
  - `interface TreeNode { name, path, type: 'folder' | 'video', children?: TreeNode[] }`
  - `buildVideoTree(currentPath, objs)`: builds tree from flat file list
  - `fetchSubfolderVideos(path)`: calls `/api/fs/list` to scan subfolders for videos
- [x] **4.2.2** Implement lazy loading: only scan subfolders when user expands them

### 4.3 UI Component

- [x] **4.3.1** Create `src/pages/home/previews/VideoTreeList.tsx` (SolidJS component):
  - Renders tree structure with indent levels
  - Folder nodes: expand/collapse on click
  - Video nodes: navigate on click (plays video)
  - Highlight currently playing video
  - Use Hope UI components for consistency
- [x] **4.3.2** Integrate into `VideoBox`: replace flat `SelectWrapper` with `VideoTreeList`
- [x] **4.3.3** Keep auto-next switch and external player links unchanged
- [x] **4.3.4** All tests pass

## Phase 5: Integration Testing & Manual Verification

- [x] **5.1** `pnpm test` — all unit tests pass
- [x] **5.2** `pnpm build` — production build succeeds with no errors
- [x] **5.3** `pnpm lint` — TypeScript type check passes
- [x] **5.4** Manual test: movi-player loads as default player for video files
- [x] **5.5** Manual test: Artplayer available as fallback in preview dropdown
- [x] **5.6** Manual test: CC menu shows all external subtitles (SRT, ASS, SUP, VTT)
- [x] **5.7** Manual test: selecting ASS subtitle → JASSUB renders with full vector/style fidelity
- [x] **5.8** Manual test: selecting SUP subtitle → libpgs renders bitmap subtitles correctly
- [x] **5.9** Manual test: selecting SRT/VTT → movi-player native rendering works
- [x] **5.10** Manual test: subtitle delay adjustment syncs to external renderers
- [x] **5.11** Manual test: switching between subtitle types cleans up previous renderer
- [x] **5.12** Manual test: muxed (embedded) subtitles work via movi-player WASM
- [x] **5.13** Manual test: video tree list shows folder structure, click-to-play works
- [x] **5.14** Manual test: auto-next advances to next video

## Phase 6: CI & Cleanup

- [x] **6.1** Verify `pnpm install && pnpm build` works with npm registry movi-player (no local paths)
- [x] **6.2** Remove dead code: old movi_video.tsx content fully replaced
- [x] **6.3** Remove unused imports if any remain from old attempts
- [x] **6.4** Verify no duplicate viteStaticCopy entries
- [x] **6.5** Update `JOURNAL.md` with completion notes
- [x] **6.6** Update `CHANGES.md` with summary of changes

---

## File Manifest

| File                                                         | Action  | Description                                                     |
| ------------------------------------------------------------ | ------- | --------------------------------------------------------------- |
| `package.json`                                               | MODIFY  | Switch movi-player to npm, add vitest + testing-library + jsdom |
| `vitest.config.ts`                                           | CREATE  | Vitest config with SolidJS + jsdom                              |
| `src/pages/home/previews/subtitle-manager.ts`                | CREATE  | SubtitleManager class (JASSUB + libpgs lifecycle)               |
| `src/pages/home/previews/movi_video.tsx`                     | REWRITE | Clean movi-player component                                     |
| `src/pages/home/previews/index.ts`                           | MODIFY  | Swap prior flags, reorder entries                               |
| `src/pages/home/previews/video-tree.ts`                      | CREATE  | Tree data structure + API calls                                 |
| `src/pages/home/previews/VideoTreeList.tsx`                  | CREATE  | Tree UI component                                               |
| `src/pages/home/previews/video_box.tsx`                      | MODIFY  | Replace SelectWrapper with VideoTreeList                        |
| `src/pages/home/previews/__tests__/subtitle-manager.test.ts` | CREATE  | SubtitleManager unit tests                                      |
| `src/pages/home/previews/__tests__/movi-video.test.tsx`      | CREATE  | movi_video component tests                                      |
| `src/pages/home/previews/__tests__/video-tree.test.ts`       | CREATE  | Video tree tests                                                |
| `JOURNAL.md`                                                 | MODIFY  | Completion notes                                                |
| `CHANGES.md`                                                 | MODIFY  | Change summary                                                  |

---

## Dependency Changes

```diff
# package.json
- "movi-player": "link:E:/Go/Openlist/movi-player"
+ "movi-player": "^0.2.3"

# devDependencies (add)
+ "vitest": "^3.2.1"
+ "@solidjs/testing-library": "^0.8.10"
+ "jsdom": "^26.1.0"
```

Existing dependencies unchanged: `jassub@^2.5.1`, `libpgs@^0.8.1`, `@jellyfin/libass-wasm@^4.2.4` (still used by Artplayer).
