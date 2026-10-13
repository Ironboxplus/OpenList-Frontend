import { createRoot, createSignal } from "solid-js"
import { describe, expect, it } from "vitest"
import { createLoad } from "../load"

const tick = () => new Promise((r) => setTimeout(r, 0))

describe("createLoad", () => {
  it("loads once, reports loading, and exposes the value", async () => {
    await createRoot(async (dispose) => {
      const l = createLoad(
        () => 1,
        async (n) => n * 2,
      )
      expect(l.loading()).toBe(true)
      expect(l.data()).toBeUndefined()
      await tick()
      expect(l.loading()).toBe(false)
      expect(l.data()).toBe(2)
      dispose()
    })
  })

  it("reads never suspend: the value is undefined while loading", async () => {
    await createRoot(async (dispose) => {
      let release!: (v: number) => void
      const l = createLoad(
        () => 0,
        () => new Promise<number>((r) => (release = r)),
      )
      await tick()
      expect(l.data()).toBeUndefined()
      expect(l.loading()).toBe(true)
      release(7)
      await tick()
      expect(l.data()).toBe(7)
      dispose()
    })
  })

  it("keeps the last good data on failure and retries with refetch", async () => {
    await createRoot(async (dispose) => {
      let fail = false
      const l = createLoad(
        () => 0,
        async () => {
          if (fail) throw new Error("boom")
          return "ok"
        },
      )
      await tick()
      fail = true
      await l.refetch()
      expect(l.data()).toBe("ok")
      expect((l.error() as Error).message).toBe("boom")
      fail = false
      await l.refetch()
      expect(l.error()).toBeUndefined()
      dispose()
    })
  })

  it("reloads when the source changes and drops a stale answer", async () => {
    await createRoot(async (dispose) => {
      const [src, setSrc] = createSignal("a")
      const releases: Record<string, (v: string) => void> = {}
      const l = createLoad(
        src,
        (s) => new Promise<string>((r) => (releases[s] = r)),
      )
      await tick()
      setSrc("b")
      await tick()
      releases.b("B")
      await tick()
      releases.a("A") // older run finishing late
      await tick()
      expect(l.data()).toBe("B")
      expect(l.loading()).toBe(false)
      dispose()
    })
  })
})
