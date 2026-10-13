import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { afterEach, describe, expect, it, vi } from "vitest"

const [canCopy, setCanCopy] = createSignal(false)
const copySelectedMpvCommand = vi.fn()

vi.mock("~/hooks", () => ({
  useT: () => (k: string) => k,
  useCopyLink: () => ({
    copySelectedPreviewPage: vi.fn(),
    copySelectedRawLink: vi.fn(),
    copySelectedMpvCommand,
    canCopyMpvCommand: canCopy,
  }),
  useDownload: () => ({}),
}))
vi.mock("../file-actions", () => ({ runTool: vi.fn() }))

import {
  DropdownMenu,
  DropdownMenuContent,
} from "~/components/ui/dropdown-menu"
import { CopyLinkItems } from "../BatchMenus"

afterEach(() => {
  cleanup()
  setCanCopy(false)
})

const items = () =>
  [...document.querySelectorAll("[role=menuitem]")].map((e) => e.textContent)

describe("CopyLinkItems (action bar and phone sheet)", () => {
  const mount = () =>
    render(() => (
      <DropdownMenu open>
        <DropdownMenuContent>
          <CopyLinkItems />
        </DropdownMenuContent>
      </DropdownMenu>
    ))

  it("hides the mpv entry when the selection has no media", () => {
    mount()
    expect(items()).toEqual([
      "home.toolbar.preview_page",
      "home.toolbar.down_link",
      "home.toolbar.encode_down_link",
    ])
  })

  it("shows the mpv entry for media and copies on select", () => {
    setCanCopy(true)
    mount()
    expect(items()).toContain("home.toolbar.mpv_command")
    const el = [...document.querySelectorAll("[role=menuitem]")].find(
      (e) => e.textContent === "home.toolbar.mpv_command",
    ) as HTMLElement
    el.focus()
    fireEvent.keyDown(el, { key: "Enter" })
    expect(copySelectedMpvCommand).toHaveBeenCalledTimes(1)
  })
})
