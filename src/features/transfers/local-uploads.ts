// The in-browser uploads of this tab as a task source. The upload panel on the
// home page writes here and the transfers store reads from here, so a file
// being uploaded is one record whichever view shows it. Uploads that run in
// the browser cannot outlive the page, so nothing is persisted.
import { createRoot } from "solid-js"
import { createStore, produce } from "solid-js/store"

export type UploadStatus =
  "pending" | "hashing" | "uploading" | "backending" | "success" | "error"

/** What the upload methods report about one file (`SetUpload` writes these keys). */
export interface UploadFileProps {
  name: string
  /** Path of the file inside the picked folder, or its name. */
  path: string
  size: number
  progress: number
  speed: number
  status: UploadStatus
  msg?: string
}

export interface LocalUpload extends UploadFileProps {
  id: string
  /** Full path the file is uploaded to. */
  target: string
  /** ms since epoch */
  createdAt: number
  endedAt?: number
  /** Whether the record can start over (the File handle is still held). */
  retryable: boolean
}

export const isFinishedUpload = (status: UploadStatus): boolean =>
  status === "success" || status === "error"

export const createLocalUploads = (now: () => number = Date.now) =>
  createRoot(() => {
    const [state, setState] = createStore<{ items: LocalUpload[] }>({
      items: [],
    })
    const restarts = new Map<string, () => void>()
    let seq = 0

    const patch = (id: string, fn: (u: LocalUpload) => void) =>
      setState(
        "items",
        produce((items) => {
          const u = items.find((x) => x.id === id)
          if (u) fn(u)
        }),
      )

    return {
      list: (): readonly LocalUpload[] => state.items,

      /**
       * Register a file about to upload and return its id. `restart` runs the
       * upload of that file again; without it the record has no retry.
       */
      add: (
        file: UploadFileProps,
        target: string,
        restart?: (id: string) => void,
      ): string => {
        const id = `${now().toString(36)}-${++seq}`
        if (restart) restarts.set(id, () => restart(id))
        setState("items", (items) => [
          ...items,
          { ...file, id, target, createdAt: now(), retryable: !!restart },
        ])
        return id
      },

      /** Write one reported value; reaching a final status stamps the end time. */
      update: <K extends keyof UploadFileProps>(
        id: string,
        key: K,
        value: UploadFileProps[K],
      ) =>
        patch(id, (u) => {
          ;(u as UploadFileProps)[key] = value
          if (key === "status") {
            u.endedAt = isFinishedUpload(value as UploadStatus)
              ? now()
              : undefined
          }
        }),

      /** Start a failed upload over. False when the record cannot retry. */
      restart: (id: string): boolean => {
        const run = restarts.get(id)
        if (!run) return false
        patch(id, (u) => {
          u.msg = ""
          u.progress = 0
          u.speed = 0
        })
        run()
        return true
      },

      remove: (ids: readonly string[]) => {
        const drop = new Set(ids)
        for (const id of ids) restarts.delete(id)
        setState("items", (items) => items.filter((u) => !drop.has(u.id)))
      },

      /** Drop the records whose upload ended with one of `statuses`. */
      clearFinished: (statuses: readonly UploadStatus[]) => {
        const gone = state.items
          .filter((u) => statuses.includes(u.status))
          .map((u) => u.id)
        for (const id of gone) restarts.delete(id)
        setState("items", (items) => items.filter((u) => !gone.includes(u.id)))
      },
    }
  })

export type LocalUploads = ReturnType<typeof createLocalUploads>

/** The one source of this tab, shared by the home upload panel and the store. */
export const localUploads = createLocalUploads()
