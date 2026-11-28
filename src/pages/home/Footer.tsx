import { Show } from "solid-js"
import { FilesFrame } from "~/features/files/FilesFrame"
import { shellActive } from "~/features/shell/topbar-slot"
import { useT } from "~/hooks"

export const Footer = () => {
  const t = useT()
  const link = (
    <div class="flex flex-row items-center gap-x-1">
      <a
        class="relative cursor-pointer rounded-lg px-1.5 py-1 no-underline hover:bg-[rgba(132,133,141,0.18)]"
        href="https://github.com/OpenListTeam/OpenList"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("home.footer.powered_by")}
      </a>
    </div>
  )
  return (
    <Show
      when={shellActive()}
      fallback={
        <div class="flex flex-col items-center w-full py-4 footer">{link}</div>
      }
    >
      <FilesFrame>
        <div class="flex flex-col items-center w-full py-4 mb-2 footer">
          {link}
        </div>
      </FilesFrame>
    </Show>
  )
}
