import { describe, expect, it, vi } from "vitest"

vi.mock("~/store", () => ({
  objStore: {},
  password: () => "",
  selectedObjs: () => [],
  State: { File: 2 },
  me: () => ({ base_path: "/" }),
}))
vi.mock(".", () => ({ useRouter: vi.fn(), useT: vi.fn(), useUtil: vi.fn() }))

import { Obj } from "~/types"
import { locateObj } from "../useLink"

const obj = (name: string) => ({ name }) as Obj

describe("locateObj", () => {
  it("lists a folder entry under the folder path", () => {
    expect(locateObj(false, "/a/dir", false, obj("v.mkv"))).toEqual({
      dir: "/a/dir",
      obj: obj("v.mkv"),
    })
  })

  it("uses the parent of a file page", () => {
    expect(locateObj(true, "/a/dir/v.mkv", false, obj("v.mkv")).dir).toBe(
      "/a/dir",
    )
  })

  it("keeps a file inside a shared folder under its share path", () => {
    expect(locateObj(true, "/@s/sid/dir/v.mkv", true, obj("v.mkv")).dir).toBe(
      "/@s/sid/dir",
    )
  })

  it("treats /@s/<id> as the single shared file itself", () => {
    expect(locateObj(true, "/@s/sid", true, obj("v.mkv"))).toEqual({
      dir: "/@s/sid",
      obj: obj(""),
    })
  })
})
