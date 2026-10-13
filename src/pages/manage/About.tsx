import { createLoad } from "~/utils/load"
import { Markdown } from "~/components"
import { DataState } from "~/components/ui/data-state"
import { useManageTitle } from "~/hooks"

const fetchReadme = async () =>
  await (
    await fetch(
      "https://raw.githubusercontent.com/OpenListTeam/OpenList/main/README.md",
    )
  ).text()

const About = () => {
  useManageTitle("manage.sidemenu.about")
  const readme = createLoad(() => undefined, fetchReadme)
  return (
    <DataState
      loading={readme.loading()}
      error={readme.error() ? String(readme.error()) : undefined}
    >
      <Markdown children={readme.data()} sanitize={true} />
    </DataState>
  )
}

export default About
