import { VStack } from "@hope-ui/solid"
import { Show } from "solid-js"
import { AnnouncementCard } from "~/features/files/AnnouncementCard"
import { DirTasksCard } from "~/features/files/DirTasksCard"
import { FilesFrame } from "~/features/files/FilesFrame"
import { shellActive } from "~/features/shell/topbar-slot"
import { Container } from "./Container"
import { Nav } from "./Nav"
import { Obj } from "./Obj"
import { Readme } from "./Readme"
import { Sidebar } from "./Sidebar"

export const Body = () => (
  <Show
    when={shellActive()}
    fallback={
      <Container>
        <VStack
          class="body"
          mt="$1"
          py="$2"
          px="2%"
          minH="80vh"
          w="$full"
          gap="$4"
        >
          <Readme
            files={["header.md", "top.md", "index.md"]}
            fromMeta="header"
          />
          <Nav />
          <Obj />
          <Readme
            files={["readme.md", "footer.md", "bottom.md"]}
            fromMeta="readme"
          />
          <Sidebar />
        </VStack>
      </Container>
    }
  >
    {/* In the shell the breadcrumb is in the TopBar, and README, list and
        footer share one container so nothing is off-centre. */}
    <FilesFrame>
      <VStack class="body" py="$3" minH="70vh" w="$full" gap="$4">
        <AnnouncementCard />
        <Readme files={["header.md", "top.md", "index.md"]} fromMeta="header" />
        <DirTasksCard />
        <Obj />
        <Readme
          files={["readme.md", "footer.md", "bottom.md"]}
          fromMeta="readme"
        />
        <Sidebar />
      </VStack>
    </FilesFrame>
  </Show>
)
