import { createSignal, Show } from "solid-js"
import { Button } from "~/components/ui/button"
import { focusRing } from "~/components/ui/focus"
import { TextArea } from "~/components/ui/textarea"
import { TextField, TextFieldRoot } from "~/components/ui/textfield"
import { useT } from "~/hooks"
import { cn } from "~/utils/cn"
import { setMediaMeta, uploadMediaImage } from "./client"
import { detailsBody, isEmptyBody, type EditorItem } from "./editor-item"

const fileInput =
  "block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-input file:bg-transparent file:px-2 file:py-1 file:text-xs file:text-foreground"

type Role = "poster" | "backdrop"

/**
 * Title, original title, year, overview and the images of a work, saved with
 * one POST /api/admin/media/curate/set. An image is a file the admin picks or
 * a url the server downloads; it is stored first and only then referenced.
 */
export const MediaDetailsForm = (props: {
  item: EditorItem
  /** The work changed on the server: the host reloads what it shows. */
  onSaved: () => void
  onFail: (message?: string, category?: string) => void
}) => {
  const t = useT()
  const [title, setTitle] = createSignal(props.item.title)
  const [original, setOriginal] = createSignal(props.item.original_title)
  const [year, setYear] = createSignal(
    props.item.year ? String(props.item.year) : "",
  )
  const [overview, setOverview] = createSignal(props.item.overview)
  const files: Partial<Record<Role, File>> = {}
  const [urls, setUrls] = createSignal<Record<Role, string>>({
    poster: "",
    backdrop: "",
  })
  const [busy, setBusy] = createSignal(false)
  const [saved, setSaved] = createSignal(false)

  const imageRef = async (role: Role): Promise<string | undefined | null> => {
    const source = files[role] ?? (urls()[role].trim() || undefined)
    if (!source) return undefined
    const out = await uploadMediaImage(props.item.path, role, source)
    if (!out.ok) {
      props.onFail(out.message, out.category)
      return null
    }
    return out.data?.cover
  }

  const save = async () => {
    setBusy(true)
    setSaved(false)
    const body = detailsBody(props.item, {
      title: title(),
      original_title: original(),
      year: year(),
      overview: overview(),
    })
    const poster = await imageRef("poster")
    if (poster === null) return setBusy(false)
    const backdrop = await imageRef("backdrop")
    if (backdrop === null) return setBusy(false)
    if (poster) body.cover = poster
    if (backdrop) body.backdrop = backdrop
    if (isEmptyBody(body)) {
      setBusy(false)
      return
    }
    const out = await setMediaMeta(body)
    setBusy(false)
    if (!out.ok) return props.onFail(out.message, out.category)
    setSaved(true)
    props.onSaved()
  }

  const label = "flex flex-col gap-1 text-xs text-muted-foreground"
  return (
    <details class="rounded-md border px-3 py-2" data-editor-details>
      <summary class="cursor-pointer text-sm font-medium">
        {t("media.editor.details")}
      </summary>
      <div class="mt-3 flex flex-col gap-3">
        <label class={label}>
          {t("media.editor.field_title")}
          <TextFieldRoot value={title()} onChange={setTitle}>
            <TextField data-editor-title />
          </TextFieldRoot>
        </label>
        <div class="grid grid-cols-[1fr_6rem] gap-3">
          <label class={label}>
            {t("media.editor.field_original")}
            <TextFieldRoot value={original()} onChange={setOriginal}>
              <TextField data-editor-original />
            </TextFieldRoot>
          </label>
          <label class={label}>
            {t("media.editor.field_year")}
            <TextFieldRoot value={year()} onChange={setYear}>
              <TextField data-editor-year inputmode="numeric" />
            </TextFieldRoot>
          </label>
        </div>
        <label class={label}>
          {t("media.editor.field_overview")}
          <TextFieldRoot value={overview()} onChange={setOverview}>
            <TextArea data-editor-overview rows={4} />
          </TextFieldRoot>
        </label>

        {(["poster", "backdrop"] as const).map((role) => (
          <fieldset class="m-0 flex flex-col gap-1 border-0 p-0">
            <legend class="mb-1 text-xs text-muted-foreground">
              {t(`media.editor.image_${role}`)}
            </legend>
            <Show when={role === "poster" && props.item.cover}>
              <img
                src={props.item.cover}
                alt=""
                class="mb-1 h-24 w-16 rounded object-cover"
              />
            </Show>
            <input
              type="file"
              accept="image/*"
              data-editor-file={role}
              class={cn(fileInput, focusRing)}
              onChange={(e) => {
                const f = e.currentTarget.files?.[0]
                if (f) files[role] = f
                else delete files[role]
              }}
            />
            <TextFieldRoot
              value={urls()[role]}
              onChange={(v) => setUrls({ ...urls(), [role]: v })}
            >
              <TextField
                data-editor-url={role}
                placeholder={t("media.editor.image_url")}
              />
            </TextFieldRoot>
          </fieldset>
        ))}

        <div class="flex items-center gap-2">
          <Button
            size="sm"
            data-editor-save-details
            disabled={busy()}
            onClick={() => void save()}
          >
            {busy() ? t("media.editor.saving") : t("media.editor.save_details")}
          </Button>
          <Show when={saved()}>
            <span class="text-xs text-muted-foreground">
              {t("media.editor.saved")}
            </span>
          </Show>
        </div>
      </div>
    </details>
  )
}
