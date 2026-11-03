import { TbChevronDown } from "solid-icons/tb"
import { For, Show } from "solid-js"
import { useLink, useT } from "~/hooks"
import { getExternalPreviews, objStore } from "~/store"
import { convertURL } from "~/utils"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

export const OpenWith = () => {
  const t = useT()
  const previews = getExternalPreviews(objStore.obj.name)
  const { currentObjLink } = useLink()
  return (
    <Show when={previews.length}>
      <DropdownMenu placement="bottom-start">
        <DropdownMenuTrigger as={Button} variant="outline" class="gap-1.5">
          {t("home.preview.open_with")}
          <TbChevronDown class="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <For each={previews}>
            {(preview) => (
              <DropdownMenuItem
                as="a"
                target="_blank"
                href={convertURL(preview.value, {
                  raw_url: objStore.raw_url,
                  name: objStore.obj.name,
                  d_url: currentObjLink(true),
                })}
              >
                {preview.key}
              </DropdownMenuItem>
            )}
          </For>
        </DropdownMenuContent>
      </DropdownMenu>
    </Show>
  )
}
