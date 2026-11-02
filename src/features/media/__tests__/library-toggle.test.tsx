import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { MediaFs } from "../types"

vi.mock("~/hooks", () => ({
  useT: () => (k: string) => k,
  useRouter: () => ({ pathname: () => "/lib/Movies" }),
}))
vi.mock("~/store", () => ({ objStore: { objs: [] }, me: () => ({ role: 2 }) }))
vi.mock("~/types", () => ({ UserMethods: { is_admin: () => true } }))
// The real item needs a Kobalte menu around it; a button is enough here.
vi.mock("~/components/ui/dropdown-menu", () => ({
  DropdownMenuItem: (p: { onSelect: () => void; children: unknown }) => (
    <button data-item onClick={() => p.onSelect()}>
      {p.children as never}
    </button>
  ),
}))
vi.mock("../client", () => ({
  markLibrary: vi.fn(async () => ({ ok: true })),
  unmarkLibrary: vi.fn(async () => ({ ok: true })),
}))

import { LibraryMenuItem } from "../../files/LibraryMenuItem"
import * as client from "../client"
import { setMediaInvalidator, setMediaFor } from "../state"

const fsOf = (libraries: string[]) =>
  ({ item: null, children: [], episodes: [], libraries }) as unknown as MediaFs

afterEach(() => {
  cleanup()
  setMediaFor("", undefined)
  setMediaInvalidator(undefined)
  vi.clearAllMocks()
})

describe("library toggle", () => {
  it("marks an ordinary folder as a library (a video scan path), then refreshes it and its parent", async () => {
    const seen: (string | undefined)[] = []
    setMediaInvalidator((p) => seen.push(p))
    setMediaFor("/lib/Movies", fsOf([]))
    const v = render(() => <LibraryMenuItem />)
    expect(v.getByText("media.library.set")).toBeTruthy()
    fireEvent.click(v.getByText("media.library.set"))
    await waitFor(() =>
      expect(client.markLibrary).toHaveBeenCalledWith("/lib/Movies"),
    )
    await waitFor(() => expect(seen).toEqual(["/lib", "/lib/Movies"]))
  })

  it("removes the scan path when the folder already is a library", async () => {
    setMediaFor("/lib/Movies", fsOf(["/lib/Movies"]))
    const v = render(() => <LibraryMenuItem />)
    fireEvent.click(v.getByText("media.library.unset"))
    await waitFor(() =>
      expect(client.unmarkLibrary).toHaveBeenCalledWith("/lib/Movies"),
    )
    expect(client.markLibrary).not.toHaveBeenCalled()
  })

  it("is hidden until the backend has answered for this folder", () => {
    const v = render(() => <LibraryMenuItem />)
    expect(v.container.querySelector("[data-library-toggle]")).toBeNull()
    expect(v.queryByText("media.library.set")).toBeNull()
  })
})
