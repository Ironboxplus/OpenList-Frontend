import { createResource, createSignal, For, Show } from "solid-js"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import {
  Switch,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "~/components/ui/switch"
import { TextArea } from "~/components/ui/textarea"
import {
  TextField,
  TextFieldLabel,
  TextFieldRoot,
} from "~/components/ui/textfield"
import { useT } from "~/hooks"
import type { SyncSnapshot, SyncSpec } from "~/platform/contracts/task"
import { fetchPackDefaults, runSync } from "./api"
import {
  packAllowed,
  packFormFrom,
  SIZE_UNITS,
  validatePack,
  type PackForm,
  type SizeInput,
  type SizeUnit,
} from "./pack"
import { buildSpec } from "./sync-spec"

type Mode = SyncSpec["mode"]
const MODES: Mode[] = ["copy", "sync", "bisync", "check"]

/** A number with a K / M / G unit picker (native select: it is a one-off pick). */
const SizeField = (p: {
  label: string
  testid: string
  value: SizeInput
  onChange: (v: SizeInput) => void
}) => (
  <div class="flex flex-col gap-1.5">
    <label class="text-sm font-medium">{p.label}</label>
    <div class="flex gap-1.5">
      <input
        type="number"
        min="1"
        inputmode="decimal"
        data-testid={p.testid}
        value={p.value.value}
        onInput={(e) =>
          p.onChange({ ...p.value, value: e.currentTarget.value })
        }
        class="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
      />
      <select
        data-testid={`${p.testid}-unit`}
        value={p.value.unit}
        onChange={(e) =>
          p.onChange({ ...p.value, unit: e.currentTarget.value as SizeUnit })
        }
        class="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
      >
        <For each={SIZE_UNITS}>
          {(u) => (
            <option value={u} selected={u === p.value.unit}>
              {u}B
            </option>
          )}
        </For>
      </select>
    </div>
  </div>
)

export const NewSyncDialog = (props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (snap: SyncSnapshot) => void
}) => {
  const t = useT()
  const [mode, setMode] = createSignal<Mode>("copy")
  const [src, setSrc] = createSignal("")
  const [dst, setDst] = createSignal("")
  const [dryRun, setDryRun] = createSignal(false)
  const [sizeOnly, setSizeOnly] = createSignal(false)
  const [trackRenames, setTrackRenames] = createSignal(false)
  const [resync, setResync] = createSignal(false)
  const [force, setForce] = createSignal(false)
  const [filters, setFilters] = createSignal("")
  const [transfers, setTransfers] = createSignal("")
  const [checkers, setCheckers] = createSignal("")
  const [maxDelete, setMaxDelete] = createSignal("")
  const [error, setError] = createSignal<string>()
  const [busy, setBusy] = createSignal(false)

  // The backend's defaults; a server without packing answers 404 and the
  // options are not offered at all.
  const [packDefaults] = createResource(fetchPackDefaults)
  const [pack, setPack] = createSignal(false)
  const [unpack, setUnpack] = createSignal(false)
  const [threshold, setThreshold] = createSignal<SizeInput>()
  const [minFiles, setMinFiles] = createSignal<string>()
  const [maxPack, setMaxPack] = createSignal<SizeInput>()
  const packForm = (): PackForm | undefined => {
    const d = packDefaults()
    if (!d) return undefined
    const base = packFormFrom(d)
    return {
      pack: pack(),
      unpack: unpack(),
      threshold: threshold() ?? base.threshold,
      minFiles: minFiles() ?? base.minFiles,
      maxPack: maxPack() ?? base.maxPack,
    }
  }
  const showPack = () => !!packDefaults() && packAllowed(mode())

  const modeLabel = (m: Mode) => t(`transfers.form.mode_${m}`)

  const submit = async () => {
    setError(undefined)
    if (!src().trim() || !dst().trim()) {
      setError(t("transfers.form.required"))
      return
    }
    const form = showPack() ? packForm() : undefined
    const bad = form ? validatePack(mode(), form) : undefined
    if (bad) {
      setError(t(bad))
      return
    }
    setBusy(true)
    try {
      const resp = await runSync(
        buildSpec({
          mode: mode(),
          src: src(),
          dst: dst(),
          dryRun: dryRun(),
          sizeOnly: sizeOnly(),
          trackRenames: trackRenames(),
          resync: resync(),
          force: force(),
          filters: filters(),
          transfers: transfers(),
          checkers: checkers(),
          maxDelete: maxDelete(),
          pack: form,
        }),
      )
      if (resp.code === 200) {
        props.onOpenChange(false)
        props.onCreated(resp.data)
      } else {
        // The backend's message (bad mode, unmounted path, bad filter...) is
        // shown in place so the user can fix the form without losing it.
        setError(resp.message || `HTTP ${resp.code}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const Toggle = (p: {
    label: string
    checked: boolean
    onChange: (v: boolean) => void
    testid: string
  }) => (
    <Switch
      checked={p.checked}
      onChange={p.onChange}
      class="flex items-center gap-2"
      data-testid={p.testid}
    >
      <SwitchControl>
        <SwitchThumb />
      </SwitchControl>
      <SwitchLabel class="text-sm">{p.label}</SwitchLabel>
    </Switch>
  )

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("transfers.form.title")}</DialogTitle>
          <DialogDescription class="sr-only">
            {t("transfers.form.title")}
          </DialogDescription>
        </DialogHeader>

        <form
          class="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">
              {t("transfers.form.mode")}
            </label>
            <Select<Mode>
              value={mode()}
              onChange={(m) => m && setMode(m)}
              options={MODES}
              disallowEmptySelection
              itemComponent={(p) => (
                <SelectItem item={p.item}>
                  {modeLabel(p.item.rawValue)}
                </SelectItem>
              )}
            >
              <SelectTrigger data-testid="sync-mode">
                <SelectValue<Mode>>
                  {(s) => modeLabel(s.selectedOption())}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>

          <TextFieldRoot value={src()} onChange={setSrc}>
            <TextFieldLabel>{t("transfers.form.src")}</TextFieldLabel>
            <TextField
              data-testid="sync-src"
              placeholder={t("transfers.form.path_hint")}
              autocomplete="off"
              spellcheck={false}
            />
          </TextFieldRoot>
          <TextFieldRoot value={dst()} onChange={setDst}>
            <TextFieldLabel>{t("transfers.form.dst")}</TextFieldLabel>
            <TextField
              data-testid="sync-dst"
              placeholder={t("transfers.form.path_hint")}
              autocomplete="off"
              spellcheck={false}
            />
          </TextFieldRoot>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Toggle
              testid="sync-dry-run"
              label={t("transfers.form.dry_run")}
              checked={dryRun()}
              onChange={setDryRun}
            />
            <Toggle
              testid="sync-size-only"
              label={t("transfers.form.size_only")}
              checked={sizeOnly()}
              onChange={setSizeOnly}
            />
            <Toggle
              testid="sync-track-renames"
              label={t("transfers.form.track_renames")}
              checked={trackRenames()}
              onChange={setTrackRenames}
            />
            <Show when={mode() === "bisync"}>
              <Toggle
                testid="sync-resync"
                label={t("transfers.form.resync")}
                checked={resync()}
                onChange={setResync}
              />
              <Toggle
                testid="sync-force"
                label={t("transfers.form.force")}
                checked={force()}
                onChange={setForce}
              />
            </Show>
          </div>

          <Show when={showPack()}>
            <div class="flex flex-col gap-3" data-testid="sync-pack-section">
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Toggle
                  testid="sync-pack"
                  label={t("transfers.form.pack")}
                  checked={pack()}
                  onChange={(v) => {
                    setPack(v)
                    if (v) setUnpack(false)
                  }}
                />
                <Toggle
                  testid="sync-unpack"
                  label={t("transfers.form.unpack")}
                  checked={unpack()}
                  onChange={(v) => {
                    setUnpack(v)
                    if (v) setPack(false)
                  }}
                />
              </div>
              <Show when={pack()}>
                <details data-testid="sync-pack-advanced" class="text-sm">
                  <summary class="cursor-pointer select-none font-medium">
                    {t("transfers.form.advanced")}
                  </summary>
                  <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <SizeField
                      testid="sync-pack-threshold"
                      label={t("transfers.form.pack_threshold")}
                      value={threshold() ?? packForm()!.threshold}
                      onChange={setThreshold}
                    />
                    <TextFieldRoot
                      value={minFiles() ?? packForm()!.minFiles}
                      onChange={setMinFiles}
                    >
                      <TextFieldLabel>
                        {t("transfers.form.pack_min_files")}
                      </TextFieldLabel>
                      <TextField
                        type="number"
                        min="1"
                        inputmode="numeric"
                        data-testid="sync-pack-min-files"
                      />
                    </TextFieldRoot>
                    <SizeField
                      testid="sync-pack-max"
                      label={t("transfers.form.pack_max")}
                      value={maxPack() ?? packForm()!.maxPack}
                      onChange={setMaxPack}
                    />
                  </div>
                </details>
              </Show>
            </div>
          </Show>

          <TextFieldRoot value={filters()} onChange={setFilters}>
            <TextFieldLabel>{t("transfers.form.filters")}</TextFieldLabel>
            <TextArea
              data-testid="sync-filters"
              rows={3}
              placeholder={t("transfers.form.filters_hint")}
              class="font-mono"
              spellcheck={false}
            />
          </TextFieldRoot>

          <div class="grid grid-cols-3 gap-3">
            <For
              each={
                [
                  ["transfers", transfers, setTransfers],
                  ["checkers", checkers, setCheckers],
                  ["max_delete", maxDelete, setMaxDelete],
                ] as const
              }
            >
              {([key, value, set]) => (
                <TextFieldRoot value={value()} onChange={set}>
                  <TextFieldLabel>{t(`transfers.form.${key}`)}</TextFieldLabel>
                  <TextField
                    type="number"
                    min="0"
                    inputmode="numeric"
                    placeholder={t("transfers.form.optional")}
                    data-testid={`sync-${key}`}
                  />
                </TextFieldRoot>
              )}
            </For>
          </div>

          <Show when={error()}>
            <p
              role="alert"
              data-testid="sync-error"
              class="whitespace-pre-wrap rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error()}
            </p>
          </Show>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => props.onOpenChange(false)}
            >
              {t("transfers.form.cancel")}
            </Button>
            <Button type="submit" disabled={busy()} data-testid="sync-submit">
              {t("transfers.form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
