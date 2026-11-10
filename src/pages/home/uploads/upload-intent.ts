import { bus } from "~/utils/bus"

let intent: "file" | "folder" | undefined

/**
 * Open the upload panel for one kind of source: the panel opens that picker as
 * it mounts, so "Upload folder" in the New menu lands on the folder dialog.
 */
export const requestUpload = (kind: "file" | "folder") => {
  intent = kind
  bus.emit("tool", "upload")
}

/** What the panel was opened for, once (the plain Upload button leaves it unset). */
export const takeUploadIntent = () => {
  const kind = intent
  intent = undefined
  return kind
}
