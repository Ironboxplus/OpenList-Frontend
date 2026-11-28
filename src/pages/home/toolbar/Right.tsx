import { createMemo, Show } from "solid-js"
import { RightIcon } from "./Icon"
import { CgMoreO } from "solid-icons/cg"
import { TbCheckbox } from "solid-icons/tb"
import { objStore, selectAll, State, toggleCheckbox, userCan } from "~/store"
import { bus } from "~/utils"
import { operations } from "./operations"
import { IoMagnetOutline } from "solid-icons/io"
import { AiOutlineCloudUpload, AiOutlineSetting } from "solid-icons/ai"
import { RiSystemRefreshLine } from "solid-icons/ri"
import { usePath, useRouter } from "~/hooks"
import { MotionDiv, MotionTokens } from "~/platform/motion"
import { isTocVisible, setTocDisabled } from "~/components"
import { BiSolidBookContent } from "solid-icons/bi"
import { createDisclosure } from "~/components/overlay"

export const Right = () => {
  const { isOpen, onToggle } = createDisclosure({
    defaultIsOpen: localStorage.getItem("more-open") === "true",
    onClose: () => localStorage.setItem("more-open", "false"),
    onOpen: () => localStorage.setItem("more-open", "true"),
  })
  // Measured from the content panel, so it never floats outside the card.
  const margin = createMemo(() => (isOpen() ? "1rem" : "1.25rem"))
  const isFolder = createMemo(() => objStore.state === State.Folder)
  const { refresh } = usePath()
  const { isShare } = useRouter()
  return (
    <div
      class="left-toolbar-box fixed z-[1299]"
      style={{
        right: `calc(var(--shell-content-right, 0px) + ${margin()})`,
        bottom: `calc(var(--shell-gap, 0px) + ${margin()})`,
      }}
      // under every dialog (the kit's z-[1500]), above the sticky bars
    >
      <Show
        when={isOpen()}
        fallback={
          <RightIcon
            class="toolbar-toggle"
            icon={CgMoreO}
            onClick={() => {
              onToggle()
            }}
          />
        }
      >
        <MotionDiv
          class="flex flex-col items-center p-1 rounded-lg bg-background gap-y-1 left-toolbar"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          timing={MotionTokens.options.barEnter}
        >
          <div class="flex flex-col items-center gap-y-1 left-toolbar-in">
            <Show
              when={
                isFolder() &&
                !isShare() &&
                (userCan("write_content") || objStore.write_content_bypass) &&
                objStore.write
              }
            >
              <RightIcon
                icon={RiSystemRefreshLine}
                tips="refresh"
                onClick={() => {
                  refresh(undefined, true)
                }}
              />
              <RightIcon
                icon={operations.new_file.icon}
                tips="new_file"
                onClick={() => {
                  bus.emit("tool", "new_file")
                }}
              />
              <RightIcon
                icon={operations.mkdir.icon}
                class="p-1.5"
                tips="mkdir"
                onClick={() => {
                  bus.emit("tool", "mkdir")
                }}
              />
            </Show>
            <Show
              when={
                isFolder() && !isShare() && userCan("move") && objStore.write
              }
            >
              <RightIcon
                icon={operations.recursive_move.icon}
                tips="recursive_move"
                onClick={() => {
                  bus.emit("tool", "recursiveMove")
                }}
              />
            </Show>
            <Show
              when={
                isFolder() && !isShare() && userCan("delete") && objStore.write
              }
            >
              <RightIcon
                icon={operations.remove_empty_directory.icon}
                tips="remove_empty_directory"
                onClick={() => {
                  bus.emit("tool", "removeEmptyDirectory")
                }}
              />
            </Show>
            <Show
              when={
                isFolder() && !isShare() && userCan("rename") && objStore.write
              }
            >
              <RightIcon
                icon={operations.batch_rename.icon}
                tips="batch_rename"
                onClick={() => {
                  selectAll(true)
                  bus.emit("tool", "batchRename")
                }}
              />
            </Show>
            <Show
              when={
                isFolder() &&
                !isShare() &&
                (userCan("write_content") || objStore.write_content_bypass) &&
                objStore.write
              }
            >
              <RightIcon
                icon={AiOutlineCloudUpload}
                tips="upload"
                onClick={() => {
                  bus.emit("tool", "upload")
                }}
              />
            </Show>
            <Show
              when={
                isFolder() &&
                !isShare() &&
                userCan("offline_download") &&
                objStore.write
              }
            >
              <RightIcon
                icon={IoMagnetOutline}
                class="pl-0"
                tips="offline_download"
                onClick={() => {
                  bus.emit("tool", "offline_download")
                }}
              />
            </Show>
            <Show when={isTocVisible()}>
              <RightIcon
                icon={BiSolidBookContent}
                tips="toggle_markdown_toc"
                onClick={() => {
                  setTocDisabled((disabled) => !disabled)
                }}
              />
            </Show>
            <RightIcon
              tips="toggle_checkbox"
              icon={TbCheckbox}
              onClick={toggleCheckbox}
            />
            <RightIcon
              icon={AiOutlineSetting}
              tips="local_settings"
              onClick={() => {
                bus.emit("tool", "local_settings")
              }}
            />
          </div>
          <RightIcon tips="more" icon={CgMoreO} onClick={onToggle} />
        </MotionDiv>
      </Show>
    </div>
  )
}
