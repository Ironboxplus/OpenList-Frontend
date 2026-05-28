import { Box, HStack, Icon, Text } from "@hope-ui/solid"
import { createSignal, For, Show } from "solid-js"
import { ObjType } from "~/types"
import type { Obj } from "~/types"
import { fsList } from "~/utils/api"
import { buildVideoTree, type VideoTreeNode } from "./video-tree"
import {
  BsChevronRight,
  BsPlayFill,
  BsFolderFill,
  BsFileEarmark,
  BsFileEarmarkText,
  BsFileEarmarkImage,
  BsFileEarmarkMusic,
  BsArrowUpShort,
} from "solid-icons/bs"

function fileIcon(objType?: ObjType) {
  switch (objType) {
    case ObjType.VIDEO:
      return BsPlayFill
    case ObjType.AUDIO:
      return BsFileEarmarkMusic
    case ObjType.IMAGE:
      return BsFileEarmarkImage
    case ObjType.TEXT:
      return BsFileEarmarkText
    default:
      return BsFileEarmark
  }
}

function fileIconColor(objType?: ObjType, isActive?: boolean) {
  if (isActive) return "$accent9"
  switch (objType) {
    case ObjType.VIDEO:
      return "$accent9"
    case ObjType.AUDIO:
      return "$success9"
    case ObjType.IMAGE:
      return "$warning9"
    default:
      return "$neutral9"
  }
}

function pathDir(p: string): string {
  const i = p.lastIndexOf("/")
  return i <= 0 ? "/" : p.substring(0, i)
}

function pathName(p: string): string {
  const i = p.lastIndexOf("/")
  return i < 0 ? p : p.substring(i + 1)
}

interface VideoTreeListProps {
  currentPath: string
  objs: Obj[]
  currentVideoName: string
  onSelect: (videoPath: string) => void
}

const TreeItem = (props: {
  node: VideoTreeNode
  currentVideoName: string
  onSelect: (path: string) => void
  onNavigateInto?: (path: string, children: VideoTreeNode[]) => void
  depth: number
}) => {
  const [expanded, setExpanded] = createSignal(
    (props.node.children ?? []).length > 0,
  )
  const [children, setChildren] = createSignal<VideoTreeNode[]>(
    props.node.children ?? [],
  )
  const [loading, setLoading] = createSignal(false)

  const isActive = () => props.node.name === props.currentVideoName

  const loadChildren = async () => {
    if (children().length > 0) return children()
    setLoading(true)
    try {
      const resp = await fsList(props.node.path, "", 1, 0)
      if (resp.code === 200 && resp.data?.content) {
        const nodes = buildVideoTree(resp.data.content, props.node.path)
        setChildren(nodes)
        return nodes
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
    return []
  }

  const handleToggle = async (e: Event) => {
    e.stopPropagation()
    if (!expanded()) {
      await loadChildren()
      setExpanded(true)
    } else {
      setExpanded(false)
    }
  }

  const handleClick = async () => {
    if (props.node.type === "file") {
      props.onSelect(props.node.name)
      return
    }
    const loaded = await loadChildren()
    setExpanded(true)
    props.onNavigateInto?.(props.node.path, loaded)
  }

  return (
    <Box>
      <HStack
        spacing="$1"
        px="$2"
        py="$1"
        cursor="pointer"
        borderRadius="$sm"
        bg={isActive() ? "$accent3" : "transparent"}
        _hover={{ bg: isActive() ? "$accent3" : "$neutral3" }}
        onClick={handleClick}
        pl={`${props.depth * 16 + 8}px`}
      >
        <Show when={props.node.type === "folder"}>
          <Icon
            as={BsChevronRight}
            boxSize="12px"
            color="$neutral9"
            transform={expanded() ? "rotate(90deg)" : "none"}
            transition="transform 0.15s"
            flexShrink={0}
            cursor="pointer"
            onClick={handleToggle}
          />
          <Icon
            as={BsFolderFill}
            boxSize="14px"
            color="$warning9"
            flexShrink={0}
          />
        </Show>
        <Show when={props.node.type === "file"}>
          <Box w="12px" flexShrink={0} />
          <Icon
            as={fileIcon(props.node.objType)}
            boxSize="14px"
            color={fileIconColor(props.node.objType, isActive())}
            flexShrink={0}
          />
        </Show>
        <Text
          fontSize="$xs"
          noOfLines={1}
          color={isActive() ? "$accent11" : "$neutral11"}
          fontWeight={isActive() ? "$semibold" : "$normal"}
          title={props.node.name}
        >
          {loading() ? "..." : props.node.name}
        </Text>
      </HStack>
      <Show when={expanded() && children().length > 0}>
        <For each={children()}>
          {(child) => (
            <TreeItem
              node={child}
              currentVideoName={props.currentVideoName}
              onSelect={props.onSelect}
              onNavigateInto={props.onNavigateInto}
              depth={props.depth + 1}
            />
          )}
        </For>
      </Show>
    </Box>
  )
}

export const VideoTreeList = (props: VideoTreeListProps) => {
  const baseTree = () => buildVideoTree(props.objs, props.currentPath)
  const [rootPath, setRootPath] = createSignal(props.currentPath)
  const [rootTree, setRootTree] = createSignal<VideoTreeNode[]>([])
  const [loadingUp, setLoadingUp] = createSignal(false)

  const tree = () => (rootTree().length > 0 ? rootTree() : baseTree())
  const canGoUp = () => rootPath() !== "/" && rootPath() !== ""

  const handleNavigateInto = (path: string, children: VideoTreeNode[]) => {
    setRootTree(children)
    setRootPath(path)
  }

  const handleUp = async () => {
    const cur = rootPath()
    const parent = pathDir(cur)
    if (parent === cur) return
    setLoadingUp(true)
    try {
      const resp = await fsList(parent, "", 1, 0)
      if (resp.code === 200 && resp.data?.content) {
        const parentTree = buildVideoTree(resp.data.content, parent)
        const curName = pathName(cur)
        const curFolder = parentTree.find(
          (n) => n.type === "folder" && n.name === curName,
        )
        if (curFolder) {
          curFolder.children = tree()
        }
        setRootTree(parentTree)
        setRootPath(parent)
      }
    } catch {
      /* ignore */
    }
    setLoadingUp(false)
  }

  return (
    <Box
      maxH="300px"
      overflowY="auto"
      w="$full"
      borderWidth="1px"
      borderColor="$neutral6"
      borderRadius="$md"
      py="$1"
    >
      <Show when={canGoUp()}>
        <HStack
          spacing="$1"
          px="$2"
          py="$1"
          cursor="pointer"
          borderRadius="$sm"
          _hover={{ bg: "$neutral3" }}
          onClick={handleUp}
        >
          <Icon as={BsArrowUpShort} boxSize="14px" color="$neutral9" />
          <Text fontSize="$xs" color="$neutral11">
            {loadingUp() ? "..." : ".."}
          </Text>
        </HStack>
      </Show>
      <Show
        when={tree().length > 0}
        fallback={
          <Text fontSize="$xs" color="$neutral8" px="$2" py="$1">
            No files found
          </Text>
        }
      >
        <For each={tree()}>
          {(node) => (
            <TreeItem
              node={node}
              currentVideoName={props.currentVideoName}
              onSelect={props.onSelect}
              onNavigateInto={handleNavigateInto}
              depth={0}
            />
          )}
        </For>
      </Show>
    </Box>
  )
}
