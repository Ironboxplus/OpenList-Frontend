import { TbGauge } from "solid-icons/tb"
import { createSignal, onMount, Show } from "solid-js"
import { Button } from "~/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "~/components/ui/popover"
import {
  TextField,
  TextFieldLabel,
  TextFieldRoot,
} from "~/components/ui/textfield"
import { useT } from "~/hooks"
import { notify } from "~/utils/notify"
import { getBwLimit, setBwLimit } from "./api"
import { formatBytes } from "./format"

/**
 * The bandwidth cap of all sync jobs together (OP internal/syncjob
 * SetBwLimit): what it is now, read when it is shown, and a box to change it
 * at once. The transfers page has it in a popover, the transfer settings page
 * as a card.
 */
export const SyncBandwidthForm = () => {
  const t = useT()
  const [current, setCurrent] = createSignal<number>()
  const [rate, setRate] = createSignal("")
  const [error, setError] = createSignal<string>()
  const [busy, setBusy] = createSignal(false)

  onMount(async () => {
    try {
      const resp = await getBwLimit()
      if (resp.code === 200) setCurrent(resp.data.bytes_per_second)
      else setError(resp.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  })

  const apply = async () => {
    if (!rate().trim()) return
    setBusy(true)
    setError(undefined)
    try {
      const resp = await setBwLimit(rate().trim())
      if (resp.code === 200) {
        setCurrent(resp.data.bytes_per_second)
        setRate("")
        notify.success(t("transfers.bw.applied"))
      } else {
        setError(resp.message || `HTTP ${resp.code}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="flex flex-col">
      <p class="text-sm text-muted-foreground">
        {t("transfers.bw.current")}:{" "}
        <span class="font-medium text-foreground" data-testid="bwlimit-current">
          <Show when={current() !== undefined} fallback="…">
            {current()! < 0
              ? t("transfers.bw.unlimited")
              : `${formatBytes(current())}/s`}
          </Show>
        </span>
      </p>
      {/* not a <form>: on the settings page it sits inside the page's own */}
      <div class="mt-3 flex flex-col gap-3">
        <TextFieldRoot value={rate()} onChange={setRate}>
          <TextFieldLabel>{t("transfers.bw.rate")}</TextFieldLabel>
          <TextField
            data-testid="bwlimit-input"
            placeholder={t("transfers.bw.hint")}
            autocomplete="off"
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key !== "Enter") return
              e.preventDefault()
              void apply()
            }}
          />
        </TextFieldRoot>
        <Show when={error()}>
          <p role="alert" class="text-xs text-destructive">
            {error()}
          </p>
        </Show>
        <Button
          type="button"
          size="sm"
          class="self-start"
          disabled={busy()}
          data-testid="bwlimit-apply"
          onClick={() => void apply()}
        >
          {t("transfers.bw.apply")}
        </Button>
      </div>
    </div>
  )
}

export const BandwidthPopover = () => {
  const t = useT()
  return (
    <Popover placement="bottom-end">
      <PopoverTrigger
        as={Button}
        variant="outline"
        size="sm"
        data-testid="bwlimit-button"
      >
        <TbGauge class="mr-1.5 size-4" />
        {t("transfers.sync.bwlimit")}
      </PopoverTrigger>
      <PopoverContent class="w-72">
        <PopoverTitle class="mb-2 text-sm font-medium">
          {t("transfers.bw.title")}
        </PopoverTitle>
        <SyncBandwidthForm />
      </PopoverContent>
    </Popover>
  )
}
