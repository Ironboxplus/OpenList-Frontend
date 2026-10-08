// Small-file packing options of a sync job (OP-sync internal/syncjob
// pack_types.go): the form values, how they become the request body, and how
// the job's pack_stats read. Pure; the dialog and the detail view call it.
import type {
  PackOptions,
  PackStats,
  SyncSpec,
} from "~/platform/contracts/task"

type Mode = SyncSpec["mode"]

/** Packing only exists for jobs that upload: copy and sync. */
export const packAllowed = (mode: Mode): boolean =>
  mode === "copy" || mode === "sync"

export type SizeUnit = "K" | "M" | "G"
export const SIZE_UNITS: SizeUnit[] = ["K", "M", "G"]
const FACTOR: Record<SizeUnit, number> = {
  K: 1024,
  M: 1024 ** 2,
  G: 1024 ** 3,
}

export interface SizeInput {
  value: string
  unit: SizeUnit
}

/** 8388608 -> 8 M: the largest unit that divides the size exactly (else K). */
export const splitSize = (bytes: number): SizeInput => {
  for (const unit of ["G", "M"] as const) {
    if (bytes >= FACTOR[unit] && bytes % FACTOR[unit] === 0) {
      return { value: String(bytes / FACTOR[unit]), unit }
    }
  }
  return { value: String(Math.max(1, Math.round(bytes / 1024))), unit: "K" }
}

/** Bytes of a size field, or undefined when empty / not a positive number. */
export const sizeBytes = (s: SizeInput): number | undefined => {
  if (s.value.trim() === "") return undefined
  const n = Number(s.value)
  return Number.isFinite(n) && n > 0
    ? Math.round(n * FACTOR[s.unit])
    : undefined
}

export interface PackForm {
  pack: boolean
  unpack: boolean
  threshold: SizeInput
  minFiles: string
  maxPack: SizeInput
}

/** The form's starting values, from the backend's own defaults. */
export const packFormFrom = (d: PackOptions): PackForm => ({
  pack: false,
  unpack: false,
  threshold: splitSize(d.threshold),
  minFiles: String(d.min_files),
  maxPack: splitSize(d.max_pack_bytes),
})

/** i18n key of the problem with the pack fields, or undefined when fine. */
export const validatePack = (mode: Mode, f: PackForm): string | undefined => {
  if (!packAllowed(mode)) return undefined
  if (f.pack && f.unpack) return "transfers.form.pack_exclusive"
  if (!f.pack) return undefined
  const bad = (s: SizeInput) =>
    s.value.trim() !== "" && sizeBytes(s) === undefined
  const files = f.minFiles.trim()
  const filesBad =
    files !== "" && !(Number.isInteger(Number(files)) && Number(files) > 0)
  return bad(f.threshold) || bad(f.maxPack) || filesBad
    ? "transfers.form.pack_invalid"
    : undefined
}

/** The pack / unpack part of the request body; nothing for modes without it. */
export const packSpecPart = (
  mode: Mode,
  f: PackForm | undefined,
): Pick<SyncSpec, "pack" | "unpack"> | Record<string, never> => {
  if (!f || !packAllowed(mode)) return {}
  if (f.unpack && !f.pack) return { unpack: true }
  if (!f.pack) return {}
  const pack: Partial<PackOptions> = { enabled: true }
  const threshold = sizeBytes(f.threshold)
  if (threshold !== undefined) pack.threshold = threshold
  const files = Number(f.minFiles)
  if (f.minFiles.trim() !== "" && Number.isInteger(files) && files > 0) {
    pack.min_files = files
  }
  const max = sizeBytes(f.maxPack)
  if (max !== undefined) pack.max_pack_bytes = max
  return { pack: pack as PackOptions }
}

/** Share of the source bytes the packs saved, 0-100; undefined before any pack. */
export const packSavedPercent = (
  s: PackStats | undefined,
): number | undefined => {
  if (!s || !s.bytes_in || s.bytes_in <= 0 || s.bytes_out <= 0) return undefined
  return Math.round((1 - s.bytes_out / s.bytes_in) * 100)
}

/** The job is in a packing stage right now (not the plain transfer pass). */
export const packStage = (stage: string | undefined) =>
  stage === "packing" || stage === "unpacking" ? stage : undefined
