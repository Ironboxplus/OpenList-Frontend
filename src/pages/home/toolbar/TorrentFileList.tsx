import { createSignal, For, Show, createMemo } from "solid-js"
import { TorrentFile } from "~/types"
import { useT } from "~/hooks"
import { CheckboxField } from "~/components/ui/toggle-field"

// 树节点类型
interface TreeNode {
  name: string
  path: string
  isDir: boolean
  size: number
  children: TreeNode[]
  fileIndex?: number // 对应 files 数组中的索引（仅叶子节点）
  allIndices?: number[] // 目录下所有文件索引（仅目录节点，构建时缓存）
}

// 将扁平文件列表构建为树形结构
function buildFileTree(files: TorrentFile[]): TreeNode[] {
  const root: TreeNode = {
    name: "",
    path: "",
    isDir: true,
    size: 0,
    children: [],
  }

  files.forEach((file, index) => {
    const parts = file.path.split("/")
    let current = root

    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        // 叶子节点（文件）
        current.children.push({
          name: part,
          path: file.path,
          isDir: false,
          size: file.size,
          children: [],
          fileIndex: index,
        })
      } else {
        // 目录节点
        let dirNode = current.children.find((c) => c.isDir && c.name === part)
        if (!dirNode) {
          dirNode = {
            name: part,
            path: parts.slice(0, i + 1).join("/"),
            isDir: true,
            size: 0,
            children: [],
          }
          current.children.push(dirNode)
        }
        current = dirNode
      }
    })
  })

  // 计算目录大小并缓存目录的所有子文件索引
  function calcDirMetadata(node: TreeNode): number {
    if (!node.isDir) return node.size
    node.size = node.children.reduce(
      (sum, child) => sum + calcDirMetadata(child),
      0,
    )
    node.allIndices = getAllFileIndices(node)
    return node.size
  }
  root.children.forEach(calcDirMetadata)

  // 如果只有一个根目录，直接返回其子节点
  if (root.children.length === 1 && root.children[0].isDir) {
    return root.children
  }
  return root.children
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

// 获取目录下所有文件的索引
function getAllFileIndices(node: TreeNode): number[] {
  if (!node.isDir) {
    return node.fileIndex !== undefined ? [node.fileIndex] : []
  }
  return node.children.flatMap(getAllFileIndices)
}

export interface TorrentFileListProps {
  files: TorrentFile[]
  selectedFiles: number[]
  onSelectionChange: (selected: number[]) => void
}

export const TorrentFileList = (props: TorrentFileListProps) => {
  const t = useT()

  const tree = createMemo(() => buildFileTree(props.files))

  // 使用 Set 加速成员检测
  const selectedSet = createMemo(() => new Set(props.selectedFiles))

  const allSelected = createMemo(
    () => props.selectedFiles.length === props.files.length,
  )
  const noneSelected = createMemo(() => props.selectedFiles.length === 0)

  const toggleAll = () => {
    if (allSelected()) {
      props.onSelectionChange([])
    } else {
      props.onSelectionChange(props.files.map((_, i) => i))
    }
  }

  const toggleFile = (index: number) => {
    const set = selectedSet()
    if (set.has(index)) {
      props.onSelectionChange(props.selectedFiles.filter((i) => i !== index))
    } else {
      props.onSelectionChange([...props.selectedFiles, index])
    }
  }

  const toggleDir = (node: TreeNode) => {
    const indices = node.allIndices ?? getAllFileIndices(node)
    const set = selectedSet()
    const allChecked = indices.every((i) => set.has(i))
    if (allChecked) {
      const removeSet = new Set(indices)
      props.onSelectionChange(
        props.selectedFiles.filter((i) => !removeSet.has(i)),
      )
    } else {
      const newSelection = [...new Set([...props.selectedFiles, ...indices])]
      props.onSelectionChange(newSelection)
    }
  }

  return (
    <div class="flex flex-col items-stretch gap-y-1">
      {/* 全选/统计 */}
      <div class="flex flex-row justify-between items-center p-1">
        <CheckboxField
          checked={allSelected()}
          indeterminate={!allSelected() && !noneSelected()}
          onChange={toggleAll}
        >
          <p class="text-sm">
            {t("home.toolbar.offline_download_enhanced.select_all")} (
            {props.selectedFiles.length}/{props.files.length})
          </p>
        </CheckboxField>
        <p class="text-xs text-muted-foreground">
          {formatFileSize(
            props.selectedFiles.reduce(
              (sum, i) => sum + (props.files[i]?.size || 0),
              0,
            ),
          )}
        </p>
      </div>

      {/* 文件树 */}
      <div class="max-h-[300px] overflow-y-auto border border-border rounded-sm p-1">
        <For each={tree()}>
          {(node) => (
            <TreeNodeItem
              node={node}
              selectedSet={selectedSet()}
              onToggleFile={toggleFile}
              onToggleDir={toggleDir}
              depth={0}
            />
          )}
        </For>
      </div>
    </div>
  )
}

// 树节点组件
function TreeNodeItem(props: {
  node: TreeNode
  selectedSet: Set<number>
  onToggleFile: (index: number) => void
  onToggleDir: (node: TreeNode) => void
  depth: number
}) {
  const [expanded, setExpanded] = createSignal(true)

  const isChecked = createMemo(() => {
    if (!props.node.isDir) {
      return props.selectedSet.has(props.node.fileIndex!)
    }
    const indices = props.node.allIndices ?? getAllFileIndices(props.node)
    return indices.length > 0 && indices.every((i) => props.selectedSet.has(i))
  })

  const isIndeterminate = createMemo(() => {
    if (!props.node.isDir) return false
    const indices = props.node.allIndices ?? getAllFileIndices(props.node)
    const checkedCount = indices.filter((i) => props.selectedSet.has(i)).length
    return checkedCount > 0 && checkedCount < indices.length
  })

  return (
    <div style={{ "padding-left": `${props.depth * 16}px` }}>
      <div class="flex items-center gap-x-1 rounded-xs px-1 py-0.5 hover:bg-muted">
        {/* 展开/折叠按钮 */}
        <Show when={props.node.isDir}>
          <div
            class="cursor-pointer w-[16px] text-center text-xs text-muted-foreground shrink-0"
            onClick={() => setExpanded(!expanded())}
          >
            {expanded() ? "▼" : "▶"}
          </div>
        </Show>
        <Show when={!props.node.isDir}>
          <div class="w-[16px] shrink-0" />
        </Show>

        {/* 复选框 */}
        <CheckboxField
          checked={isChecked()}
          indeterminate={isIndeterminate()}
          onChange={() => {
            if (props.node.isDir) {
              props.onToggleDir(props.node)
            } else {
              props.onToggleFile(props.node.fileIndex!)
            }
          }}
        />

        {/* 图标 */}
        <p class="text-sm shrink-0">{props.node.isDir ? "📁" : "📄"}</p>

        {/* 文件名 */}
        <p class="flex-1 truncate text-sm" title={props.node.name}>
          {props.node.name}
        </p>

        {/* 文件大小 */}
        <p class="text-xs text-muted-foreground shrink-0">
          {formatFileSize(props.node.size)}
        </p>
      </div>

      {/* 子节点 */}
      <Show when={props.node.isDir && expanded()}>
        <For each={props.node.children}>
          {(child) => (
            <TreeNodeItem
              node={child}
              selectedSet={props.selectedSet}
              onToggleFile={props.onToggleFile}
              onToggleDir={props.onToggleDir}
              depth={props.depth + 1}
            />
          )}
        </For>
      </Show>
    </div>
  )
}
