import { createEffect, createSignal, Show } from "solid-js"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Textarea } from "~/components/ui/input"
import { useT, useUtil } from "~/hooks"

export interface JsonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  tips: string
  /** Export: the text to show (read-only, copyable). Import: starts empty. */
  value?: string
  onSubmit?: (text: string) => void
}

/** Shows JSON to copy (export) or takes pasted JSON (import). */
export const JsonDialog = (props: JsonDialogProps) => {
  const t = useT()
  const { copy } = useUtil()
  const [text, setText] = createSignal("")
  // A fresh open starts from the given value (or empty for an import).
  createEffect(() => {
    if (props.open) setText(props.value ?? "")
  })
  const exporting = () => props.onSubmit === undefined
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.tips}</DialogDescription>
        </DialogHeader>
        <Textarea
          id="json-dialog-input"
          rows={10}
          spellcheck={false}
          class="font-mono text-xs"
          readOnly={exporting()}
          value={text()}
          onInput={(e) => setText(e.currentTarget.value)}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => props.onOpenChange(false)}
          >
            {exporting() ? t("global.close") : t("global.cancel")}
          </Button>
          <Show
            when={props.onSubmit}
            fallback={
              <Button type="button" onClick={() => copy(text())}>
                {t("common.copy")}
              </Button>
            }
          >
            <Button type="button" onClick={() => props.onSubmit!(text())}>
              {t("global.ok")}
            </Button>
          </Show>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
