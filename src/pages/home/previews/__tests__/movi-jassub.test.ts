import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("jassub/dist/worker/worker.js?worker&url", () => ({
  default: "/assets/worker.js",
}))
vi.mock("jassub/dist/wasm/jassub-worker.wasm?url", () => ({
  default: "/assets/jassub.wasm",
}))
vi.mock("jassub/dist/wasm/jassub-worker-modern.wasm?url", () => ({
  default: "/assets/jassub-modern.wasm",
}))

import { registerJassubHost, resetJassubHostForTests } from "../movi-jassub"

describe("registerJassubHost", () => {
  const setJassubHost = vi.fn()

  beforeEach(() => {
    setJassubHost.mockClear()
    resetJassubHostForTests()
    class FakeMovi extends HTMLElement {
      static setJassubHost = setJassubHost
    }
    if (!customElements.get("movi-player")) {
      customElements.define("movi-player", FakeMovi)
    }
    ;(customElements.get("movi-player") as any).setJassubHost = setJassubHost
  })

  it("hands movi the JASSUB loader and its asset urls", async () => {
    await registerJassubHost()
    expect(setJassubHost).toHaveBeenCalledTimes(1)
    const host = setJassubHost.mock.calls[0][0]
    expect(host.workerUrl).toBe("/assets/worker.js")
    expect(host.wasmUrl).toBe("/assets/jassub.wasm")
    expect(host.modernWasmUrl).toBe("/assets/jassub-modern.wasm")
    // lazy: jassub itself is only imported when movi asks for it
    const mod: any = await host.load()
    expect(typeof mod.default).toBe("function")
  })

  it("registers once for concurrent and later players alike", async () => {
    await Promise.all([
      registerJassubHost(),
      registerJassubHost(),
      registerJassubHost(),
    ])
    await registerJassubHost()
    expect(setJassubHost).toHaveBeenCalledTimes(1)
  })
})
