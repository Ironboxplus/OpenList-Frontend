import { type JSX, Show } from "solid-js"
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

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: JSX.Element
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
}

/** The second click before anything irreversible. */
export const ConfirmDialog = (props: ConfirmDialogProps) => {
  const t = useT()
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <Show
            when={props.description}
            fallback={
              <DialogDescription class="sr-only">
                {props.title}
              </DialogDescription>
            }
          >
            <DialogDescription class="break-all">
              {props.description}
            </DialogDescription>
          </Show>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            type="button"
            onClick={() => props.onOpenChange(false)}
          >
            {t("global.cancel")}
          </Button>
          <Button
            type="button"
            variant={props.destructive ? "destructive" : "default"}
            disabled={props.loading}
            data-testid="confirm-ok"
            onClick={() => props.onConfirm()}
          >
            {props.confirmLabel ?? t("global.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
