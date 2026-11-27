// What was dropped: files, and the files inside dropped folders. Kept apart
// from ./util (which loads the hash worker), as the file list takes drops too.

export const traverseFileTree = async (entry: FileSystemEntry) => {
  const res: File[] = []

  const internalProcess = async (entry: FileSystemEntry, path: string) => {
    await new Promise<void>((resolve, reject) => {
      const errorCallback: ErrorCallback = (e) => {
        console.error(e)
        reject(e)
      }
      if (entry.isFile) {
        ;(entry as FileSystemFileEntry).file((file) => {
          const newFile = new File([file], path + file.name, {
            type: file.type,
          })
          res.push(newFile)
          console.log(newFile)
          resolve()
        }, errorCallback)
      } else if (entry.isDirectory) {
        const dirReader = (entry as FileSystemDirectoryEntry).createReader()
        const readEntries = () => {
          dirReader.readEntries(async (entries) => {
            for (let i = 0; i < entries.length; i++) {
              await internalProcess(entries[i], path + entry.name + "/")
            }
            if (entries.length > 0) {
              readEntries()
            } else {
              resolve()
            }

            /**
            why? https://stackoverflow.com/questions/3590058/does-html5-allow-drag-drop-upload-of-folders-or-a-folder-tree/53058574#53058574
            Unfortunately none of the existing answers are completely correct because
            readEntries will not necessarily return ALL the (file or directory) entries for a given directory.
            This is part of the API specification (see Documentation section below).

            To actually get all the files, we'll need to call readEntries repeatedly (for each directory we encounter)
            until it returns an empty array. If we don't, we will miss some files/sub-directories in a directory
            e.g. in Chrome, readEntries will only return at most 100 entries at a time.

            */
          }, errorCallback)
        }
        readEntries()
      }
    })
  }
  await internalProcess(entry, "")
  return res
}

/** Whether a drag carries files from outside the page. */
export const draggingFiles = (e: DragEvent) =>
  !!e.dataTransfer && [...e.dataTransfer.types].includes("Files")

/**
 * The files of a drop. The items are read before anything is awaited: the
 * browser empties the DataTransfer once the drop handler returns. An item
 * without an entry (a DataTransfer made by a script) is taken as a file.
 */
export const filesOfDrop = async (dt: DataTransfer | null) => {
  const res: File[] = []
  const folders: FileSystemEntry[] = []
  const items = [...(dt?.items ?? [])].filter((i) => i.kind === "file")
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.()
    if (entry?.isDirectory) folders.push(entry)
    else {
      const file = item.getAsFile()
      if (file) res.push(file)
    }
  }
  if (!items.length) res.push(...(dt?.files ?? []))
  for (const entry of folders) res.push(...(await traverseFileTree(entry)))
  return res
}
