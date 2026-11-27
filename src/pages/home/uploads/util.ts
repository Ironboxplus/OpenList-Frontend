import { UploadFileProps } from "./types"
import type { WorkerMessage } from "./hash-worker"
import HashWorker from "./hash-worker?worker&inline"

// moved to ./drop with the rest of what a drop gives
export { traverseFileTree } from "./drop"

export const File2Upload = (file: File): UploadFileProps => {
  return {
    name: file.name,
    path: file.webkitRelativePath || file.name,
    size: file.size,
    progress: 0,
    speed: 0,
    status: "pending",
  }
}

export const calculateHash = async (
  file: File,
  onProgress?: (progress: number) => void,
) => {
  return new Promise<{ md5: string; sha1: string; sha256: string }>(
    (resolve, reject) => {
      const worker = new HashWorker()

      const terminate = (fn: () => void) => {
        worker.terminate()
        fn()
      }

      worker.postMessage({ file })

      worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
        const data = e.data
        switch (data.type) {
          case "progress":
            onProgress?.(data.progress)
            break
          case "result":
            terminate(() => resolve(data.hash))
            break
          case "error":
            terminate(() => reject(new Error(data.error)))
            break
        }
      }

      worker.onerror = (e) => terminate(() => reject(e))
    },
  )
}
