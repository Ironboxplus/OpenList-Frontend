import { createResource } from "solid-js"
import { Markdown } from "~/components"
import { DataState } from "~/features/settings/form"
import { useManageTitle } from "~/hooks"

const fetchReadme = async () =>
  await (
    await fetch(
      "https://raw.githubusercontent.com/OpenListTeam/OpenList/main/README.md",
    )
  ).text()

const About = () => {
  useManageTitle("manage.sidemenu.about")
  const [readme] = createResource(fetchReadme)
  return (
    <DataState
      loading={readme.loading}
      error={readme.error ? String(readme.error) : undefined}
    >
      <Markdown children={readme()} sanitize={true} />
    </DataState>
  )
}

export default About
