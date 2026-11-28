import { MotionDiv, MotionTokens } from "~/platform/motion"
import { Separator } from "~/components/ui/separator"
import { cn } from "~/utils/cn"
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  Show,
  Switch,
  Suspense,
  onCleanup,
  type JSX,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import {
  getMainColor,
  local,
  me,
  OrderBy,
  password,
  objStore,
  ObjStore,
  viewerPath,
} from "~/store"
import {
  Obj,
  ObjTree,
  UserMethods,
  UserPermissions,
  ObjType,
  ArchiveObj,
  Resp,
} from "~/types"
import { useFetch, useRouter, useT, useUtil, useLink } from "~/hooks"
import { ListTitle } from "~/pages/home/folder/List"
import { cols } from "~/pages/home/folder/ListItem"
import { Error, MaybeLoading, FullLoading, SelectWrapper } from "~/components"
import { OpenWith } from "../file/open-with"
import { getPreviews } from "."
import {
  bus,
  formatDate,
  fsArchiveList,
  fsArchiveMeta,
  getFileSize,
  handleRespWithoutNotify,
} from "~/utils"
import naturalSort from "typescript-natural-sort"
import Password from "~/pages/home/Password"
import { useSelectWithMouse } from "~/pages/home/folder/helper"
import { getIconByObj } from "~/utils/icon"
import createMutex from "~/utils/mutex"
import { Item, Menu, useContextMenu } from "solid-contextmenu"
import { TbCopy, TbLink } from "solid-icons/tb"
import { AiOutlineCloudDownload } from "solid-icons/ai"
import { Operations } from "~/pages/home/toolbar/operations"

// One crumb of the archive path: a link back to it, or the current place.
const Crumb = (props: {
  current: boolean
  onClick?: () => void
  children: JSX.Element
}) => (
  <Show
    when={!props.current}
    fallback={
      <span aria-current="page" class="relative inline-flex items-center">
        {props.children}
      </span>
    }
  >
    <a
      class="relative inline-flex cursor-pointer items-center text-muted-foreground no-underline outline-none transition-colors duration-250 hover:text-primary"
      on:click={props.onClick}
    >
      {props.children}
    </a>
  </Show>
)

const CrumbSeparator = () => (
  <span aria-hidden="true" class="inline-flex items-center justify-center">
    /
  </span>
)
import "solid-contextmenu/dist/style.css"
import { colorMode } from "~/store/color-mode"

const download = (url: string) => {
  window.open(url, "_blank")
}

type ListItemProps = {
  obj: Obj
  index: number
  jumpCallback: () => void
  innerPath: string
  url?: string
  pass: string
  onFileClick?: () => void
}

const ListItem = (props: ListItemProps) => {
  const { show } = useContextMenu({ id: 2 })
  const { isMouseSupported } = useSelectWithMouse()
  const filenameStyle = () => local["list_item_filename_overflow"]
  return (
    <MotionDiv
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      timing={MotionTokens.options.barEnter}
      style={{
        width: "100%",
      }}
    >
      <div
        class={`list-item ${cn(
          "viselect-item flex w-full items-center rounded-lg p-2 transition-all duration-300 hover:[transform:scale(1.01)] hover:bg-accent",
          !isMouseSupported() ? "cursor-pointer" : "cursor-default",
        )}`}
        data-index={props.index}
        on:click={(_: MouseEvent) => {
          if (props.obj.is_dir) {
            props.jumpCallback()
          } else if (!props.obj.is_dir && props.onFileClick) {
            props.onFileClick()
          }
        }}
        onContextMenu={(e: MouseEvent) => {
          show(e, { props: props })
        }}
      >
        <div class={cn("name-box flex items-center gap-x-1", cols[0].w)}>
          <Dynamic
            component={getIconByObj(props.obj)}
            class="icon mr-1 size-6 shrink-0"
            style={{ color: getMainColor() }}
          />
          <p
            class={cn(
              "name break-all [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              filenameStyle() === "multi_line"
                ? "whitespace-normal"
                : "whitespace-nowrap",
              filenameStyle() === "scrollable"
                ? "overflow-x-auto"
                : "overflow-x-hidden",
              filenameStyle() === "ellipsis" ? "text-ellipsis" : "text-clip",
            )}
            title={props.obj.name}
          >
            {props.obj.name}
          </p>
        </div>
        <p class={cn("size", cols[1].w, cols[1].align)}>
          {getFileSize(props.obj.size)}
        </p>
        <p class={cn("modified hidden md:inline", cols[2].w, cols[2].align)}>
          {formatDate(props.obj.modified)}
        </p>
      </div>
    </MotionDiv>
  )
}

const operations: Operations = {
  extract: { icon: TbCopy, color: "text-success" },
  copy_link: { icon: TbLink, color: "text-primary" },
  download: { icon: AiOutlineCloudDownload, color: "text-primary" },
}

const ContextMenu = () => {
  const { copy } = useUtil()
  const { isShare } = useRouter()
  return (
    <Menu
      id={2}
      animation="scale"
      theme={colorMode() !== "dark" ? "light" : "dark"}
      style="z-index: 1500"
    >
      <Item
        hidden={({ props }) => {
          return props.obj.is_dir
        }}
        onClick={({ props }) => {
          download(props.url)
        }}
      >
        <ItemContent name="download" />
      </Item>
      <Item
        hidden={({ props }) => {
          return props.obj.is_dir
        }}
        onClick={({ props }) => {
          copy(props.url)
        }}
      >
        <ItemContent name="copy_link" />
      </Item>
      <Item
        hidden={() => {
          const index = UserPermissions.findIndex(
            (item) => item === "decompress",
          )
          return !isShare() && !UserMethods.can(me(), index)
        }}
        onClick={({ props }) => {
          bus.emit(
            "extract",
            JSON.stringify({ inner: props.innerPath, pass: props.pass }),
          )
        }}
      >
        <ItemContent name="extract" />
      </Item>
    </Menu>
  )
}

const ItemContent = (props: { name: string }) => {
  const t = useT()
  return (
    <div class="flex flex-row items-center gap-x-2">
      <Dynamic
        component={operations[props.name].icon}
        class={cn(
          "size-7",
          operations[props.name].p && "p-1",
          operations[props.name].color,
        )}
      />
      <p>{t(`home.toolbar.${props.name}`)}</p>
    </div>
  )
}

type List = {
  [name: string]: Obj & { children: List | null }
}

const Preview = () => {
  const t = useT()
  const { pathname } = useRouter()
  // the archive in the viewer (the page is its folder)
  const filePath = () => viewerPath() ?? pathname()
  const { previewLink } = useLink()
  const [metaLoading, fetchMeta] = useFetch(fsArchiveMeta)
  const [listLoading, fetchList] = useFetch(fsArchiveList)
  const loading = createMemo(() => {
    return metaLoading() || listLoading()
  })
  let archive_pass = ""
  let raw_url = ""
  let sign = ""
  let list: List | null = null
  const [error, setError] = createSignal("")
  const [wrongPassword, setWrongPassword] = createSignal(false)
  const [requiringPassword, setRequiringPassword] = createSignal(false)
  const [comment, setComment] = createSignal("")
  const [innerPaths, setInnerPaths] = createSignal<string[]>([])
  const [orderBy, setOrderBy] = createSignal<OrderBy>()
  const [reverse, setReverse] = createSignal(false)
  const [extractFolder, setExtractFolder] = createSignal<"" | "front" | "back">(
    "",
  )
  const [selectedFile, setSelectedFile] = createSignal<string>("")
  const [selectedPreviewKey, setSelectedPreviewKey] = createSignal("")
  const getObjsMutex = createMutex()
  const toList = (tree: ObjTree[] | Obj[]): List => {
    let l: List = {}
    tree.forEach((item: any) => {
      l[item.name] = {
        ...item,
        children: item.children ? toList(item.children) : null,
      }
    })
    return l
  }
  const handleErrorResponse = (message: string, code: number | undefined) => {
    if (code === 202) {
      batch(() => {
        if (archive_pass !== "") {
          setWrongPassword(true)
        }
        setRequiringPassword(true)
        setError("")
      })
    } else {
      setError(message)
    }
  }
  const dealWithError = <T,>(resp: Resp<T>): boolean => {
    let err = true
    handleRespWithoutNotify(resp, () => (err = false), handleErrorResponse)
    return err
  }
  const getObjs = async (innerPath: string[]) => {
    await getObjsMutex.acquire()
    if (requiringPassword() && archive_pass === "") {
      getObjsMutex.release()
      return []
    }
    if (raw_url === "") {
      const resp = await fetchMeta(filePath(), password(), archive_pass)
      if (dealWithError(resp)) {
        getObjsMutex.release()
        return []
      }
      if (resp.data.content !== null) {
        list = toList(resp.data.content)
      }
      raw_url = resp.data.raw_url
      sign = resp.data.sign
      setComment(resp.data.comment)
      if (resp.data.sort !== undefined) {
        let order: OrderBy | undefined = undefined
        if (resp.data.sort.order_by !== "") {
          order = resp.data.sort.order_by
        }
        let re = resp.data.sort.order_direction === "desc"
        let ef = resp.data.sort.extract_folder
        batch(() => {
          setOrderBy(order)
          setReverse(re)
          setExtractFolder(ef)
        })
      }
      if (resp.data.encrypted && archive_pass === "") {
        batch(() => {
          setRequiringPassword(true)
          setError("")
        })
        getObjsMutex.release()
        return []
      }
    }
    if (list === null) {
      const resp = await fetchList(filePath(), password(), archive_pass, "/")
      if (dealWithError(resp)) {
        getObjsMutex.release()
        return []
      }
      list = toList(resp.data.content)
    }
    let l = list
    for (let i = 0; i < innerPath.length; i++) {
      if (l[innerPath[i]].children === null) {
        const resp = await fetchList(
          filePath(),
          password(),
          archive_pass,
          "/" + innerPath.slice(0, i + 1).join("/"),
        )
        if (dealWithError(resp)) {
          getObjsMutex.release()
          return []
        }
        l[innerPath[i]].children = toList(resp.data.content)
      }
      l = l[innerPath[i]].children!
    }
    batch(() => {
      setRequiringPassword(false)
      setWrongPassword(false)
      setError("")
    })
    getObjsMutex.release()
    return Object.values(l)
  }
  const [objs, setObjs] = createSignal<Obj[]>([])
  createEffect(() => {
    getObjs(innerPaths()).then((ret) => setObjs(ret))
  })
  const refresh = () => {
    getObjs(innerPaths()).then((ret) => setObjs(ret))
  }
  refresh()
  const sortedObjs = () => {
    let ret = objs()
    if (orderBy()) {
      ret = ret.sort((a, b) => {
        return (reverse() ? -1 : 1) * naturalSort(a[orderBy()!], b[orderBy()!])
      })
    }
    let ef = extractFolder()
    if (ef !== "") {
      let dir: Obj[] = []
      let file: Obj[] = []
      ret.forEach((o) => (o.is_dir ? dir : file).push(o))
      ret = ef === "front" ? dir.concat(file) : file.concat(dir)
    }
    return ret
  }
  // Build inner file url for current path by filename
  const buildInnerUrl = (name: string) => {
    const innerPath =
      (innerPaths().length > 0 ? "/" + innerPaths().join("/") : "") + "/" + name
    return innerPath
  }
  // Build obj with inner property
  const buildObjWithInner = (obj: Obj): ArchiveObj => {
    const innerPath =
      innerPaths().length > 0 ? "/" + innerPaths().join("/") : ""

    return {
      ...obj,
      sign: sign,
      inner_path: innerPath,
      archive: originalObj,
      pass: archive_pass,
    }
  }

  const sortObjs = (orderBy: OrderBy, reverse?: boolean) => {
    batch(() => {
      setExtractFolder("")
      setOrderBy(orderBy)
      if (reverse !== undefined) {
        setReverse(reverse)
      }
    })
  }

  // Get all files for navigation
  const files = createMemo(() =>
    sortedObjs()
      .filter((obj) => !obj.is_dir)
      .map((f) => buildObjWithInner(f)),
  )

  const previews = createMemo(() => {
    const file = files().find((f) => f.name === selectedFile())
    if (!file) return []

    return getPreviews({ ...file, provider: objStore.provider })
  })

  const currentPreview = createMemo(() => {
    const p = previews()
    if (p.length === 0) return null
    if (selectedPreviewKey()) {
      const found = p.find((item) => item.key === selectedPreviewKey())
      if (found) return found
    }
    return p[0]
  })

  // Cast to ArchiveObj to make sure onCleanup can delete archive property correctly
  const originalObj: ArchiveObj = {
    ...objStore.obj,
    inner_path: undefined,
    archive: undefined,
  }
  const originalRawUrl = objStore.raw_url

  const changeFile = (name: string) => {
    batch(() => {
      if (name === "") {
        // Restore
        ObjStore.setObj(originalObj)
        ObjStore.setRawUrl(originalRawUrl)
        setSelectedFile("")
      } else {
        // Set new
        const file = files().find((f) => f.name === name)
        if (file) {
          const innerUrl = previewLink(file)
          ObjStore.setObj(file)
          ObjStore.setRawUrl(innerUrl)
          setSelectedFile(name)
        }
      }
    })
  }

  onCleanup(() => {
    // Restore original values
    ObjStore.setObj(originalObj)
    ObjStore.setRawUrl(originalRawUrl)
  })

  createEffect(() => {
    selectedFile()
    setSelectedPreviewKey("")
  })
  return (
    <div class="flex flex-col items-center w-full gap-y-2">
      <nav
        aria-label="breadcrumb"
        class="block w-full px-2 text-base leading-6"
      >
        <ol class="m-0 flex list-none items-center gap-x-2 p-0">
          <li class="inline-flex items-center gap-x-2">
            <Crumb
              current={innerPaths().length === 0 && !selectedFile()}
              onClick={() => {
                setInnerPaths([])
                changeFile("")
              }}
            >
              .
            </Crumb>
          </li>
          <For each={innerPaths()}>
            {(name, i) => (
              <li class="inline-flex items-center gap-x-2">
                <CrumbSeparator />
                <Crumb
                  current={innerPaths().length === i() + 1 && !selectedFile()}
                  onClick={() => {
                    setInnerPaths(innerPaths().slice(0, i() + 1))
                    changeFile("")
                  }}
                >
                  {name}
                </Crumb>
              </li>
            )}
          </For>
          <Show when={selectedFile()}>
            <li class="inline-flex items-center gap-x-2">
              <CrumbSeparator />
              <Crumb current={true}>{selectedFile()}</Crumb>
            </li>
          </Show>
        </ol>
      </nav>
      <Switch>
        <Match when={error() !== ""}>
          <Error msg={error()} disableColor />
        </Match>
        <Match when={requiringPassword()}>
          <Password
            title={t("home.toolbar.archive.input_password")}
            password={() => archive_pass}
            setPassword={(s) => (archive_pass = s)}
            enterCallback={() => refresh()}
          >
            <Show when={wrongPassword()}>
              <p class="text-destructive">
                {t("home.toolbar.archive.incorrect_password")}
              </p>
            </Show>
          </Password>
        </Match>
        <Match when={!requiringPassword() && error() === ""}>
          <Show
            when={selectedFile()}
            fallback={
              <MaybeLoading loading={loading()}>
                <div class="flex flex-col items-center w-full gap-y-1 list">
                  <ListTitle sortCallback={sortObjs} disableCheckbox />
                  <For each={sortedObjs()}>
                    {(obj, i) => {
                      const objWithInner = buildObjWithInner(obj)
                      // Use rawLink to construct the URL for the object
                      let url = !obj.is_dir
                        ? previewLink(objWithInner)
                        : undefined
                      let innerPath = buildInnerUrl(obj.name)
                      return (
                        <ListItem
                          obj={obj}
                          index={i()}
                          jumpCallback={() =>
                            setInnerPaths(innerPaths().concat(obj.name))
                          }
                          innerPath={innerPath}
                          url={url}
                          pass={archive_pass}
                          onFileClick={() => changeFile(obj.name)}
                        />
                      )
                    }}
                  </For>
                  <ContextMenu />
                </div>
              </MaybeLoading>
            }
          >
            <div class="flex flex-col w-full items-center gap-y-2">
              <Show when={currentPreview()}>
                <Suspense fallback={<FullLoading />}>
                  <Dynamic
                    component={currentPreview()?.component as any}
                    images={files().filter((f) => f.type === ObjType.IMAGE)}
                    navigate={(name: string) => {
                      changeFile(name)
                    }}
                  />
                </Suspense>
              </Show>
              <div class="flex flex-row items-center w-full justify-center p-2 gap-x-2">
                <Show when={previews().length > 1}>
                  <SelectWrapper
                    value={currentPreview()?.key || ""}
                    onChange={(value) => setSelectedPreviewKey(String(value))}
                    options={previews().map((p) => ({
                      value: p.key,
                      label: p.name,
                    }))}
                  />
                </Show>
                <OpenWith />
              </div>
            </div>
          </Show>
        </Match>
      </Switch>
      <Show when={comment() !== ""}>
        <Separator />
        <p class="w-full pl-1 pr-1">{comment()}</p>
      </Show>
    </div>
  )
}

export default Preview
