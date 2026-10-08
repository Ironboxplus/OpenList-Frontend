import type { SyncSpec } from "~/platform/contracts/task"

type Mode = SyncSpec["mode"]

/** Turn the form text into the request body; empty optional fields are left out. */
export const buildSpec = (f: {
  mode: Mode
  src: string
  dst: string
  dryRun: boolean
  sizeOnly: boolean
  trackRenames: boolean
  resync: boolean
  force: boolean
  filters: string
  transfers: string
  checkers: string
  maxDelete: string
}): Partial<SyncSpec> => {
  const spec: Partial<SyncSpec> = {
    mode: f.mode,
    src: f.src.trim(),
    dst: f.dst.trim(),
    dry_run: f.dryRun,
    size_only: f.sizeOnly,
    track_renames: f.trackRenames,
    filters: f.filters
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  }
  if (f.mode === "bisync") {
    spec.resync = f.resync
    spec.force = f.force
  }
  const num = (s: string) => {
    const n = Number.parseInt(s, 10)
    return Number.isFinite(n) && n >= 0 && s.trim() !== "" ? n : undefined
  }
  const transfers = num(f.transfers)
  if (transfers !== undefined && transfers > 0) spec.transfers = transfers
  const checkers = num(f.checkers)
  if (checkers !== undefined && checkers > 0) spec.checkers = checkers
  const maxDelete = num(f.maxDelete)
  if (maxDelete !== undefined) spec.max_delete = maxDelete
  return spec
}
