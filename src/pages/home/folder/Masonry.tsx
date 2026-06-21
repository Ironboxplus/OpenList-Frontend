import { Box, Center, Skeleton, Text, VStack } from "@hope-ui/solid"
import { Motion } from "solid-motionone"
import { useContextMenu } from "solid-contextmenu"
import {
  For,
  Match,
  Show,
  Switch,
  batch,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js"
import { CenterLoading, ImageWithError, LinkWithPush } from "~/components"
import { useLink, useRouter, useT, useUtil } from "~/hooks"
import {
  getMainColor,
  local,
  objStore,
  selectIndex,
  smartCountMsg,
} from "~/store"
import { ObjType, StoreObj } from "~/types"
import { bus, listItemIn } from "~/utils"
import { getIconByObj } from "~/utils/icon"
import { BsPlayCircleFill } from "solid-icons/bs"
import {
  clampPreview,
  masonryCardKind,
  masonryClickAction,
  masonryNameAlwaysVisible,
} from "./masonry-card"

// Lazily fetch a text file's head once the card is visible, so a folder full
// of text files doesn't fire a request storm on mount.
const TextPreview = (props: { obj: StoreObj }) => {
  const { proxyLink } = useLink()
  const [content, setContent] = createSignal<string>()
  const [failed, setFailed] = createSignal(false)
  let el: HTMLDivElement | undefined
  let io: IntersectionObserver | undefined
  const load = async () => {
    try {
      const resp = await fetch(proxyLink(props.obj, true), {
        headers: { Range: "bytes=0-8191" },
      })
      const text = await resp.text()
      setContent(clampPreview(text))
    } catch {
      setFailed(true)
    }
  }
  onMount(() => {
    if (!el) return
    io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io?.disconnect()
          load()
        }
      },
      { rootMargin: "200px" },
    )
    io.observe(el)
  })
  onCleanup(() => io?.disconnect())
  return (
    <Box ref={el} w="$full" h="220px" pos="relative" bgColor="$neutral2">
      <Show
        when={content() !== undefined}
        fallback={
          <VStack w="$full" h="$full" p="$3" spacing="$2" alignItems="stretch">
            <Show when={!failed()} fallback={<CenterLoading size="lg" />}>
              <Skeleton height="12px" />
              <Skeleton height="12px" />
              <Skeleton height="12px" width="80%" />
              <Skeleton height="12px" />
              <Skeleton height="12px" width="60%" />
            </Show>
          </VStack>
        }
      >
        <Box
          as="pre"
          w="$full"
          h="$full"
          m={0}
          p="$3"
          color="$neutral11"
          css={{
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: "11px",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflow: "hidden",
          }}
        >
          {content()}
        </Box>
      </Show>
      {/* fade the bottom so truncation looks intentional */}
      <Box
        pos="absolute"
        bottom="0"
        left="0"
        right="0"
        h="48px"
        css={{
          background:
            "linear-gradient(to top, var(--hope-colors-neutral2), transparent)",
        }}
      />
    </Box>
  )
}

const MasonryItem = (props: { obj: StoreObj; index: number }) => {
  const { isHide } = useUtil()
  if (isHide(props.obj)) {
    return null
  }
  const obj = props.obj
  const kind = masonryCardKind(obj)
  const isImage = kind === "image"
  const { rawLink } = useLink()
  const { pushHref, to } = useRouter()
  const { show } = useContextMenu({ id: 1 })
  const typeIcon = (size: string) => (
    <Box as={getIconByObj(obj) as any} color={getMainColor()} fontSize={size} />
  )
  return (
    <Motion.div
      {...(listItemIn(props.index) as any)}
      style={{ "break-inside": "avoid", "margin-bottom": "0.6rem" }}
    >
      <Box
        as={LinkWithPush}
        href={obj.name}
        pos="relative"
        display="block"
        w="$full"
        rounded="$lg"
        overflow="hidden"
        bgColor="$neutral3"
        shadow="$sm"
        cursor="pointer"
        transition="transform 0.25s ease, box-shadow 0.25s ease"
        css={{
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: `0 10px 26px -8px ${getMainColor()}66`,
          },
          "&:hover .masonry-overlay": { opacity: 1 },
          "&:hover img": { filter: "brightness(1.05)" },
        }}
        onContextMenu={(e: MouseEvent) => {
          batch(() => selectIndex(props.index, true, true))
          show(e, { props: obj })
        }}
        on:click={(e: MouseEvent) => {
          e.preventDefault()
          if (e.ctrlKey || e.metaKey || e.shiftKey) return
          // images open in the shared gallery (keyboard arrows + swipe + zoom);
          // everything else navigates to its own preview / folder page.
          if (masonryClickAction(obj) === "gallery") {
            bus.emit("gallery", obj.name)
          } else {
            to(pushHref(obj.name))
          }
        }}
      >
        <Switch>
          {/* image: the image itself */}
          <Match when={isImage}>
            <ImageWithError
              w="$full"
              display="block"
              objectFit="cover"
              fallback={<CenterLoading size="lg" h="160px" w="$full" />}
              fallbackErr={<Center h="160px">{typeIcon("48px")}</Center>}
              src={obj.thumb || rawLink(obj)}
              loading="lazy"
              css={{ transition: "filter 0.25s ease" }}
            />
          </Match>

          {/* video with a thumbnail */}
          <Match when={kind === "video-thumb"}>
            <Box pos="relative" w="$full">
              <ImageWithError
                w="$full"
                display="block"
                objectFit="cover"
                fallback={<CenterLoading size="lg" h="160px" w="$full" />}
                fallbackErr={<Center h="160px">{typeIcon("48px")}</Center>}
                src={obj.thumb}
                loading="lazy"
                css={{ transition: "filter 0.25s ease" }}
              />
              <Center pos="absolute" top="0" left="0" right="0" bottom="0">
                <Box
                  as={BsPlayCircleFill as any}
                  color="white"
                  fontSize="44px"
                  css={{
                    filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
                    opacity: 0.92,
                  }}
                />
              </Center>
            </Box>
          </Match>

          {/* video without a thumbnail: a video skeleton placeholder */}
          <Match when={kind === "video-skeleton"}>
            <Box pos="relative" w="$full" css={{ aspectRatio: "16 / 9" }}>
              <Skeleton w="$full" h="$full" />
              <Center pos="absolute" top="0" left="0" right="0" bottom="0">
                <Box
                  as={BsPlayCircleFill as any}
                  color={getMainColor()}
                  fontSize="44px"
                  css={{ opacity: 0.8 }}
                />
              </Center>
            </Box>
          </Match>

          {/* text: its actual content */}
          <Match when={kind === "text"}>
            <TextPreview obj={obj} />
          </Match>

          {/* folders & everything else: a clean icon card */}
          <Match when={true}>
            <Center
              w="$full"
              h="140px"
              css={{
                background:
                  "linear-gradient(135deg, var(--hope-colors-neutral2), var(--hope-colors-neutral4))",
              }}
            >
              {typeIcon("52px")}
            </Center>
          </Match>
        </Switch>

        {/* filename bar — always readable, brightens on hover */}
        <Box
          class="masonry-overlay"
          pos="absolute"
          bottom="0"
          left="0"
          right="0"
          px="$2"
          py="$1"
          opacity={masonryNameAlwaysVisible(obj) ? 0.96 : 0}
          transition="opacity 0.25s ease"
          css={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0))",
          }}
        >
          <Text size="xs" color="white" noOfLines={1} title={obj.name}>
            {obj.name}
          </Text>
        </Box>
      </Box>
    </Motion.div>
  )
}

const MasonryLayout = (props: { images: StoreObj[] }) => {
  const t = useT()
  return (
    <VStack spacing="$2" w="$full">
      <Show when={local["show_count_msg"] === "visible"}>
        <Box w="100%" textAlign="left" pl="$2">
          <Text size="sm" color="$neutral11">
            {smartCountMsg()}
          </Text>
        </Box>
      </Show>
      <Show
        when={objStore.objs.length > 0}
        fallback={
          <Center w="$full" p="$8" color="$neutral10">
            {t("home.empty_folder")}
          </Center>
        }
      >
        {/* Responsive CSS-column waterfall. Mobile-first: 2 → 6 columns. */}
        <Box
          w="$full"
          class="masonry-images"
          css={{
            columnGap: "0.6rem",
            columnCount: 2,
            "@media (min-width: 480px)": { columnCount: 3 },
            "@media (min-width: 768px)": { columnCount: 4 },
            "@media (min-width: 1200px)": { columnCount: 5 },
            "@media (min-width: 1600px)": { columnCount: 6 },
          }}
        >
          <For each={objStore.objs}>
            {(obj, i) => <MasonryItem obj={obj} index={i()} />}
          </For>
        </Box>
      </Show>
    </VStack>
  )
}

export default MasonryLayout
