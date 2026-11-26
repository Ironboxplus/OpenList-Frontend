import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library"
import { afterEach, describe, expect, it } from "vitest"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../dropdown-menu"

afterEach(cleanup)

describe("a menu item's action", () => {
  it("runs after the menu content has closed, not inside onSelect", async () => {
    const seen: string[] = []
    render(() => (
      <DropdownMenu>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onSelect={() =>
              seen.push(
                document.querySelector("[role=menu]") ? "menu open" : "closed",
              )
            }
          >
            go
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    const trigger = document.querySelector("button")!
    trigger.focus()
    fireEvent.keyDown(trigger, { key: "Enter" })
    const item = await waitFor(() => {
      const el = document.querySelector("[role=menuitem]")
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    item.focus()
    fireEvent.keyDown(item, { key: "Enter" })
    expect(seen).toEqual([])
    await waitFor(() => expect(seen).toEqual(["closed"]))
  })
})
