import { SeedFormat, SeedHashMatrix } from "~/types"
import type { UploadFileProps } from "~/features/transfers/local-uploads"
export type { UploadFileProps }

export interface UploadSeedOptions {
  formats: SeedFormat[]
  hash_matrix: SeedHashMatrix
  piece_size: number
}

export const seedUploadHeaders = (
  options?: UploadSeedOptions,
): Record<string, string> => {
  if (!options?.formats.length) return {}
  return {
    "X-Seed-Sidecars": options.formats.join(","),
    "X-Seed-Hash-Matrix": encodeURIComponent(
      JSON.stringify(options.hash_matrix),
    ),
    "X-Seed-Piece-Size": String(options.piece_size),
  }
}

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
  seedOptions?: UploadSeedOptions,
) => Promise<Error | undefined>
