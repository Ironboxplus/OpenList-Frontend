import { describe, expect, it, vi } from "vitest"

import { withoutNulls } from "../without-nulls"

describe("withoutNulls", () => {
  it("drops null thumb, hash_info, type and sign, keeping everything else", () => {
    const [o] = withoutNulls([
      {
        name: "a.txt",
        size: 0,
        is_dir: false,
        thumb: null,
        hash_info: null,
        type: null,
        sign: null,
        modified: "",
      },
    ])
    expect(o).toEqual({ name: "a.txt", size: 0, is_dir: false, modified: "" })
    expect("thumb" in o).toBe(false)
  })

  it("keeps empty strings, zero and false, and returns clean entries as they are", () => {
    const clean = { name: "b", thumb: "", size: 0, is_dir: false }
    expect(withoutNulls([clean])[0]).toBe(clean)
  })
})
