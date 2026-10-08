import { Anchor, HStack, VStack } from "@hope-ui/solid"
import { Show } from "solid-js"
import { FilesFrame } from "~/features/files/FilesFrame"
import { shellActive } from "~/features/shell/topbar-slot"
import { useT } from "~/hooks"

export const Footer = () => {
  const t = useT()
  const link = (
    <HStack spacing="$1">
      <Anchor href="https://github.com/OpenListTeam/OpenList" external>
        {t("home.footer.powered_by")}
      </Anchor>
    </HStack>
  )
  return (
    <Show
      when={shellActive()}
      fallback={
        <VStack class="footer" w="$full" py="$4">
          {link}
        </VStack>
      }
    >
      <FilesFrame>
        <VStack class="footer" w="$full" py="$4" mb="$2">
          {link}
        </VStack>
      </FilesFrame>
    </Show>
  )
}
