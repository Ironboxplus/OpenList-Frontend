import {
  Box,
  Button,
  createDisclosure,
  HStack,
  Icon,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  VStack,
} from "@hope-ui/solid"
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
  hoverColor,
  pathJoin,
  fsDirs,
  createMatcher,
  fsMkdir,
  validateFilename,
  notify,
} from "~/utils"

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

  return (
    <Box class="folder-tree-box" w="$full" overflowX="auto">
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
      </context.Provider>
    </Box>
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
  // Rows of the nav look: the caret toggles, the rest of the row opens the folder.
  const navNode = () => (
    <div role="treeitem" aria-expanded={isOpen()} aria-selected={active()}>
      <div
        class="flex h-8 cursor-pointer items-center gap-1 rounded-lg pr-2 text-sm transition-colors hover:bg-accent"
        classList={{ "bg-primary/20 font-medium": active() }}
        style={{ "padding-left": `${depth() * 16 + 4}px` }}
        onClick={() => onChange(props.path)}
      >
        <button
          type="button"
          aria-label="toggle"
          class="inline-flex size-5 shrink-0 items-center justify-center rounded bg-transparent text-muted-foreground"
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
            <TbChevronRight
              class="size-3.5 transition-transform"
              classList={{ "rotate-90": isOpen() }}
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
        <span class="ml-1 truncate">
          {isRoot() ? (rootLabel ?? "root") : pathBase(props.path)}
        </span>
      </div>
      <Show when={isOpen()}>
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
      </Show>
    </div>
  )
  return (
    <Show when={showHiddenFolder || !isHiddenFolder()}>
      <Show when={variant !== "nav"} fallback={navNode()}>
        <Box>
          <HStack spacing="$2">
            <Show
              when={!loading()}
              fallback={<Spinner size="sm" color={getMainColor()} />}
            >
              <Show
                when={!emptyIconVisible()}
                fallback={
                  <Icon color={getMainColor()} as={BiSolidFolderOpen} />
                }
              >
                <Icon
                  color={getMainColor()}
                  as={BiSolidRightArrow}
                  transform={isOpen() ? "rotate(90deg)" : "none"}
                  transition="transform 0.2s"
                  cursor="pointer"
                  onClick={toggle}
                />
              </Show>
            </Show>
            <Text
              css={{
                // textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              // overflow="hidden"
              fontSize="$md"
              cursor="pointer"
              px="$1"
              rounded="$md"
              bgColor={active() ? "$info8" : "transparent"}
              _hover={{
                bgColor: active() ? "$info8" : hoverColor(),
              }}
              onClick={() => {
                onChange(props.path)
              }}
            >
              {props.path === "/" ? "root" : pathBase(props.path)}
            </Text>
          </HStack>
          <Show when={isOpen()}>
            <VStack mt="$1" pl="$4" alignItems="start" spacing="$1">
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
            </VStack>
          </Show>
        </Box>
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
    <HStack spacing="$2" w="$full" pl="$4" alignItems="center">
      <Icon color={getMainColor()} as={BiSolidFolderOpen} />
      <Input
        ref={(el) => (inputRef = el)}
        value={folderName()}
        onInput={(e) => setFolderName(e.currentTarget.value)}
        placeholder={t("home.toolbar.input_dir_name")}
        size="sm"
        flex="1"
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
          size="sm"
          variant="ghost"
          rounded="$md"
          p="$1"
          color="$success9"
          onClick={handleSubmit}
          tabIndex={0}
          data-folder-action="true"
        >
          <Icon as={TbCheck} boxSize="$6" />
        </Button>
      </Show>
      <Button
        aria-label={t("global.cancel")}
        size="sm"
        variant="ghost"
        rounded="$md"
        p="$1"
        color="$danger9"
        onClick={props.onCancel}
        tabIndex={0}
        data-folder-action="true"
      >
        <Icon as={TbX} boxSize="$6" />
      </Button>
    </HStack>
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
        <ModalHeader w="$full" css={{ overflowWrap: "break-word" }}>
          <HStack w="$full" justifyContent="space-between" alignItems="center">
            <Box css={{ overflowWrap: "break-word" }}>{props.header}</Box>
            <Show when={props.headerSlot && handler()}>
              {props.headerSlot!(handler()!)}
            </Show>
          </HStack>
        </ModalHeader>
        <ModalBody>
          {props.children}
          <FolderTree
            onChange={setValue}
            handle={(h) => setHandler(h)}
            autoOpen
          />
        </ModalBody>
        <ModalFooter
          display="flex"
          w="$full"
          gap="$4"
          alignItems="flex-end"
          justifyContent="flex-end"
        >
          <Show when={props.footerSlot}>
            <Box mr="auto">{props.footerSlot}</Box>
          </Show>
          <HStack spacing="$2">
            <Button onClick={props.onClose} colorScheme="neutral">
              {t("global.cancel")}
            </Button>
            <Button
              loading={props.loading}
              onClick={() => props.onSubmit?.(value())}
            >
              {t("global.ok")}
            </Button>
          </HStack>
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
      <HStack w="$full" spacing="$2">
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
          <Button onClick={onOpen}>{t("global.choose")}</Button>
        </Show>
      </HStack>
      <Modal size="xl" opened={isOpen()} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalHeader>{t("global.choose_folder")}</ModalHeader>
          <ModalBody>
            <FolderTree forceRoot onChange={props.onChange} />
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>{t("global.confirm")}</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
