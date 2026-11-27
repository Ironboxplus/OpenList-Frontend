import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, it, vi } from "vitest"
import { notify } from "~/utils/notify"
import { toast, ToastRegion } from "../toast"

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}
const toasts = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-motion="toast"]'))
const list = () => document.querySelector<HTMLElement>("[data-toast-region]")!
const titles = () =>
  toasts().map((t) => t.querySelector("[data-toast-title]")?.textContent)

afterEach(() => {
  toast.clear()
  cleanup()
  vi.useRealTimers()
})

describe("toast", () => {
  it("shows a toast with its kind, title and details, announced by kind", () => {
    render(() => <ToastRegion />)
    toast.show({ kind: "error", title: "It broke", description: "the reason" })
    const [li] = toasts()
    expect(li.getAttribute("data-toast-kind")).toBe("error")
    expect(li.textContent).toContain("It broke")
    expect(li.textContent).toContain("the reason")
    // Kobalte toast-root.tsx: role status, aria-live by priority, atomic,
    // labelled by its title and described by its details
    expect(li.getAttribute("role")).toBe("status")
    expect(li.getAttribute("aria-live")).toBe("assertive")
    expect(li.getAttribute("aria-atomic")).toBe("true")
    const title = document.getElementById(li.getAttribute("aria-labelledby")!)
    expect(title?.textContent).toBe("It broke")
    const desc = document.getElementById(li.getAttribute("aria-describedby")!)
    expect(desc?.textContent).toBe("the reason")
    toast.show({ kind: "success", title: "Fine" })
    expect(toasts()[0].getAttribute("aria-live")).toBe("polite")
  })

  it("lives in a region named with its hotkey, out of the tab order", () => {
    render(() => <ToastRegion />)
    toast.show({ title: "Hi" })
    const region = document.querySelector('[role="region"]')!
    expect(region.getAttribute("aria-label")).toMatch(/alt\+T/)
    expect(region.getAttribute("tabindex")).toBe("-1")
    expect(list().getAttribute("tabindex")).toBe("-1")
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

  it("closes on its button, and on Escape", async () => {
    const { getByTestId } = render(() => <ToastRegion />)
    toast.show({ title: "Saved" })
    fireEvent.click(getByTestId("toast-close"))
    await flush()
    expect(toasts()).toHaveLength(0)
    toast.show({ title: "Again" })
    fireEvent.keyDown(toasts()[0], { key: "Escape" })
    await flush()
    expect(toasts()).toHaveLength(0)
  })

  it("stacks the newest in front; past three, the oldest are out of sight", () => {
    render(() => <ToastRegion />)
    for (const t of ["A", "B", "C", "D"]) toast.show({ title: t })
    expect(titles()).toEqual(["D", "C", "B", "A"])
    expect(toasts().map((t) => t.getAttribute("data-visible"))).toEqual([
      "true",
      "true",
      "true",
      "false",
    ])
    expect(toasts()[0].getAttribute("data-front")).toBe("true")
    expect(toasts()[1].getAttribute("data-front")).toBe("false")
  })

  it("holds every timer while the stack is pointed at, and resumes after", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    render(() => <ToastRegion />)
    toast.show({ title: "Soon gone", duration: 1000 })
    toast.show({ title: "Also", duration: 1000 })
    fireEvent.mouseEnter(list())
    vi.advanceTimersByTime(3000)
    await flush()
    expect(toasts()).toHaveLength(2)
    expect(list().getAttribute("data-expanded")).toBe("true")
    fireEvent.mouseLeave(list())
    vi.advanceTimersByTime(1100)
    await flush()
    expect(toasts()).toHaveLength(0)
  })

  it("holds the timers while focus is in it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    render(() => <ToastRegion />)
    toast.show({ title: "Read me", duration: 1000 })
    fireEvent.focusIn(toasts()[0])
    vi.advanceTimersByTime(3000)
    await flush()
    expect(toasts()).toHaveLength(1)
    fireEvent.focusOut(toasts()[0], { relatedTarget: document.body })
    vi.advanceTimersByTime(1100)
    await flush()
    expect(toasts()).toHaveLength(0)
  })

  it("holds the timers while the page is hidden", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    let hidden = true
    const spy = vi
      .spyOn(document, "hidden", "get")
      .mockImplementation(() => hidden)
    try {
      render(() => <ToastRegion />)
      document.dispatchEvent(new Event("visibilitychange"))
      toast.show({ title: "While away", duration: 1000 })
      vi.advanceTimersByTime(3000)
      await flush()
      expect(toasts()).toHaveLength(1)
      hidden = false
      document.dispatchEvent(new Event("visibilitychange"))
      vi.advanceTimersByTime(1100)
      await flush()
      expect(toasts()).toHaveLength(0)
    } finally {
      spy.mockRestore()
    }
  })

  it("alt+T takes the focus to the toasts and spreads them out", () => {
    render(() => <ToastRegion />)
    toast.show({ title: "Over here" })
    toast.show({ title: "And here" })
    fireEvent.keyDown(document, { code: "KeyT", altKey: true })
    expect(document.activeElement).toBe(list())
    expect(list().getAttribute("data-expanded")).toBe("true")
  })

  it("is what notify shows: the same API, one kind of toast", () => {
    render(() => <ToastRegion />)
    notify.success("done")
    notify.error("failed", { description: "why" })
    const kinds = toasts().map((t) => t.getAttribute("data-toast-kind"))
    // the newest in front
    expect(kinds).toEqual(["error", "success"])
    expect(toasts()[1].textContent).toContain("Done")
    expect(toasts()[0].textContent).toContain("why")
  })
})
