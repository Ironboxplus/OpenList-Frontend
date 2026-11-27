// Undo for 5 seconds after a rename or a move (plan §P4, the lead's ruling of
// 11-27): undoing is the opposite request through the same API, and an undo
// the server refuses (the old name is taken by then, say) is said, with the
// server's reason. Deleting has no undo until the backend has a trash.
import { useT } from "~/hooks/useT"
import { notify } from "~/utils/notify"

/** How long the toast offers Undo. */
export const UNDO_MS = 5000

/**
 * A move can be undone by moving back only when it took exactly the files
 * asked for, there and then: not when it replaced files (they are gone), not
 * when it skipped some (moving back would take files that were there before),
 * and not when it was left to a task (it is not done yet).
 */
export const canUndoMove = (m: {
  overwrite: boolean
  skipExisting: boolean
  taskIds: string[]
}) => !m.overwrite && !m.skipExisting && m.taskIds.length === 0

export const offerUndo = (o: {
  message: string
  undo: () => Promise<{ code: number; message: string }>
  /** Lists the folder again once undone. */
  refresh?: () => void
}) => {
  const t = useT()
  notify.success(o.message, {
    duration: UNDO_MS,
    action: {
      label: t("global.undo"),
      onClick: async () => {
        const resp = await o.undo().catch((e: unknown) => ({
          code: -1,
          message: String((e as Error)?.message ?? e),
        }))
        if (resp.code === 200) {
          notify.success(t("files.undone"))
          o.refresh?.()
        } else {
          notify.error(t("files.undo_failed"), { description: resp.message })
          o.refresh?.()
        }
      },
    },
  })
}
