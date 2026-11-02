import { batch, createMemo, createSignal, Show } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { DataState } from "~/components/ui/data-state"
import {
  driverFromRaw,
  FieldRenderer,
  SettingsForm,
  SettingsSection,
  type FieldOption,
} from "~/features/settings/form"
import { useFetch, useRouter, useT } from "~/hooks"
import { me } from "~/store"
import { PResp, Share, ShareInfo, ShareUpdate, Type } from "~/types"
import { getExpireDate, handleResp, notify, r, randomPwd } from "~/utils"

const options = (name: string, csv: string): FieldOption[] =>
  csv.split(",").map((value) => ({
    value,
    labelKey: `shares.${name}s.${value}`,
  }))

type ChoiceName = "extract_folder" | "order_by" | "order_direction"

const AddOrEdit = () => {
  const t = useT()
  const { params, to } = useRouter()
  const { id } = params
  const [shareLoading, loadShare] = useFetch(
    (): PResp<ShareInfo> => r.get(`/share/get?id=${id}`),
    true,
  )
  const [share, setShare] = createStore<Share | ShareUpdate>({} as Share)
  const edited = () => share as ShareUpdate
  const [files, setFiles] = createSignal("")
  const [filesValid, setFilesValid] = createSignal(false)
  const [expireString, setExpireString] = createSignal("")
  const [expireValid, setExpireValid] = createSignal(true)
  const [error, setError] = createSignal<string>()
  const snapshot = () => JSON.stringify([share, files(), expireString()])
  const [baseline, setBaseline] = createSignal(snapshot())
  const dirty = createMemo(() => snapshot() !== baseline())

  const init = async () => {
    if (!id) {
      batch(() => {
        setShare(
          reconcile({
            burn_after_read: false,
            allow_preview: true,
            allow_download: true,
          } as Share),
        )
        setFiles("")
        setFilesValid(false)
        setExpireString("")
        setExpireValid(true)
        setBaseline(snapshot())
      })
      return
    }
    handleResp(
      await loadShare(),
      (data) => {
        batch(() => {
          setError(undefined)
          setShare(data as ShareUpdate)
          setFiles(data.files.join("\n"))
          setExpireString(
            data.expires ? new Date(data.expires).toLocaleString() : "",
          )
          setFilesValid(true)
          setBaseline(snapshot())
        })
      },
      setError,
    )
  }
  init()

  const [saving, save] = useFetch((): PResp<ShareInfo> =>
    r.post(`/share/${id ? "update" : "create"}`, share),
  )
  const submit = async () => {
    const resp = await save()
    handleResp(
      resp,
      () => {
        notify.success(t("global.save_success"))
        to("/@manage/shares", false, { replace: true })
      },
      () => {
        // A failed request can still have created the share: open it.
        if (resp.data?.id) to(`/@manage/shares/edit/${resp.data.id}`)
      },
    )
  }

  const setExpires = (text: string) => {
    setExpireString(text)
    if (text === "") {
      setExpireValid(true)
      setShare("expires", null)
      return
    }
    const date = getExpireDate(text)
    if (isNaN(date.getTime())) {
      setExpireValid(false)
    } else {
      setExpireValid(true)
      setShare("expires", date.toISOString())
    }
  }

  const Choice = (props: { name: ChoiceName; csv: string }) => (
    <FieldRenderer
      field={{
        id: props.name,
        type: Type.Select,
        labelKey: `shares.${props.name}`,
        options: options(props.name, props.csv),
      }}
      value={share[props.name]}
      onChange={(raw) => setShare(props.name, String(raw) as never)}
    />
  )

  const Flag = (props: {
    name: "burn_after_read" | "allow_preview" | "allow_download"
  }) => (
    <FieldRenderer
      field={{
        id: props.name,
        type: Type.Bool,
        labelKey: `shares.${props.name}`,
        helpKey: `shares.${props.name}_help`,
      }}
      value={share[props.name]}
      onChange={(raw) => setShare(props.name, raw === true)}
    />
  )

  return (
    <SettingsForm
      dirty={dirty()}
      invalid={!expireValid() || !filesValid()}
      saving={saving()}
      resetting={shareLoading()}
      saveLabel={t(`global.${id ? "save" : "add"}`)}
      onSave={submit}
      onReset={init}
    >
      <DataState
        loading={id ? shareLoading() : false}
        error={error()}
        onRetry={init}
      >
        <SettingsSection
          id="share-basic"
          title={t(`global.${id ? "edit" : "add"}`)}
        >
          <FieldRenderer
            field={{
              id: "id",
              type: Type.String,
              labelKey: "shares.id",
              placeholder: id ?? t("shares.id_placeholder"),
            }}
            value={id ? (edited().new_id ?? id) : (share.id ?? "")}
            onChange={(raw) =>
              id
                ? setShare("new_id" as never, String(raw) as never)
                : setShare("id", String(raw))
            }
          />
          <FieldRenderer
            field={{
              id: "files",
              type: Type.MultiPath,
              labelKey: "shares.files",
              required: true,
              invalid: !filesValid(),
              basePath: me().base_path,
            }}
            value={files()}
            onChange={(raw) => {
              const text = String(raw)
              setFiles(text)
              setFilesValid(text.length > 0)
              setShare("files", text.split("\n"))
            }}
          />
          <FieldRenderer
            field={{ id: "remark", type: Type.Text, labelKey: "shares.remark" }}
            value={share.remark}
            onChange={(raw) => setShare("remark", String(raw))}
          />
          <FieldRenderer
            field={{
              id: "pwd",
              type: Type.String,
              labelKey: "shares.pwd",
              generate: randomPwd,
            }}
            value={share.pwd}
            onChange={(raw) => setShare("pwd", String(raw))}
          />
        </SettingsSection>
        <SettingsSection
          id="share-options"
          title={t("settings.form.share_options")}
        >
          <Choice name="extract_folder" csv="front,back" />
          <Choice name="order_by" csv="name,size,modified" />
          <Choice name="order_direction" csv="asc,desc" />
          <FieldRenderer
            field={{
              id: "max_accessed",
              type: Type.Number,
              labelKey: "shares.max_accessed",
              helpKey: "shares.max_accessed_help",
            }}
            value={share.max_accessed}
            onChange={(raw) =>
              setShare(
                "max_accessed",
                driverFromRaw(Type.Number, raw) as number,
              )
            }
          />
          <Flag name="burn_after_read" />
          <Flag name="allow_preview" />
          <Flag name="allow_download" />
          <Alert variant="info">
            <AlertDescription>{t("shares.policy_note")}</AlertDescription>
          </Alert>
          <Show when={id}>
            <FieldRenderer
              field={{
                id: "accessed",
                type: Type.Number,
                labelKey: "shares.accessed",
              }}
              value={edited().accessed}
              onChange={(raw) =>
                setShare(
                  "accessed" as never,
                  driverFromRaw(Type.Number, raw) as never,
                )
              }
            />
          </Show>
          <FieldRenderer
            field={{
              id: "expires",
              type: Type.String,
              labelKey: "shares.expires",
              invalid: !expireValid(),
              placeholder: "yyyy-MM-dd HH:mm:ss or +1w1d1H1m1s1ms",
            }}
            value={expireString()}
            onChange={(raw) => setExpires(String(raw))}
          />
        </SettingsSection>
        <SettingsSection
          id="share-content"
          title={t("settings.form.share_content")}
        >
          <FieldRenderer
            field={{ id: "readme", type: Type.Text, labelKey: "shares.readme" }}
            value={share.readme}
            onChange={(raw) => setShare("readme", String(raw))}
          />
          <FieldRenderer
            field={{ id: "header", type: Type.Text, labelKey: "shares.header" }}
            value={share.header}
            onChange={(raw) => setShare("header", String(raw))}
          />
        </SettingsSection>
      </DataState>
    </SettingsForm>
  )
}

export default AddOrEdit
