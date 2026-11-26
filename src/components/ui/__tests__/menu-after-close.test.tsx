import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { afterEach, describe, expect, it } from "vitest"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "../context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../dropdown-menu"

afterEach(cleanup)

// Only the public menu components are used here, so the same file runs
// against the code before the fix (the old-code run of the CI).

const menus = () => document.querySelectorAll("[role=menu]")
const menuItem = (text: string) =>
  waitFor(() => {
    const el = [...document.querySelectorAll("[role=menuitem]")].find(
      (e) => e.textContent === text,
    )
    expect(el).toBeDefined()
    return el as HTMLElement
  })
const press = (el: HTMLElement, key: string) => {
  el.focus()
  fireEvent.keyDown(el, { key })
}

/** What an action saw when it ran: the menu still mounted, and what had focus. */
const witness = (seen: { menuOpen: boolean; active: Element | null }[]) => () =>
  seen.push({ menuOpen: menus().length > 0, active: document.activeElement })

describe("an item that closes its menu", () => {
  it("acts after the menu has closed, with focus left for what it opens", async () => {
    const seen: { menuOpen: boolean; active: Element | null }[] = []
    render(() => (
      <DropdownMenu>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={witness(seen)}>go</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    const trigger = document.querySelector("button")!
    press(trigger, "Enter")
    press(await menuItem("go"), "Enter")
    expect(seen).toEqual([])
    await waitFor(() => expect(seen).toHaveLength(1))
    expect(seen[0].menuOpen).toBe(false)
    // the menu did not hand focus back to its trigger: the dialog takes it
    expect(seen[0].active).not.toBe(trigger)
  })

  it("in a submenu of a context menu acts once, after the whole menu has closed", async () => {
    const seen: { menuOpen: boolean; active: Element | null }[] = []
    const { container } = render(() => (
      <ContextMenu>
        <ContextMenuTrigger>row</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => {}}>top</ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>more</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onSelect={witness(seen)}>deep</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
    ))
    fireEvent.contextMenu(container.firstElementChild!)
    const more = await waitFor(() => {
      const el = document.querySelector(
        "[role=menu] [aria-haspopup]",
      ) as HTMLElement
      expect(el).not.toBeNull()
      return el
    })
    press(more, "ArrowRight")
    press(await menuItem("deep"), "Enter")
    expect(seen).toEqual([])
    await waitFor(() => expect(seen).toHaveLength(1))
    expect(seen[0].menuOpen).toBe(false)
    await new Promise((r) => setTimeout(r, 50))
    expect(seen).toHaveLength(1)
  })

  it("belongs to its own menu: another menu closing does not run it", async () => {
    const ran: string[] = []
    // menu A is held open by its owner, so its item's action waits
    const [openA, setOpenA] = createSignal(true)
    render(() => (
      <>
        <DropdownMenu open={openA()}>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => ran.push("a")}>
              a
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger>open b</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => {}}>b</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    ))
    press(await menuItem("a"), "Enter")
    await new Promise((r) => setTimeout(r, 30))
    press(document.querySelector("button")!, "Enter")
    press(await menuItem("b"), "Escape")
    await waitFor(() => expect(menus()).toHaveLength(1))
    await new Promise((r) => setTimeout(r, 30))
    expect(ran).toEqual([])
    setOpenA(false)
    await waitFor(() => expect(ran).toEqual(["a"]))
  })
})

describe("an item that keeps its menu open (closeOnSelect={false})", () => {
  it("acts at once, inside the select", async () => {
    const seen: { menuOpen: boolean; active: Element | null }[] = []
    render(() => (
      <DropdownMenu defaultOpen>
        <DropdownMenuContent>
          <DropdownMenuItem closeOnSelect={false} onSelect={witness(seen)}>
            toggle
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    press(await menuItem("toggle"), "Enter")
    expect(seen).toHaveLength(1)
    expect(seen[0].menuOpen).toBe(true)
  })
})

describe("a menu closed without choosing", () => {
  it("hands focus back to its trigger as before", async () => {
    render(() => (
      <DropdownMenu>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => {}}>go</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    const trigger = document.querySelector("button")!
    press(trigger, "Enter")
    press(await menuItem("go"), "Escape")
    await waitFor(() => expect(menus()).toHaveLength(0))
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
