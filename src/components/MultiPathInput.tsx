import { VStack, Button } from "@hope-ui/solid"
import { createSignal } from "solid-js"
import { TbPlus, TbFolder } from "solid-icons/tb"
import { Button as KitButton } from "~/components/ui/button"
import { Textarea } from "~/components/ui/input"
import { useT } from "~/hooks"
import { pathJoin } from "~/utils"
import { EnhancedFolderTree } from "~/components/EnhancedFolderTree"
import {
  createDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "~/components/overlay"

export interface MultiPathInputProps {
  value: string
  onChange: (value: string) => void
  valid?: boolean
  readOnly?: boolean
  id?: string
  placeholder?: string
  basePath?: string
}

export const MultiPathInput = (props: MultiPathInputProps) => {
  const t = useT()
  const { isOpen, onOpen, onClose } = createDisclosure()
  const [selectedPath, setSelectedPath] = createSignal("/")

  const addPath = () => {
    const currentPaths = props.value ? props.value.split("\n") : []
    let sp = selectedPath()
    if (props.basePath) {
      sp = pathJoin(props.basePath, sp)
    }
    const newPaths = [...currentPaths, sp].filter(Boolean)
    const uniquePaths = [...new Set(newPaths)]
    props.onChange(uniquePaths.join("\n"))
    onClose()
  }

  return (
    <VStack w="$full" spacing="$2" alignItems="stretch">
      {/* the kit's field and button, framed as the rest of the forms it is
          in (it was hope's filled textarea among outlined fields) */}
      <div class="flex w-full items-start gap-2">
        <Textarea
          id={props.id}
          class="flex-1 resize-y"
          value={props.value}
          aria-invalid={props.valid === false ? true : undefined}
          readOnly={props.readOnly}
          placeholder={props.placeholder || t("shares.files_placeholder")}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
        <KitButton
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("global.choose_or_input_path")}
          title={t("global.choose_or_input_path")}
          onClick={onOpen}
          disabled={props.readOnly}
        >
          <TbFolder class="size-4" />
        </KitButton>
      </div>

      <Modal size="xl" opened={isOpen()} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalHeader>{t("global.choose_or_input_path")}</ModalHeader>
          <ModalBody>
            <EnhancedFolderTree
              forceRoot
              onChange={setSelectedPath}
              showHiddenFolder={true}
            />
          </ModalBody>
          <ModalFooter display="flex" gap="$2">
            <Button onClick={onClose} colorScheme="neutral">
              {t("global.cancel")}
            </Button>
            <Button
              onClick={addPath}
              colorScheme="primary"
              leftIcon={<TbPlus />}
            >
              {t("shares.add_path")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  )
}
