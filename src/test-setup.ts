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

// jsdom runs no CSS animations but reports `animationName` as "" instead of
// "none", so solid-presence (Kobalte's menus and popovers) waits for an
// animationend that never comes and keeps closed content mounted. Report what
// a browser reports for an element without an animation.
Object.defineProperty(CSSStyleDeclaration.prototype, "animationName", {
  configurable: true,
  get(this: CSSStyleDeclaration) {
    return this.getPropertyValue("animation-name") || "none"
  },
  set(this: CSSStyleDeclaration, v: string) {
    this.setProperty("animation-name", v)
  },
})

// jsdom: not implemented, and scroll-lock helpers call it on cleanup.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo

HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  putImageData: vi.fn(),
})) as any

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
