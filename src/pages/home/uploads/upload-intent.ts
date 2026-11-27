import { bus } from "~/utils/bus"

let intent: "file" | "folder" | File[] | undefined
/** The open panel's way to take files (set while it is mounted). */
let deliver: ((files: File[]) => void) | undefined

/**
 * Open the upload panel for one kind of source: the panel opens that picker as
 * it mounts, so "Upload folder" in the New menu lands on the folder dialog.
 */
export const requestUpload = (kind: "file" | "folder") => {
  intent = kind
  bus.emit("tool", "upload")
}

/**
 * Upload these files to the current folder (dropped on the file list): the
 * panel opens with them, or takes them if it is open already.
 */
export const requestUploadOf = (files: File[]) => {
  if (!files.length) return
  if (deliver) return deliver(files)
  intent = files
  bus.emit("tool", "upload")
}

/** What the panel was opened for, once (the plain Upload button leaves it unset). */
export const takeUploadIntent = () => {
  const kind = intent
  intent = undefined
  return kind
}

/** The panel, while mounted, takes dropped files itself. */
export const acceptUploads = (take: ((files: File[]) => void) | undefined) => {
  deliver = take
}
