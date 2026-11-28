import { Button } from "~/components/ui/button"
import { useT } from "~/hooks"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverHeader,
  PopoverBody,
} from "~/components/overlay"

export interface DeletePopoverProps {
  name: string
  loading?: boolean
  onClick: () => void
}
export const DeletePopover = (props: DeletePopoverProps) => {
  const t = useT()
  return (
    <Popover>
      {({ onClose }) => (
        <>
          <PopoverTrigger as={Button} variant="destructive">
            {t("global.delete")}
          </PopoverTrigger>
          <PopoverContent>
            <PopoverArrow />
            <PopoverHeader>
              {t("global.delete_confirm", {
                name: props.name,
              })}
            </PopoverHeader>
            <PopoverBody>
              <div class="flex flex-row items-center gap-x-2">
                <Button onClick={onClose} variant="secondary">
                  {t("global.cancel")}
                </Button>
                <Button
                  variant="destructive"
                  loading={props.loading}
                  onClick={props.onClick}
                >
                  {t("global.confirm")}
                </Button>
              </div>
            </PopoverBody>
          </PopoverContent>
        </>
      )}
    </Popover>
  )
}
