import { Anchor, HStack, VStack } from "@hope-ui/solid"
import { useT } from "~/hooks"

export const Footer = () => {
  const t = useT()
  return (
    <VStack class="footer" w="$full" py="$4">
      <HStack spacing="$1">
        <Anchor href="https://github.com/OpenListTeam/OpenList" external>
          {t("home.footer.powered_by")}
        </Anchor>
      </HStack>
    </VStack>
  )
}
