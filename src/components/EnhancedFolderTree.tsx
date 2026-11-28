import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/utils/cn"
import { BiSolidRightArrow, BiSolidFolderOpen } from "solid-icons/bi"
import { TbFile, TbFolder } from "solid-icons/tb"
import {
  Accessor,
  createContext,
  createSignal,
  useContext,
  Show,
  For,
  Setter,
  createEffect,
  on,
} from "solid-js"
import { useFetch, useT, useUtil } from "~/hooks"
import { getMainColor, password } from "~/store"
import { Obj } from "~/types"
import { pathBase, handleResp, pathJoin, createMatcher } from "~/utils"
import { fsList } from "~/utils/api"

export type EnhancedFolderTreeHandler = {
  setPath: Setter<string>
}

export interface EnhancedFolderTreeProps {
  onChange: (path: string) => void
  forceRoot?: boolean
  autoOpen?: boolean
  handle?: (handler: EnhancedFolderTreeHandler) => void
  showEmptyIcon?: boolean
  showHiddenFolder?: boolean
}

interface EnhancedFolderTreeContext extends Omit<
  EnhancedFolderTreeProps,
  "handle"
> {
  value: Accessor<string>
}

const context = createContext<EnhancedFolderTreeContext>()

export const EnhancedFolderTree = (props: EnhancedFolderTreeProps) => {
  const [path, setPath] = createSignal("/")
  props.handle?.({ setPath })
  return (
    <div class="w-full overflow-x-auto folder-tree-box">
      <context.Provider
        value={{
          value: path,
          onChange: (val) => {
            setPath(val)
            props.onChange(val)
          },
          autoOpen: props.autoOpen ?? false,
          forceRoot: props.forceRoot ?? false,
          showEmptyIcon: props.showEmptyIcon ?? false,
          showHiddenFolder: props.showHiddenFolder ?? true,
        }}
      >
        <EnhancedFolderTreeNode path="/" />
      </context.Provider>
    </div>
  )
}

/** A folder's or file's name: the selected one is tinted, the others grey on hover. */
const nodeName = (selected: boolean) =>
  cn(
    "cursor-pointer rounded-md px-1 text-base whitespace-nowrap",
    selected ? "bg-primary/20" : "hover:bg-[rgba(132,133,141,0.18)]",
  )

const EnhancedFolderTreeNode = (props: { path: string }) => {
  const { isHidePath } = useUtil()
  const [items, setItems] = createSignal<Obj[]>()
  const {
    value,
    onChange,
    forceRoot,
    autoOpen,
    showEmptyIcon,
    showHiddenFolder,
  } = useContext(context)!

  const emptyIconVisible = () =>
    Boolean(showEmptyIcon && items() !== undefined && !items()?.length)

  const [loading, fetchItems] = useFetch(() =>
    fsList(props.path, password(), 1, 0, false),
  )

  let isLoaded = false

  const load = async () => {
    if (items()?.length) return
    const resp = await fetchItems()
    handleResp(
      resp,
      (data) => {
        isLoaded = true
        setItems(data.content || [])
      },
      () => {
        if (isOpen()) onToggle()
      },
    )
  }

  const { isOpen, onToggle } = createDisclosure()
  const active = () => value() === props.path
  const isMatchedFolder = createMatcher(props.path)

  const checkIfShouldOpen = async (pathname: string) => {
    if (!autoOpen) return
    if (isMatchedFolder(pathname)) {
      if (!isOpen()) onToggle()
      if (!isLoaded) load()
    }
  }

  createEffect(on(value, checkIfShouldOpen))

  const isHiddenFolder = () =>
    isHidePath(props.path) && !isMatchedFolder(value())

  const folders = () => items()?.filter((item) => item.is_dir) || []
  const files = () => items()?.filter((item) => !item.is_dir) || []

  return (
    <Show when={showHiddenFolder || !isHiddenFolder()}>
      <div>
        <div class="flex flex-row items-center gap-x-2">
          <Show
            when={!loading()}
            fallback={<Spinner size="sm" color={getMainColor()} />}
          >
            <Show
              when={!emptyIconVisible()}
              fallback={<BiSolidFolderOpen style={{ color: getMainColor() }} />}
            >
              <BiSolidRightArrow
                class="cursor-pointer transition-transform duration-200"
                style={{
                  color: getMainColor(),
                  transform: isOpen() ? "rotate(90deg)" : "none",
                }}
                onClick={() => {
                  onToggle()
                  if (isOpen()) {
                    load()
                  }
                }}
              />
            </Show>
          </Show>
          <TbFolder class="cursor-pointer" style={{ color: getMainColor() }} />
          <p
            class={nodeName(active())}
            onClick={() => {
              onChange(props.path)
            }}
          >
            {props.path === "/" ? "root" : pathBase(props.path)}
          </p>
        </div>

        <Show when={isOpen()}>
          <div class="flex flex-col mt-1 pl-4 items-start gap-y-1">
            <For each={folders()}>
              {(item) => (
                <EnhancedFolderTreeNode
                  path={pathJoin(props.path, item.name)}
                />
              )}
            </For>

            <For each={files()}>
              {(item) => (
                <div class="flex flex-row items-center w-full gap-x-2">
                  <div class="w-[16px]" />
                  <TbFile
                    class="cursor-pointer"
                    style={{ color: getMainColor() }}
                  />
                  <p
                    class={nodeName(
                      value() === pathJoin(props.path, item.name),
                    )}
                    onClick={() => {
                      onChange(pathJoin(props.path, item.name))
                    }}
                  >
                    {item.name}
                  </p>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  )
}

function createDisclosure() {
  const [isOpen, setIsOpen] = createSignal(false)
  return {
    isOpen,
    onToggle: () => setIsOpen(!isOpen()),
    onOpen: () => setIsOpen(true),
    onClose: () => setIsOpen(false),
  }
}
