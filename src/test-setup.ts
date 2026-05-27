import { vi, afterEach } from "vitest"
;(globalThis as any).window = globalThis.window || globalThis
;(window as any).OPENLIST_CONFIG = (window as any).OPENLIST_CONFIG || {}

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
