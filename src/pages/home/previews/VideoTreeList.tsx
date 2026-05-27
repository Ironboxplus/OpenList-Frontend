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
  depth: number
}) => {
  const [expanded, setExpanded] = createSignal(false)
  const [children, setChildren] = createSignal<VideoTreeNode[]>(
    props.node.children ?? [],
  )
  const [loading, setLoading] = createSignal(false)

  const isActive = () => props.node.name === props.currentVideoName

  const handleClick = async () => {
    if (props.node.type === "file") {
      props.onSelect(props.node.name)
      return
    }
    if (!expanded()) {
      if (children().length === 0) {
        setLoading(true)
        try {
          const resp = await fsList(props.node.path, "", 1, 0)
          if (resp.code === 200 && resp.data?.content) {
            setChildren(buildVideoTree(resp.data.content, props.node.path))
          }
        } catch {
          /* ignore */
        }
        setLoading(false)
      }
      setExpanded(true)
    } else {
      setExpanded(false)
    }
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
              depth={props.depth + 1}
            />
          )}
        </For>
      </Show>
    </Box>
  )
}

export const VideoTreeList = (props: VideoTreeListProps) => {
  const tree = () => buildVideoTree(props.objs, props.currentPath)

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
              depth={0}
            />
          )}
        </For>
      </Show>
    </Box>
  )
}
