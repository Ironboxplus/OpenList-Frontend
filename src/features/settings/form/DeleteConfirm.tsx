import { createSignal, type JSX } from "solid-js"
import { useT } from "~/hooks"
import { ConfirmDialog } from "./ConfirmDialog"

export interface DeleteConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What is about to go; shown in the question. */
  name: string
  loading?: boolean
  onConfirm: () => void
}

/** "Delete [name]?" with the wording the old popover used. */
export const DeleteConfirm = (props: DeleteConfirmProps) => {
  const t = useT()
  return (
    <ConfirmDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t("global.delete")}
      description={t("global.delete_confirm", { name: props.name })}
      destructive
      loading={props.loading}
      onConfirm={props.onConfirm}
    />
  )
}

/**
 * Wire a list's delete actions to one dialog: `ask(row)` from a row action,
 * `dialog` rendered once by the page. `run` does the request; the dialog
 * closes when it settles.
 */
export const createDeleteConfirm = <T,>(opts: {
  name: (row: T) => string
  run: (row: T) => Promise<void>
}): { ask: (row: T) => void; dialog: () => JSX.Element } => {
  const [target, setTarget] = createSignal<{ row: T }>()
  const [busy, setBusy] = createSignal(false)
  return {
    ask: (row) => setTarget({ row }),
    dialog: () => (
      <DeleteConfirm
        open={target() !== undefined}
        onOpenChange={(open) => !open && !busy() && setTarget(undefined)}
        name={target() ? opts.name(target()!.row) : ""}
        loading={busy()}
        onConfirm={async () => {
          const hit = target()
          if (!hit) return
          setBusy(true)
          try {
            await opts.run(hit.row)
          } finally {
            setBusy(false)
            setTarget(undefined)
          }
        }}
      />
    ),
  }
}
