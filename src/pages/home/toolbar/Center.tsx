import { Box, HStack, Text, useColorModeValue } from "@hope-ui/solid"
import { createMemo, For, Show } from "solid-js"
import {
  checkboxOpen,
  haveSelected,
  objStore,
  selectAll,
  selectedMsg,
  selectedObjs,
  State,
  userCan,
} from "~/store"
import { CopyLink } from "./CopyLink"
import { CenterIcon } from "./Icon"
import { bus, isTouchDevice } from "~/utils"
import { Download } from "./Download"
import { Motion, Presence } from "solid-motionone"
import { useRouter } from "~/hooks"

export const Center = () => {
  const show = createMemo(
    () =>
      [State.Folder, State.FetchingMore].includes(objStore.state) &&
      checkboxOpen() &&
      haveSelected(),
  )
  const { isShare } = useRouter()
  const selectedCount = createMemo(() => selectedObjs().length)
  const isTouch = isTouchDevice()
  return (
    <Presence exitBeforeEnter>
      <Show when={show()}>
        <Box
          class="center-toolbar"
          pos="fixed"
          bottom="$4"
          left="50%"
          w="max-content"
          // On touch, cap width to viewport minus gutters so labels can wrap
          maxW={isTouch ? "calc(100vw - 2rem)" : undefined}
          color="$neutral11"
          transform="translateX(-50%)"
        >
          <Box
            as={Motion.div}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            // @ts-ignore
            transition={{ duration: 0.2 }}
          >
            <Box
              p="$2"
              bgColor={useColorModeValue("white", "#000000d0")()}
              shadow="0px 10px 30px -5px rgba(0, 0, 0, 0.3)"
              rounded="$lg"
              css={{
                backdropFilter: "blur(8px)",
              }}
            >
              {/* Selection count indicator */}
              <HStack spacing="$2" mb="$1_5" px="$1">
                <Box
                  display="inline-flex"
                  alignItems="center"
                  justifyContent="center"
                  minW="$5"
                  h="$5"
                  px="$1"
                  rounded="$full"
                  bgColor="$primary9"
                  css={{ color: "white" }}
                >
                  <Text fontSize="$xs" fontWeight="$semibold" lineHeight="1">
                    {selectedCount()}
                  </Text>
                </Box>
                <Text fontSize="$sm" color="$neutral10">
                  {selectedMsg()}
                </Text>
              </HStack>
              {/* Action buttons — wrappable on touch so labels don't overflow */}
              <HStack
                spacing="$1"
                flexWrap={isTouch ? "wrap" : "nowrap"}
                justifyContent={isTouch ? "center" : "flex-start"}
              >
                <Show when={!isShare() && objStore.write}>
                  <For
                    each={
                      [
                        "rename",
                        "move",
                        "copy",
                        "delete",
                        "decompress",
                      ] as const
                    }
                  >
                    {(name) => {
                      return userCan(name) ? (
                        <CenterIcon
                          name={name}
                          onClick={() => {
                            bus.emit("tool", name)
                          }}
                        />
                      ) : null
                    }}
                  </For>
                </Show>
                <Show when={userCan("share") && !isShare()}>
                  <CenterIcon
                    name="share"
                    onClick={() => {
                      bus.emit("tool", "share")
                    }}
                  />
                </Show>
                <CopyLink />
                <Download />
                <CenterIcon
                  name="cancel_select"
                  onClick={() => {
                    selectAll(false)
                  }}
                />
              </HStack>
            </Box>
          </Box>
        </Box>
      </Show>
    </Presence>
  )
}
