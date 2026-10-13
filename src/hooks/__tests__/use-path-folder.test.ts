import { beforeEach, describe, expect, it, vi } from "vitest"

const fsList = vi.fn()
vi.mock("~/utils", async (orig) => ({
  ...(await orig<typeof import("~/utils")>()),
  fsList: (...a: unknown[]) => fsList(...a),
  fsGet: vi.fn(),
}))
vi.mock("../useRouter", () => ({
  useRouter: () => ({
    pathname: () => "/a/dir",
    to: vi.fn(),
    searchParams: {},
  }),
}))

import { ObjStore, objStore, State } from "~/store"
import { Obj, ObjType } from "~/types"
import { usePath } from "../usePath"

const file = { name: "v.mkv", type: ObjType.VIDEO, is_dir: false } as Obj
const listing = {
  code: 200,
  data: {
    content: [{ name: "w.mkv", type: ObjType.VIDEO, is_dir: false }],
    total: 1,
    readme: "",
    header: "",
    write: false,
    provider: "Local",
  },
}

beforeEach(() => {
  fsList.mockReset()
  fsList.mockResolvedValue(listing)
  ObjStore.setObj(file)
  ObjStore.setState(State.File)
})

describe("is_dir of the current object", () => {
  it("a preview page's background sibling listing leaves the open file a file", async () => {
    const { handleFolder } = usePath()
    await handleFolder("/a/dir", undefined, undefined, false, undefined, true)
    expect(objStore.objs).toHaveLength(1)
    expect(objStore.obj.is_dir).toBe(false)
    expect(objStore.state).toBe(State.File)
  })

  it("entering a folder marks the current object as a folder", async () => {
    const { handleFolder } = usePath()
    await handleFolder("/a/dir")
    expect(objStore.obj.is_dir).toBe(true)
    expect(objStore.state).toBe(State.Folder)
  })

  it("setObjs alone does not touch the current object", () => {
    ObjStore.setObjs([])
    expect(objStore.obj.is_dir).toBe(false)
  })
})
