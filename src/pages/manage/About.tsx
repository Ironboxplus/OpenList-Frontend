import { TbExternalLink } from "solid-icons/tb"
import { createSignal, For, Show } from "solid-js"
import { Markdown } from "~/components"
import { Button } from "~/components/ui/button"
import { DataState } from "~/components/ui/data-state"
import { SettingsSection } from "~/features/settings/form/SettingsSection"
import { useManageTitle, useT } from "~/hooks"
import { getSetting } from "~/store"
import { createLoad } from "~/utils/load"

const REPO = "https://github.com/OpenListTeam/OpenList"
const LINKS = [
  { key: "repo", href: REPO },
  { key: "docs", href: "https://doc.oplist.org" },
  { key: "issues", href: `${REPO}/issues` },
]

const fetchReadme = async () =>
  await (
    await fetch(
      "https://raw.githubusercontent.com/OpenListTeam/OpenList/main/README.md",
    )
  ).text()

const Row = (props: { label: string; children: any }) => (
  <div class="flex items-center justify-between gap-3 py-3 text-sm">
    <span class="text-muted-foreground">{props.label}</span>
    <span class="min-w-0 break-all text-right font-medium">
      {props.children}
    </span>
  </div>
)

// Mounted only when asked for: the README comes from GitHub.
const Readme = () => {
  const readme = createLoad(() => undefined, fetchReadme)
  return (
    <div class="py-4">
      <DataState
        loading={readme.loading()}
        error={readme.error() ? String(readme.error()) : undefined}
      >
        <Markdown children={readme.data()} sanitize={true} />
      </DataState>
    </div>
  )
}

const About = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.about")
  const [showReadme, setShowReadme] = createSignal(false)
  return (
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <SettingsSection
        title="OpenList"
        description={t("settings.about.tagline")}
      >
        <Row label={t("settings.about.version")}>
          {getSetting("version") || "-"}
        </Row>
        <Row label={t("settings.about.license")}>AGPL-3.0</Row>
        <div class="flex flex-wrap gap-2 py-3">
          <For each={LINKS}>
            {(l) => (
              <Button
                as="a"
                variant="outline"
                size="sm"
                href={l.href}
                target="_blank"
                rel="noreferrer noopener"
                class="gap-1.5"
              >
                {t(`settings.about.${l.key}`)}
                <TbExternalLink class="size-3.5" />
              </Button>
            )}
          </For>
        </div>
      </SettingsSection>
      <SettingsSection
        title="README"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReadme(!showReadme())}
          >
            {showReadme() ? t("settings.about.hide") : t("settings.about.show")}
          </Button>
        }
      >
        <Show when={showReadme()} fallback={<div class="h-2" />}>
          <Readme />
        </Show>
      </SettingsSection>
    </div>
  )
}

export default About
