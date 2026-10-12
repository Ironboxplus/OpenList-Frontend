import crypto from "crypto-js"
import { TbPlus } from "solid-icons/tb"
import { createEffect, Index } from "solid-js"
import { createStore } from "solid-js/store"
import { FolderChooseInput } from "~/components"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import {
  createDeleteConfirm,
  createSettingsGroup,
  DataState,
  FieldRenderer,
  ResourceList,
  settingField,
  SettingsForm,
  SettingsSection,
  settingFromRaw,
  settingValue,
} from "~/features/settings/form"
import { useManageTitle, useT } from "~/hooks"
import { Group, SettingItem } from "~/types"
import { notify } from "~/utils"

const BUCKETS_KEY = "s3_buckets"
const KEY_FIELDS = ["s3_access_key_id", "s3_secret_access_key"]

interface Bucket {
  /** Row identity while editing; never sent. */
  uid: number
  name: string
  path: string
}

const parseBuckets = (json: string | undefined): Omit<Bucket, "uid">[] =>
  json ? JSON.parse(json) : []

/** A random access key id / secret, base64 of 15 and 30 random bytes. */
const randomKeys = () => {
  const b64 = (bytes: number) =>
    crypto.enc.Base64.stringify(crypto.lib.WordArray.random(bytes)).replace(
      /[\r\n]/g,
      "",
    )
  return { id: b64(120 / 8), secret: b64(240 / 8) }
}

const S3Settings = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.s3")
  const g = createSettingsGroup(Group.S3)
  g.load()

  // Buckets are one JSON string in the settings; edit them as rows and write
  // the string back. `written` is the JSON last read or written, so a reload
  // (or "load defaults") rebuilds the rows but our own edits do not.
  let uid = 0
  let written = ""
  const [buckets, setBuckets] = createStore<Bucket[]>([])
  createEffect(() => {
    const json = g.value(BUCKETS_KEY) ?? ""
    if (json === written) return
    written = json
    setBuckets(parseBuckets(json).map((b) => ({ uid: ++uid, ...b })))
  })
  const writeBuckets = () => {
    written = JSON.stringify(buckets.map(({ name, path }) => ({ name, path })))
    g.set(BUCKETS_KEY, written)
  }

  const edit = (b: Bucket, field: "name" | "path", value: string) => {
    setBuckets((x) => x.uid === b.uid, field, value)
    writeBuckets()
  }
  const NameCell = (p: { b: Bucket }) => (
    <Input
      aria-label={t("settings.s3_bucket_name")}
      data-field="bucket-name"
      value={p.b.name}
      onInput={(e) => edit(p.b, "name", e.currentTarget.value)}
    />
  )
  const PathCell = (p: { b: Bucket }) => (
    <FolderChooseInput
      value={p.b.path}
      onChange={(path) => edit(p.b, "path", path)}
    />
  )

  const removal = createDeleteConfirm<Bucket>({
    name: (b) => b.name || b.path,
    run: async (b) => {
      setBuckets((all) => all.filter((x) => x.uid !== b.uid))
      writeBuckets()
    },
  })

  const rows = (keys: (item: SettingItem) => boolean) => g.settings.filter(keys)
  const isKey = (item: SettingItem) => KEY_FIELDS.includes(item.key)
  const isBuckets = (item: SettingItem) => item.key === BUCKETS_KEY

  const save = async () => {
    // Names and paths are required and names must be unique.
    const names = new Set<string>()
    for (const b of buckets) {
      if (b.name === "" || b.path === "") {
        notify.error(t("settings.s3_buckets_empty"))
        return
      }
      if (names.has(b.name)) {
        notify.error(t("settings.s3_buckets_duplicate_name"))
        return
      }
      names.add(b.name)
    }
    await g.save()
  }

  const settingRow = (row: () => SettingItem) => (
    <FieldRenderer
      field={settingField(row())}
      value={settingValue(row())}
      onChange={(raw) => g.set(row().key, settingFromRaw(raw))}
    />
  )

  return (
    <>
      <SettingsForm
        dirty={g.dirty()}
        saving={g.saving()}
        resetting={g.loading()}
        onSave={save}
        onReset={g.load}
      >
        <DataState
          loading={g.loading()}
          error={g.error()}
          empty={g.settings.length === 0}
          onRetry={g.load}
        >
          <SettingsSection
            id="s3-server"
            title={t("settings.s3_server")}
            description={t("settings.s3_restart_to_apply")}
          >
            <Index each={rows((i) => !isKey(i) && !isBuckets(i))}>
              {settingRow}
            </Index>
          </SettingsSection>
          <SettingsSection
            id="s3-keys"
            title={t("settings.s3_credentials")}
            actions={
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const keys = randomKeys()
                  g.set("s3_access_key_id", keys.id)
                  g.set("s3_secret_access_key", keys.secret)
                }}
              >
                {t("settings.s3_generate")}
              </Button>
            }
          >
            <Index each={rows(isKey)}>{settingRow}</Index>
          </SettingsSection>
          <section id="s3-buckets" class="flex flex-col gap-2">
            <h2 class="text-base font-semibold">{t("settings.s3_buckets")}</h2>
            <ResourceList
              rows={buckets}
              rowKey={(b) => b.uid}
              emptyText={t("settings.s3_no_buckets")}
              toolbarActions={[
                {
                  id: "add-bucket",
                  label: t("global.add"),
                  icon: <TbPlus class="mr-1.5 size-4" />,
                  onSelect: () => {
                    setBuckets(buckets.length, {
                      uid: ++uid,
                      name: "",
                      path: "",
                    })
                    writeBuckets()
                  },
                },
              ]}
              columns={[
                {
                  id: "name",
                  header: t("settings.s3_bucket_name"),
                  cell: (b) => <NameCell b={b} />,
                },
                {
                  id: "path",
                  header: t("settings.s3_bucket_path"),
                  cell: (b) => <PathCell b={b} />,
                },
              ]}
              card={{
                title: (b) => <NameCell b={b} />,
                body: (b) => <PathCell b={b} />,
              }}
              actions={(b) => [
                {
                  id: "delete",
                  label: t("global.delete"),
                  destructive: true,
                  onSelect: () => removal.ask(b),
                },
              ]}
            />
          </section>
        </DataState>
      </SettingsForm>
      {removal.dialog()}
    </>
  )
}

export default S3Settings
