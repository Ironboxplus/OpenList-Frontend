import { createMemo, createSignal, For } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import {
  Checkbox,
  CheckboxControl,
  CheckboxLabel,
} from "~/components/ui/checkbox"
import {
  DataState,
  FieldRenderer,
  SettingsForm,
  SettingsSection,
  type FieldSpec,
} from "~/features/settings/form"
import { useFetch, useRouter, useT } from "~/hooks"
import { Meta, PEmptyResp, PPageResp, PResp, Type, User } from "~/types"
import { handleResp, notify, r } from "~/utils"

type SubFlag =
  | "p_sub"
  | "read_users_sub"
  | "write_users_sub"
  | "w_sub"
  | "h_sub"
  | "header_sub"
  | "r_sub"
type TextField = "password" | "hide" | "header" | "readme"
type UsersField = "read_users" | "write_users"

const blankMeta = (): Meta => ({
  id: 0,
  path: "",
  read_users: [],
  read_users_sub: false,
  write_users: [],
  write_users_sub: false,
  password: "",
  p_sub: false,
  write: false,
  w_sub: false,
  hide: "",
  h_sub: false,
  readme: "",
  r_sub: false,
  header: "",
  header_sub: false,
})

const AddOrEdit = () => {
  const t = useT()
  const { params, to } = useRouter()
  const { id } = params
  const [meta, setMeta] = createStore<Meta>(blankMeta())
  const [users, setUsers] = createSignal<User[]>([])
  const [error, setError] = createSignal<string>()
  const [baseline, setBaseline] = createSignal(JSON.stringify(meta))
  const dirty = createMemo(() => JSON.stringify(meta) !== baseline())

  const [metaLoading, loadMeta] = useFetch(
    (): PResp<Meta> => r.get(`/admin/meta/get?id=${id}`),
    true,
  )
  const [usersLoading, loadUsers] = useFetch(
    (): PPageResp<User> => r.get("/admin/user/list"),
    true,
  )

  const init = async () => {
    handleResp(await loadUsers(), (data) => setUsers(data.content), setError)
    if (!id) {
      setMeta(reconcile(blankMeta()))
      setBaseline(JSON.stringify(meta))
      return
    }
    handleResp(
      await loadMeta(),
      (data) => {
        setError(undefined)
        setMeta(data)
        setBaseline(JSON.stringify(meta))
      },
      setError,
    )
  }
  init()

  const [saving, save] = useFetch((): PEmptyResp =>
    r.post(`/admin/meta/${id ? "update" : "create"}`, meta),
  )
  const submit = async () => {
    handleResp(await save(), () => {
      notify.success(t("global.save_success"))
      to("/@manage/metas", false, { replace: true })
    })
  }

  /** Every rule can also apply to the sub folders: a checkbox under its field. */
  const ApplySub = (props: { name: string; flag: SubFlag }) => (
    <Checkbox
      class="flex items-center gap-2"
      id={`${props.name}_sub`}
      checked={meta[props.flag]}
      onChange={(on) => setMeta(props.flag, on)}
    >
      <CheckboxControl />
      <CheckboxLabel class="text-sm text-muted-foreground">
        {t("metas.apply_sub")}
      </CheckboxLabel>
    </Checkbox>
  )

  const textField = (
    name: TextField,
    sub: SubFlag,
    type: Type,
    help: boolean,
  ) => (
    <FieldRenderer
      field={{
        id: name,
        type,
        labelKey: `metas.${name}`,
        helpKey: help ? `metas.${name}_help` : undefined,
      }}
      value={meta[name]}
      onChange={(raw) => setMeta(name, String(raw))}
      after={<ApplySub name={name} flag={sub} />}
    />
  )

  const usersField = (name: UsersField, sub: SubFlag) => {
    const spec = (): FieldSpec => ({
      id: name,
      type: Type.Select,
      labelKey: `metas.${name}`,
      helpKey: `metas.${name}_help`,
      multiple: true,
      emptyLabelKey: "metas.all_permitted_users",
      options: users().map((u) => ({ value: String(u.id), label: u.username })),
    })
    return (
      <FieldRenderer
        field={spec()}
        value={meta[name].map(String)}
        onChange={(raw) => setMeta(name, (raw as string[]).map(Number))}
        after={<ApplySub name={name} flag={sub} />}
      />
    )
  }

  const loading = () => (id ? metaLoading() : false) || usersLoading()

  return (
    <SettingsForm
      dirty={dirty()}
      saving={saving()}
      resetting={loading()}
      saveLabel={t(`global.${id ? "save" : "add"}`)}
      onSave={submit}
      onReset={init}
    >
      <DataState loading={loading()} error={error()} onRetry={init}>
        <SettingsSection
          id="meta-access"
          title={t(`global.${id ? "edit" : "add"}`)}
        >
          <FieldRenderer
            field={{
              id: "path",
              type: Type.String,
              labelKey: "metas.path",
              required: true,
              picker: "path",
            }}
            value={meta.path}
            onChange={(raw) => setMeta("path", String(raw))}
          />
          {textField("password", "p_sub", Type.String, false)}
          {usersField("read_users", "read_users_sub")}
          {usersField("write_users", "write_users_sub")}
          <FieldRenderer
            field={{
              id: "write",
              type: Type.Bool,
              labelKey: "metas.write",
              helpKey: "metas.write_help",
            }}
            value={meta.write}
            onChange={(raw) => setMeta("write", raw === true)}
            after={<ApplySub name="write" flag="w_sub" />}
          />
        </SettingsSection>
        <SettingsSection
          id="meta-content"
          title={t("settings.form.meta_content")}
        >
          {textField("hide", "h_sub", Type.Text, true)}
          {textField("header", "header_sub", Type.Text, true)}
          {textField("readme", "r_sub", Type.Text, true)}
        </SettingsSection>
      </DataState>
    </SettingsForm>
  )
}

export default AddOrEdit
