import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, it, vi } from "vitest"
import { toast, ToastRegion } from "~/components/ui/toast"
import { canUndoMove, offerUndo } from "../undo"

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}
const toasts = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-motion="toast"]'))

afterEach(() => {
  toast.clear()
  cleanup()
})

describe("what can be undone", () => {
  it("a move that took the files there and then", () => {
    expect(
      canUndoMove({ overwrite: false, skipExisting: false, taskIds: [] }),
    ).toBe(true)
  })
  it("not a move that replaced files: what it replaced is gone", () => {
    expect(
      canUndoMove({ overwrite: true, skipExisting: false, taskIds: [] }),
    ).toBe(false)
  })
  it("not a move that skipped some: moving back would take files that were there before", () => {
    expect(
      canUndoMove({ overwrite: false, skipExisting: true, taskIds: [] }),
    ).toBe(false)
  })
  it("not a move left to a task: it is not done yet", () => {
    expect(
      canUndoMove({ overwrite: false, skipExisting: false, taskIds: ["t1"] }),
    ).toBe(false)
  })
})

describe("offerUndo", () => {
  it("offers Undo for 5 seconds", () => {
    render(() => <ToastRegion />)
    offerUndo({
      message: "Renamed",
      undo: async () => ({ code: 200, message: "" }),
    })
    expect(toasts()).toHaveLength(1)
    expect(
      toasts()[0].querySelector('[data-testid="toast-action"]'),
    ).not.toBeNull()
    expect(toasts()[0].dataset.duration).toBe("5000")
  })

  it("undoes, then says so and lists the folder again", async () => {
    const refresh = vi.fn()
    const undo = vi.fn(async () => ({ code: 200, message: "" }))
    const { getByTestId } = render(() => <ToastRegion />)
    offerUndo({ message: "Renamed", undo, refresh })
    fireEvent.click(getByTestId("toast-action"))
    await flush()
    expect(undo).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalled()
    expect(toasts().map((t) => t.dataset.toastKind)).toEqual(["success"])
  })

  it("says why an undo could not be done", async () => {
    const { getByTestId } = render(() => <ToastRegion />)
    offerUndo({
      message: "Renamed",
      undo: async () => ({ code: 500, message: "file exists" }),
    })
    fireEvent.click(getByTestId("toast-action"))
    await flush()
    const [err] = toasts()
    expect(err.dataset.toastKind).toBe("error")
    expect(err.textContent).toContain("file exists")
  })
})
