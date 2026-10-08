import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { useT } from "~/hooks"

/** Second confirmation before a task record is deleted. */
export const ConfirmDeleteDialog = (props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) => {
  const t = useT()
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("transfers.confirm.delete_title")}</DialogTitle>
          <DialogDescription>
            {t("transfers.confirm.delete_desc")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => props.onOpenChange(false)}>
            {t("transfers.confirm.cancel")}
          </Button>
          <Button
            variant="destructive"
            data-testid="confirm-delete"
            onClick={() => {
              props.onOpenChange(false)
              props.onConfirm()
            }}
          >
            {t("transfers.confirm.ok")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
