import { cleanup, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, it } from "vitest"
import { Dialog, DialogContent } from "../dialog"
import { Popover, PopoverContent, PopoverTrigger } from "../popover"
import { Sheet, SheetContent } from "../sheet"

afterEach(cleanup)

// PLAN_FE_UNIFY_OVERLAYS_1126 §2.2 A: switches for the hope compatibility
// layer. Without them the parts behave as before (the X is drawn).

const closeButtons = () =>
  [...document.querySelectorAll("button")].filter((b) =>
    b.textContent?.includes("Close"),
  )

describe("ui overlays: showClose", () => {
  it("dialog: the X by default, none with showClose={false}", () => {
    render(() => (
      <Dialog open>
        <DialogContent>body</DialogContent>
      </Dialog>
    ))
    expect(closeButtons()).toHaveLength(1)
    cleanup()
    render(() => (
      <Dialog open>
        <DialogContent showClose={false}>body</DialogContent>
      </Dialog>
    ))
    expect(document.body.textContent).toContain("body")
    expect(closeButtons()).toHaveLength(0)
  })

  it("sheet: the X by default, none with showClose={false}", () => {
    render(() => (
      <Sheet open>
        <SheetContent>body</SheetContent>
      </Sheet>
    ))
    expect(closeButtons()).toHaveLength(1)
    cleanup()
    render(() => (
      <Sheet open>
        <SheetContent showClose={false}>body</SheetContent>
      </Sheet>
    ))
    expect(document.body.textContent).toContain("body")
    expect(closeButtons()).toHaveLength(0)
  })

  it("popover: the X by default, none with showClose={false}", () => {
    render(() => (
      <Popover open>
        <PopoverTrigger>t</PopoverTrigger>
        <PopoverContent>body</PopoverContent>
      </Popover>
    ))
    expect(closeButtons()).toHaveLength(1)
    cleanup()
    render(() => (
      <Popover open>
        <PopoverTrigger>t</PopoverTrigger>
        <PopoverContent showClose={false}>body</PopoverContent>
      </Popover>
    ))
    expect(document.body.textContent).toContain("body")
    expect(closeButtons()).toHaveLength(0)
  })
})

describe("ui dialog: height", () => {
  it("is capped to the window and scrolls inside, so a tall dialog's footer is reachable", () => {
    render(() => (
      <Dialog open>
        <DialogContent>body</DialogContent>
      </Dialog>
    ))
    const content = document.querySelector('[role="dialog"]')!
    expect(content.className).toContain("max-h-[calc(100dvh-2rem)]")
    expect(content.className).toContain("overflow-y-auto")
  })
})
