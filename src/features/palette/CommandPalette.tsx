import { useColorMode } from "@hope-ui/solid"
import { TbFileSearch } from "solid-icons/tb"
import { createMemo, createSignal } from "solid-js"
import { currentLang, languages, setCurrentLang, type Lang } from "~/app/i18n"
import { useRouter, useT } from "~/hooks"
import { me } from "~/store"
import { fileSearchAvailable, openFileSearch } from "../files/search-entry"
import { goingTo } from "../shell/files-memory"
import { activeNavId } from "../shell/nav-items"
import { setTaskCenterOpen } from "../shell/task-center"
import { createViewport } from "../shell/viewport"
import { transfers } from "../transfers/service"
import { CommandPaletteView, type PaletteLabels } from "./CommandPaletteView"
import { buildPaletteItems, type PaletteItem } from "./items"
import { pushRecent, readRecent } from "./recent"
import { paletteOpen, setPaletteOpen } from "./state"

/** The next language in the installed list, wrapping around. */
const nextLang = (): Lang => {
  const codes = languages.map((l) => l.code)
  const at = codes.indexOf(currentLang())
  return codes[(at + 1) % codes.length] as Lang
}

/** Wires the palette view to the real router, stores and effects. */
const CommandPalette = () => {
  const t = useT()
  const { to, pathname } = useRouter()
  const { toggleColorMode } = useColorMode()
  const viewport = createViewport()
  const [recentIds, setRecentIds] = createSignal(readRecent(localStorage))

  const items = createMemo(() =>
    buildPaletteItems({
      user: me(),
      t: (key) => t(key),
      syncAvailable: transfers.syncAvailable(),
      go: (path) => to(goingTo(path, pathname())),
      newSync: () => to("/@transfers?new=sync"),
      openTaskCenter: () => setTaskCenterOpen(true),
      toggleTheme: toggleColorMode,
      toggleLanguage: () => {
        const lang = nextLang()
        setCurrentLang(lang)
        localStorage.setItem("lang", lang)
      },
    }),
  )

  // On the files page, whatever is typed can also be searched for in the folder.
  const extraItems = (query: string): PaletteItem[] =>
    activeNavId(pathname()) === "files" && fileSearchAvailable()
      ? [
          {
            id: "action:search-files",
            group: "action",
            title: t("palette.actions.search_files", { query }),
            keywords: [],
            icon: TbFileSearch,
            run: () => openFileSearch(query),
          },
        ]
      : []

  const labels = createMemo<PaletteLabels>(() => ({
    title: t("palette.title"),
    placeholder: t("palette.placeholder"),
    empty: (query) => t("palette.empty", { query }),
    count: (n) => t("palette.count", { count: n }),
    group: {
      recent: t("palette.groups.recent"),
      nav: t("palette.groups.nav"),
      setting: t("palette.groups.setting"),
      action: t("palette.groups.action"),
    },
    close: t("palette.close"),
  }))

  const run = (item: PaletteItem) => {
    setRecentIds(pushRecent(localStorage, item.id))
    item.run()
  }

  return (
    <CommandPaletteView
      open={paletteOpen()}
      onOpenChange={setPaletteOpen}
      items={items()}
      extraItems={extraItems}
      recentIds={recentIds()}
      onRun={run}
      phone={viewport() === "phone"}
      labels={labels()}
    />
  )
}

export default CommandPalette
