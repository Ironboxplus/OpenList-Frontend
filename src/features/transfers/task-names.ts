// Legacy task names are free text built by the backend, e.g.
// `copy [/a](/a/x) to [/b](/b)`. These patterns are the only place that knows
// the formats; the manage/tasks helper imports them from here, and the
// adapter turns the matches into ObjectRefs so the UI never sees a raw name.

export const COPY_NAME = /^(?:copy|merge) \[(.*\/([^\/]*))]\((.*\/([^\/]*))\) to \[(.+)]\((.+)\)$/
export const MOVE_NAME = /^move \[(.*\/([^\/]*))]\((.*\/([^\/]*))\) to \[(.+)]\((.+)\)$/
export const UPLOAD_NAME = /^upload (.+) to \[(.+)]\((.+)\)$/
export const OFFLINE_DOWNLOAD_NAME = /^download (.+) to \((.+)\)$/
export const OFFLINE_TRANSFER_NAME =
  /^(transfer|upload) \[(.*)]\((.*\/([^\/]+))\) to \[(.+)]\((.+)\)$/
export const DECOMPRESS_NAME =
  /^decompress \[(.+)]\((.*\/([^\/]+))\)\[(.+)] to \[(.+)]\((.+)\) with password <(.*)>$/
export const DECOMPRESS_UPLOAD_NAME = UPLOAD_NAME
