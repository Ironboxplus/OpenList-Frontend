import { TbLanguage } from "solid-icons/tb"
import { For } from "solid-js"
import { Lang, languages, setCurrentLang } from "~/app/i18n"
import { useT } from "~/hooks"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

export const SwitchLanguage = () => {
  const t = useT()
  const switchLang = async (lang: Lang) => {
    setCurrentLang(lang)
    localStorage.setItem("lang", lang)
  }

  if (!localStorage.getItem("lang")) {
    switchLang(
      languages.find((l) => l.code === navigator.language)
        ? navigator.language
        : "en",
    )
  }

  return (
    <DropdownMenu placement="top">
      <DropdownMenuTrigger
        as={Button}
        variant="ghost"
        size="icon"
        title={t("common.switch_language")}
        aria-label={t("common.switch_language")}
      >
        <TbLanguage class="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <For each={languages}>
          {(lang) => (
            <DropdownMenuItem onSelect={() => switchLang(lang.code)}>
              {lang.lang}
            </DropdownMenuItem>
          )}
        </For>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const SwitchLanguageWhite = SwitchLanguage
