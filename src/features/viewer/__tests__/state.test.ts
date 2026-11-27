import { afterEach, describe, expect, it } from "vitest"
import { ObjStore, pageOf, setSingleFileShare, setViewerPath } from "~/store"
import { Obj, ObjType } from "~/types"
import { drawable, whereOf } from "../state"

const file = (name: string, type: ObjType, size = 10) =>
  ({ name, type, size, is_dir: false }) as Obj

describe("where a file opens", () => {
  it("a video with movi goes to the dock", () => {
    const v = file("a.mp4", ObjType.VIDEO)
    expect(whereOf(v, [{ key: "movi_video" }, { key: "download" }])).toBe(
      "dock",
    )
  })
  it("an image the browser draws goes to the image viewer, HEIF to the document viewer", () => {
    expect(
      whereOf(file("a.jpg", ObjType.IMAGE), [
        { key: "image" },
        { key: "download" },
      ]),
    ).toBe("image")
    expect(drawable(file("a.heic", ObjType.IMAGE))).toBe(false)
    expect(
      whereOf(file("a.heic", ObjType.IMAGE), [
        { key: "image" },
        { key: "download" },
      ]),
    ).toBe("doc")
  })
  it("download first (nothing previews it, or the site downloads by default) is the small dialog", () => {
    expect(
      whereOf(file("a.bin", ObjType.UNKNOWN), [
        { key: "download" },
        { key: "text_editor" },
      ]),
    ).toBe("dialog")
    expect(whereOf(file("a.bin", ObjType.UNKNOWN), [])).toBe("dialog")
  })
  it("an asked-for preview wins", () => {
    const v = file("a.mp4", ObjType.VIDEO)
    const list = [{ key: "movi_video" }, { key: "video" }, { key: "download" }]
    expect(whereOf(v, list, "video")).toBe("doc")
    expect(
      whereOf(
        file("a.bin", ObjType.UNKNOWN),
        [{ key: "download" }, { key: "text_editor" }],
        "text_editor",
      ),
    ).toBe("doc")
    // one it does not have is ignored
    expect(whereOf(v, list, "pdf")).toBe("dock")
  })
})

describe("the page of an address", () => {
  afterEach(() => {
    setViewerPath(undefined)
    setSingleFileShare(false)
    ObjStore.set({ listed: "", objs: [] })
  })
  it("a file of the listed folder is shown over that folder", () => {
    ObjStore.set({ listed: "/m", objs: [file("a.txt", ObjType.TEXT)] })
    expect(pageOf("/m/a.txt")).toBe("/m")
    expect(pageOf("/m")).toBe("/m")
    // not listed there: a page of its own (a folder, or a file to look up)
    expect(pageOf("/m/b")).toBe("/m/b")
  })
  it("the file a link named is shown over its folder", () => {
    setViewerPath("/x/y.mp4")
    expect(pageOf("/x/y.mp4")).toBe("/x")
  })
  it("a share of one file is its own page", () => {
    setViewerPath("/@s/abc")
    setSingleFileShare(true)
    expect(pageOf("/@s/abc")).toBe("/@s/abc")
  })
})
