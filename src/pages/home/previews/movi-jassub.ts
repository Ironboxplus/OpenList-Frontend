// movi draws ASS/SSA (embedded tracks and `<track data-format="ass">` files)
// with libass, but does not bundle JASSUB: the library, its worker and its two
// WebAssembly builds are assets of this app's bundler. They are handed over once
// through MoviElement.setJassubHost, before the first player is created.
// The imports stay dynamic so none of it loads until an ASS track is shown (the
// library) or a player is about to be built (just the asset URLs).

interface MoviElementCtor {
  setJassubHost(host: {
    load: () => Promise<unknown>
    workerUrl: string
    wasmUrl: string
    modernWasmUrl: string
  }): void
}

// One registration for the page: players built meanwhile wait on the same
// promise, later ones (another preview, another visit) find it done.
let pending: Promise<void> | null = null

export function registerJassubHost(): Promise<void> {
  pending ??= register().catch((e) => {
    // Without a host movi falls back to its plain-text ASS path.
    pending = null
    console.warn("[movi] could not register the JASSUB host", e)
  })
  return pending
}

async function register(): Promise<void> {
  const ctor = customElements.get("movi-player") as unknown as
    MoviElementCtor | undefined
  if (!ctor?.setJassubHost) return
  const [worker, wasm, modernWasm] = await Promise.all([
    import("jassub/dist/worker/worker.js?worker&url"),
    import("jassub/dist/wasm/jassub-worker.wasm?url"),
    import("jassub/dist/wasm/jassub-worker-modern.wasm?url"),
  ])
  ctor.setJassubHost({
    load: () => import("jassub"),
    workerUrl: worker.default,
    wasmUrl: wasm.default,
    modernWasmUrl: modernWasm.default,
  })
}

/** For tests: forget that the host was registered. */
export const resetJassubHostForTests = () => {
  pending = null
}
