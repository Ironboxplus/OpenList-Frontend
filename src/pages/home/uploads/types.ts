import type { UploadFileProps } from "~/features/transfers/local-uploads"
export type { UploadFileProps }
export const StatusBadge = {
  pending: "neutral",
  hashing: "warning",
  uploading: "info",
  backending: "info",
  success: "success",
  error: "danger",
} as const
export type SetUpload = (key: keyof UploadFileProps, value: any) => void
export type Upload = (
  uploadPath: string,
  file: File,
  setUpload: SetUpload,
  asTask: boolean,
  overwrite: boolean,
  rapid: boolean,
) => Promise<Error | undefined>
