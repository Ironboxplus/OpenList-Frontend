import { vi, afterEach } from "vitest"
;(globalThis as any).window = globalThis.window || globalThis
// Provide a usable runtime config so modules that import ~/utils (which loads
// config.ts at import time) don't crash on an undefined api/base_path in tests.
;(window as any).OPENLIST_CONFIG = {
  api: "/",
  base_path: "",
  ...((window as any).OPENLIST_CONFIG || {}),
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    private cb: ResizeObserverCallback
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

vi.mock("jassub", () => ({
  default: class MockJASSUB {
    timeOffset = 0
    _destroyed = false
    ready = Promise.resolve()
    manualRender() {}
    async destroy() {
      this._destroyed = true
    }
  },
}))

vi.mock("libpgs", () => {
  return {
    PgsRenderer: class MockPgsRenderer {
      timeOffset = 0
      renderAtTimestamp() {}
      dispose() {}
    },
  }
})
