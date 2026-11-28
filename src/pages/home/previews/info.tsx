import { JSXElement, Show, createSignal } from "solid-js"
import { Dynamic } from "solid-js/web"
import { useT } from "~/hooks"
import { getMainColor, objStore } from "~/store"
import { formatDate, getFileSize } from "~/utils"
import { getIconByObj } from "~/utils/icon"

export const FileInfo = (props: { children: JSXElement }) => {
  const t = useT()
  // the type's icon stands in until the thumbnail is there (and if it cannot be)
  const [thumbReady, setThumbReady] = createSignal(false)
  return (
    <div class="flex flex-col items-center py-6 w-full gap-y-6 fileinfo">
      <Show when={objStore.obj.thumb}>
        <img
          class="size-20"
          classList={{ hidden: !thumbReady() }}
          src={objStore.obj.thumb}
          onLoad={() => setThumbReady(true)}
          onError={() => setThumbReady(false)}
        />
      </Show>
      <Show when={!objStore.obj.thumb || !thumbReady()}>
        <Dynamic
          component={getIconByObj(objStore.obj)}
          class="size-20"
          style={{ color: getMainColor() }}
        />
      </Show>
      <div class="flex flex-col items-center gap-y-2">
        <h2 class="text-lg font-semibold break-all">{objStore.obj.name}</h2>
        <p class="text-muted-foreground text-sm leading-5">
          {[
            getFileSize(objStore.obj.size),
            formatDate(objStore.obj.modified),
            t(`drivers.drivers.${objStore.provider}`),
          ].join("  ·  ")}
        </p>
      </div>
      <div class="flex flex-col items-center gap-y-2">{props.children}</div>
    </div>
  )
}
