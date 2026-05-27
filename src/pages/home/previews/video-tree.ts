import { ObjType } from "~/types"
import type { Obj } from "~/types"

export interface VideoTreeNode {
  name: string
  path: string
  type: "folder" | "file"
  objType?: ObjType
  children?: VideoTreeNode[]
}

function joinPath(base: string, name: string): string {
  if (base.endsWith("/")) return base + name
  return base + "/" + name
}

export function buildVideoTree(
  objs: Obj[],
  currentPath: string,
): VideoTreeNode[] {
  const folders: VideoTreeNode[] = []
  const files: VideoTreeNode[] = []

  for (const obj of objs) {
    if (obj.is_dir) {
      folders.push({
        name: obj.name,
        path: joinPath(currentPath, obj.name),
        type: "folder",
        children: [],
      })
    } else {
      files.push({
        name: obj.name,
        path: joinPath(currentPath, obj.name),
        type: "file",
        objType: obj.type,
      })
    }
  }

  return [...folders, ...files]
}
