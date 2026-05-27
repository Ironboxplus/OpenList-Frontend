import { describe, it, expect } from "vitest"
import { buildVideoTree } from "../video-tree"
import { ObjType } from "~/types"
import type { Obj } from "~/types"

function makeObj(
  name: string,
  is_dir: boolean,
  type: ObjType = ObjType.UNKNOWN,
): Obj {
  return {
    name,
    size: 0,
    is_dir,
    created: "",
    modified: "",
    thumb: "",
    type: is_dir ? ObjType.FOLDER : type,
  }
}

describe("buildVideoTree", () => {
  it("returns all files from flat list", () => {
    const objs: Obj[] = [
      makeObj("movie.mkv", false, ObjType.VIDEO),
      makeObj("photo.jpg", false, ObjType.IMAGE),
      makeObj("clip.mp4", false, ObjType.VIDEO),
    ]
    const tree = buildVideoTree(objs, "/root")
    expect(tree).toHaveLength(3)
    expect(tree[0].name).toBe("movie.mkv")
    expect(tree[0].type).toBe("file")
    expect(tree[0].objType).toBe(ObjType.VIDEO)
    expect(tree[1].name).toBe("photo.jpg")
    expect(tree[1].objType).toBe(ObjType.IMAGE)
  })

  it("includes folders as expandable nodes", () => {
    const objs: Obj[] = [
      makeObj("Season 1", true),
      makeObj("movie.mkv", false, ObjType.VIDEO),
    ]
    const tree = buildVideoTree(objs, "/root")
    expect(tree).toHaveLength(2)

    const folder = tree.find((n) => n.type === "folder")!
    expect(folder).toBeDefined()
    expect(folder.name).toBe("Season 1")
    expect(folder.path).toBe("/root/Season 1")
    expect(folder.children).toEqual([])
  })

  it("returns all file types including non-video", () => {
    const objs: Obj[] = [
      makeObj("readme.txt", false, ObjType.TEXT),
      makeObj("photo.jpg", false, ObjType.IMAGE),
      makeObj("sub.ass", false, ObjType.UNKNOWN),
    ]
    const tree = buildVideoTree(objs, "/root")
    expect(tree).toHaveLength(3)
  })

  it("builds correct paths for nested items", () => {
    const objs: Obj[] = [makeObj("episode.mkv", false, ObjType.VIDEO)]
    const tree = buildVideoTree(objs, "/shows/breaking bad/Season 1")
    expect(tree[0].path).toBe("/shows/breaking bad/Season 1/episode.mkv")
  })

  it("puts folders before files", () => {
    const objs: Obj[] = [
      makeObj("z-movie.mp4", false, ObjType.VIDEO),
      makeObj("A-Folder", true),
      makeObj("a-movie.mp4", false, ObjType.VIDEO),
    ]
    const tree = buildVideoTree(objs, "/root")
    expect(tree[0].type).toBe("folder")
    expect(tree[0].name).toBe("A-Folder")
  })
})
