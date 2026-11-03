import { beforeEach, describe, expect, it, vi } from "vitest"

let setting = ""
vi.mock("~/store/settings", () => ({ getSetting: () => setting }))

import { clearSortState, loadSortState, saveSortState } from "../sort-state"

beforeEach(() => {
  localStorage.clear()
  setting = ""
})

describe("sort state", () => {
  it("remembers across sessions when the site remembers (also when the setting is absent)", () => {
    for (const value of ["", "true"]) {
      setting = value
      localStorage.clear()
      saveSortState("/a", { orderBy: "size", reverse: true })
      expect(localStorage.getItem("dir_sort_/a")).not.toBeNull()
      // a new session: nothing in memory is needed, storage answers
      localStorage.setItem(
        "dir_sort_/fresh",
        JSON.stringify({ orderBy: "name", reverse: false }),
      )
      expect(loadSortState("/fresh")).toEqual({
        orderBy: "name",
        reverse: false,
      })
    }
  })

  it("keeps the order in memory only when the site does not remember", () => {
    setting = "false"
    localStorage.setItem(
      "dir_sort_/old",
      JSON.stringify({ orderBy: "size", reverse: true }),
    )
    // an earlier remembered sort is ignored: the backend's order stands
    expect(loadSortState("/old")).toBeNull()
    saveSortState("/b", { orderBy: "modified", reverse: false })
    expect(localStorage.getItem("dir_sort_/b")).toBeNull()
    // but the session keeps what the user chose
    expect(loadSortState("/b")).toEqual({ orderBy: "modified", reverse: false })
  })
})

describe("clearSortState", () => {
  it("forgets the session and the stored choice, back to the storage order", () => {
    saveSortState("/c", { orderBy: "size", reverse: true })
    expect(loadSortState("/c")).not.toBeNull()
    clearSortState("/c")
    expect(loadSortState("/c")).toBeNull()
    expect(localStorage.getItem("dir_sort_/c")).toBeNull()
  })
})
