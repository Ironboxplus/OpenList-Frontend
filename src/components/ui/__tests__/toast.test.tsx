import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, it, vi } from "vitest"
import { notify } from "~/utils/notify"
import { toast, ToastRegion } from "../toast"

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}
const toasts = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-motion="toast"]'))

afterEach(() => {
  toast.clear()
  cleanup()
  vi.useRealTimers()
})

describe("toast", () => {
  it("shows a toast in a live region, with its kind, title and details", () => {
    render(() => <ToastRegion />)
    toast.show({ kind: "error", title: "It broke", description: "the reason" })
    const [li] = toasts()
    expect(li.getAttribute("data-toast-kind")).toBe("error")
    expect(li.textContent).toContain("It broke")
    expect(li.textContent).toContain("the reason")
    // errors interrupt, the rest wait their turn
    expect(li.getAttribute("aria-live")).toBe("assertive")
  })

  it("runs its action once and closes", async () => {
    const undo = vi.fn()
    const { getByTestId } = render(() => <ToastRegion />)
    toast.show({ title: "Renamed", action: { label: "Undo", onClick: undo } })
    fireEvent.click(getByTestId("toast-action"))
    expect(undo).toHaveBeenCalledTimes(1)
    await flush()
    expect(toasts()).toHaveLength(0)
  })

  it("closes on its button", async () => {
    const { getByTestId } = render(() => <ToastRegion />)
    toast.show({ title: "Saved" })
    fireEvent.click(getByTestId("toast-close"))
    await flush()
    expect(toasts()).toHaveLength(0)
  })

  it("closes by itself after its time, but not while it is pointed at", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    render(() => <ToastRegion />)
    toast.show({ title: "Soon gone", duration: 1000 })
    const [li] = toasts()
    fireEvent.pointerEnter(li)
    vi.advanceTimersByTime(3000)
    await flush()
    expect(toasts()).toHaveLength(1)
    fireEvent.pointerLeave(li)
    vi.advanceTimersByTime(1100)
    await flush()
    expect(toasts()).toHaveLength(0)
  })

  it("is what notify shows: the same API, one kind of toast", () => {
    render(() => <ToastRegion />)
    notify.success("done")
    notify.error("failed", { description: "why" })
    const kinds = toasts().map((t) => t.getAttribute("data-toast-kind"))
    expect(kinds).toEqual(["success", "error"])
    expect(toasts()[0].textContent).toContain("Done")
    expect(toasts()[1].textContent).toContain("why")
  })
})
