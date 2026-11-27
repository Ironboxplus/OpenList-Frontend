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
    isShare: () => false,
  }),
}))

import { ObjStore, objStore, setFileShown, State } from "~/store"
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

  it("a listing under an open viewer leaves the viewer's file the current object", async () => {
    setFileShown(true)
    try {
      const { handleFolder } = usePath()
      await handleFolder("/a/dir")
      expect(objStore.obj.is_dir).toBe(false)
      expect(objStore.listed).toBe("/a/dir")
      expect(objStore.state).toBe(State.Folder)
    } finally {
      setFileShown(false)
    }
  })

  it("setObjs alone does not touch the current object", () => {
    ObjStore.setObjs([])
    expect(objStore.obj.is_dir).toBe(false)
  })
})

// P4: a refresh keeps the folder in sight, so its rows change in place
describe("refresh", () => {
  const stateWhileListing = async (listed: string) => {
    ObjStore.setState(State.Folder)
    ObjStore.set({ listed })
    let during: State | undefined
    fsList.mockImplementation(async () => {
      during = objStore.state
      return listing
    })
    const { refresh, setPathAs } = usePath()
    setPathAs("/a/dir")
    await refresh()
    return during
  }
  it("lists the folder in sight again without taking it away", async () => {
    expect(await stateWhileListing("/a/dir")).toBe(State.Folder)
  })
  it("a folder not in sight yet still shows the skeleton", async () => {
    expect(await stateWhileListing("/b")).toBe(State.FetchingObjs)
  })
})
