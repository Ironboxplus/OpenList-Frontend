import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import { BiSolidRightArrow, BiSolidFolderOpen } from "solid-icons/bi"
import {
  TbX,
  TbCheck,
  TbChevronRight,
  TbFolderFilled,
  TbHome,
} from "solid-icons/tb"
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
  JSXElement,
  onMount,
} from "solid-js"
import { useFetch, useT, useUtil } from "~/hooks"
import { getMainColor, password } from "~/store"
import { Obj } from "~/types"
import {
  pathBase,
  handleResp,
  handleRespWithNotifySuccess,
  pathJoin,
  fsDirs,
  createMatcher,
  fsMkdir,
  validateFilename,
  notify,
} from "~/utils"
import {
  createDisclosure,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "~/components/overlay"
import { Fold } from "~/components/ui/collapsible"
import { cn } from "~/utils/cn"

export type FolderTreeHandler = {
  setPath: Setter<string>
  startCreateFolder: () => void
}
export interface FolderTreeProps {
  onChange: (path: string) => void
  forceRoot?: boolean
  autoOpen?: boolean
  handle?: (handler: FolderTreeHandler) => void
  showEmptyIcon?: boolean
  showHiddenFolder?: boolean
  /** Side-nav look: full-width rows with a caret, the current folder tinted. */
  variant?: "nav"
  /** nav variant: the root row's text (the root is the Files entry itself). */
  rootLabel?: string
}
interface FolderTreeContext extends Omit<FolderTreeProps, "handle"> {
  value: Accessor<string>
  creatingFolderPath: Accessor<string | null>
  setCreatingFolderPath: Setter<string | null>
}
const context = createContext<FolderTreeContext>()
export const FolderTree = (props: FolderTreeProps) => {
  const [path, setPath] = createSignal("/")
  const [creatingFolderPath, setCreatingFolderPath] = createSignal<
    string | null
  >(null)

  const startCreateFolder = () => {
    setCreatingFolderPath(path())
  }

  props.handle?.({
    setPath,
    startCreateFolder,
  })

  // The box is the tree's one scroll container, both ways (overflow-x auto
  // makes overflow-y auto too). In the nav look it is a flex item of the side
  // nav and shrinks to the height left there, and its rows are as wide as the
  // widest one, so a tinted row spans the whole width when scrolled sideways.
  const rows = (tree: JSXElement) =>
    props.variant === "nav" ? <div class="w-max min-w-full">{tree}</div> : tree
  return (
    <div
      class={cn(
        "w-full overflow-x-auto",
        props.variant === "nav"
          ? "folder-tree-box [scrollbar-width:thin]"
          : "folder-tree-box",
      )}
    >
      {rows(
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
            variant: props.variant,
            rootLabel: props.rootLabel,
            creatingFolderPath,
            setCreatingFolderPath,
          }}
        >
          <FolderTreeNode path="/" />
        </context.Provider>,
      )}
    </div>
  )
}

const FolderTreeNode = (props: { path: string; depth?: number }) => {
  const { isHidePath } = useUtil()
  const [children, setChildren] = createSignal<Obj[]>()
  const {
    value,
    onChange,
    forceRoot,
    autoOpen,
    showEmptyIcon,
    showHiddenFolder,
    variant,
    rootLabel,
    creatingFolderPath,
    setCreatingFolderPath,
  } = useContext(context)!
  const emptyIconVisible = () =>
    Boolean(showEmptyIcon && children() !== undefined && !children()?.length)
  const [loading, fetchDirs] = useFetch(() =>
    fsDirs(props.path, password(), forceRoot),
  )
  let isLoaded = false
  const load = async (force = false) => {
    if (!force && children()?.length) return
    const resp = await fetchDirs() // this api may return null
    handleResp(
      resp,
      (data) => {
        isLoaded = true
        setChildren(data)
      },
      () => {
        if (isOpen()) onToggle() // close folder while failed
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

  createEffect(() => {
    if (creatingFolderPath() === props.path) {
      if (!isOpen()) onToggle()
      if (!isLoaded) load()
    }
  })

  const isHiddenFolder = () =>
    isHidePath(props.path) && !isMatchedFolder(value())
  const toggle = () => {
    onToggle()
    if (isOpen()) {
      load()
    }
  }
  const depth = () => props.depth ?? 0
  const isRoot = () => props.path === "/"
  let rowEl: HTMLDivElement | undefined
  // Nav look: the current folder's row comes into view by itself, vertically
  // only. scrollLeft stays where the user left it: following a deep row
  // sideways scrolled the shallow rows (and the root) out of the nav.
  createEffect(() => {
    if (variant !== "nav" || !active()) return
    requestAnimationFrame(() => {
      const box = rowEl?.closest<HTMLElement>(".folder-tree-box")
      if (!box || !rowEl) return
      const b = box.getBoundingClientRect()
      const row = rowEl.getBoundingClientRect()
      const top = b.top + box.clientTop
      const bottom = top + box.clientHeight
      if (row.top < top) box.scrollTop += row.top - top
      else if (row.bottom > bottom) box.scrollTop += row.bottom - bottom
    })
  })
  // Rows of the nav look: the caret toggles, the rest of the row opens the folder.
  const navNode = () => (
    <div role="treeitem" aria-expanded={isOpen()} aria-selected={active()}>
      <div
        ref={rowEl}
        class="flex h-8 cursor-pointer items-center gap-1 rounded-lg pr-2 text-sm transition-colors hover:bg-accent"
        classList={{ "bg-primary/20 font-medium": active() }}
        style={{ "padding-left": `${depth() * 16 + 4}px` }}
        onClick={() => onChange(props.path)}
      >
        <button
          type="button"
          aria-label="toggle"
          // 32px to click, laid out as the 20px caret it shows. The box starts
          // at the row's left edge (its 4px padding less 4px), not 2px past it
          // where the tree's scroller clips it; pr-1 keeps the chevron in place.
          class="-ml-1 -mr-2 inline-flex size-8 shrink-0 items-center justify-center rounded bg-transparent pr-1 text-muted-foreground"
          classList={{ invisible: emptyIconVisible() }}
          onClick={(e) => {
            e.stopPropagation()
            toggle()
          }}
        >
          <Show
            when={!loading()}
            fallback={<Spinner size="sm" color={getMainColor()} />}
          >
            {/* turns on the clock of the fold below (220ms in, 180ms out) */}
            <TbChevronRight
              class={
                isOpen()
                  ? "size-3.5 rotate-90 transition-transform duration-(--motion-collapse-open) ease-emph-decel"
                  : "size-3.5 transition-transform duration-(--motion-collapse-close) ease-emph-accel"
              }
            />
          </Show>
        </button>
        <Show
          when={isRoot()}
          fallback={
            <TbFolderFilled class="size-4 shrink-0 text-muted-foreground" />
          }
        >
          <TbHome class="size-4 shrink-0 text-muted-foreground" />
        </Show>
        <span class="ml-1 whitespace-nowrap">
          {isRoot() ? (rootLabel ?? "root") : pathBase(props.path)}
        </span>
      </div>
      {/* opens by height once its folders are there; folded, they stay */}
      <Fold open={isOpen() && children() !== undefined}>
        <div role="group">
          <For each={children()}>
            {(item) => (
              <FolderTreeNode
                path={pathJoin(props.path, item.name)}
                depth={depth() + 1}
              />
            )}
          </For>
        </div>
      </Fold>
    </div>
  )
  return (
    <Show when={showHiddenFolder || !isHiddenFolder()}>
      <Show when={variant !== "nav"} fallback={navNode()}>
        <div>
          <div class="flex flex-row items-center gap-x-2">
            <Show
              when={!loading()}
              fallback={<Spinner size="sm" color={getMainColor()} />}
            >
              <Show
                when={!emptyIconVisible()}
                fallback={
                  <BiSolidFolderOpen style={{ color: getMainColor() }} />
                }
              >
                <BiSolidRightArrow
                  class="cursor-pointer transition-transform duration-200"
                  style={{
                    color: getMainColor(),
                    transform: isOpen() ? "rotate(90deg)" : "none",
                  }}
                  onClick={toggle}
                />
              </Show>
            </Show>
            <p
              class={cn(
                "cursor-pointer rounded-md px-1 text-base whitespace-nowrap",
                active()
                  ? "bg-primary/20"
                  : "hover:bg-[rgba(132,133,141,0.18)]",
              )}
              onClick={() => {
                onChange(props.path)
              }}
            >
              {props.path === "/" ? "root" : pathBase(props.path)}
            </p>
          </div>
          <Show when={isOpen()}>
            <div class="flex flex-col mt-1 pl-4 items-start gap-y-1">
              <For each={children()}>
                {(item) => (
                  <FolderTreeNode path={pathJoin(props.path, item.name)} />
                )}
              </For>
              <Show when={creatingFolderPath() === props.path}>
                <FolderNameInput
                  parentPath={props.path}
                  onCancel={() => setCreatingFolderPath(null)}
                  onSuccess={(fullPath) => {
                    setCreatingFolderPath(null)
                    onChange(fullPath)
                    load(true)
                  }}
                />
              </Show>
            </div>
          </Show>
        </div>
      </Show>
    </Show>
  )
}

const FOCUS_DELAY_MS = 0 // allow DOM to mount before focusing

const FolderNameInput = (props: {
  parentPath: string
  onCancel: () => void
  onSuccess: (fullPath: string) => void
}) => {
  const t = useT()
  const [folderName, setFolderName] = createSignal("")
  const [loading, mkdir] = useFetch(fsMkdir)

  const handleSubmit = async () => {
    const name = folderName().trim()
    if (!name || loading()) return

    const validation = validateFilename(name)
    if (!validation.valid) {
      notify.warning(t(`global.${validation.error}`))
      return
    }

    const fullPath = pathJoin(props.parentPath, name)
    const resp = await mkdir(fullPath)
    handleRespWithNotifySuccess(
      resp,
      () => {
        props.onSuccess(fullPath)
      },
      () => {
        props.onCancel()
      },
    )
  }

  let inputRef: HTMLInputElement | undefined

  onMount(() => {
    setTimeout(() => {
      inputRef?.focus()
      inputRef?.select()
    }, FOCUS_DELAY_MS)
  })

  return (
    <div class="flex flex-row w-full pl-4 items-center gap-x-2">
      <BiSolidFolderOpen style={{ color: getMainColor() }} />
      <Input
        ref={(el) => (inputRef = el)}
        value={folderName()}
        onInput={(e) => setFolderName(e.currentTarget.value)}
        placeholder={t("home.toolbar.input_dir_name")}
        class="h-8 flex-1"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            handleSubmit()
          } else if (e.key === "Escape") {
            props.onCancel()
          }
        }}
        onBlur={(e) => {
          if (loading()) return
          const next = e.relatedTarget as HTMLElement | null
          if (next?.dataset.folderAction === "true") return
          if (!folderName().trim()) {
            props.onCancel()
          }
        }}
      />
      <Show
        when={!loading()}
        fallback={<Spinner size="sm" color={getMainColor()} />}
      >
        <Button
          aria-label={t("global.ok")}
          size="icon-sm"
          variant="ghost"
          class="p-1 text-success"
          onClick={handleSubmit}
          tabIndex={0}
          data-folder-action="true"
        >
          <TbCheck class="size-6" />
        </Button>
      </Show>
      <Button
        aria-label={t("global.cancel")}
        size="icon-sm"
        variant="ghost"
        class="p-1 text-destructive"
        onClick={props.onCancel}
        tabIndex={0}
        data-folder-action="true"
      >
        <TbX class="size-6" />
      </Button>
    </div>
  )
}

export type ModalFolderChooseProps = {
  opened: boolean
  onClose: () => void
  onSubmit?: (text: string) => void
  type?: string
  defaultValue?: string | (() => string)
  loading?: boolean
  footerSlot?: JSXElement
  headerSlot?: (handler: FolderTreeHandler | undefined) => JSXElement
  children?: JSXElement
  header: string
}
export const ModalFolderChoose = (props: ModalFolderChooseProps) => {
  const t = useT()
  const [value, setValue] = createSignal("/")
  const [handler, setHandler] = createSignal<FolderTreeHandler>()
  createEffect(() => {
    if (!props.opened) return
    handler()?.setPath(value())
  })
  if (typeof props.defaultValue === "function") {
    createEffect(() => {
      setValue((props.defaultValue as () => string)())
    })
  } else if (typeof props.defaultValue === "string") {
    setValue(props.defaultValue)
  }
  return (
    <Modal
      size="xl"
      blockScrollOnMount={false}
      opened={props.opened}
      onClose={props.onClose}
    >
      <ModalOverlay />
      <ModalContent>
        {/* <ModalCloseButton /> */}
        <ModalHeader class="w-full break-words">
          <div class="flex flex-row w-full justify-between items-center">
            <div class="break-words">{props.header}</div>
            <Show when={props.headerSlot && handler()}>
              {props.headerSlot!(handler()!)}
            </Show>
          </div>
        </ModalHeader>
        <ModalBody>
          {props.children}
          <FolderTree
            onChange={setValue}
            handle={(h) => setHandler(h)}
            autoOpen
          />
        </ModalBody>
        <ModalFooter class="flex w-full items-end justify-end gap-4">
          <Show when={props.footerSlot}>
            <div class="mr-auto">{props.footerSlot}</div>
          </Show>
          <div class="flex flex-row items-center gap-x-2">
            <Button onClick={props.onClose} variant="secondary">
              {t("global.cancel")}
            </Button>
            <Button
              variant="subtle"
              loading={props.loading}
              onClick={() => props.onSubmit?.(value())}
            >
              {t("global.ok")}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export const FolderChooseInput = (props: {
  value: string
  onChange: (path: string) => void
  id?: string
  onlyFolder?: boolean
}) => {
  const { isOpen, onOpen, onClose } = createDisclosure()
  const t = useT()
  return (
    <>
      <div class="flex flex-row items-center w-full gap-x-2">
        <Input
          id={props.id}
          value={props.value}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          readOnly={props.onlyFolder}
          onClick={props.onlyFolder ? onOpen : () => {}}
          placeholder={t(
            `global.${
              props.onlyFolder ? "choose_folder" : "choose_or_input_path"
            }`,
          )}
        />
        <Show when={!props.onlyFolder}>
          <Button variant="subtle" onClick={onOpen}>
            {t("global.choose")}
          </Button>
        </Show>
      </div>
      <Modal size="xl" opened={isOpen()} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalHeader>{t("global.choose_folder")}</ModalHeader>
          <ModalBody>
            <FolderTree forceRoot onChange={props.onChange} />
          </ModalBody>
          <ModalFooter>
            <Button variant="subtle" onClick={onClose}>
              {t("global.confirm")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
