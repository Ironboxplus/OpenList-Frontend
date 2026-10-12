import { createMemo, createSignal, For, Show } from "solid-js"
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
} from "~/features/settings/form"
import { useFetch, useRouter, useT } from "~/hooks"
import { Me, me, setMe } from "~/store"
import {
  PEmptyResp,
  PResp,
  Type,
  User,
  UserMethods,
  UserPermissions,
} from "~/types"
import { getTarget, handleResp, notify, r } from "~/utils"
import { PublicKeys } from "./PublicKeys"

type PermissionName = (typeof UserPermissions)[number]

/**
 * How the permission bits are laid out on screen. The bit of a permission is
 * its position in UserPermissions; this only decides which box it sits in.
 * Anything not listed (a permission added later) lands in "other".
 */
export const PERMISSION_GROUPS: { id: string; names: PermissionName[] }[] = [
  {
    id: "browse",
    names: ["see_hides", "access_without_password", "read_archives"],
  },
  {
    id: "files",
    names: ["write_content", "rename", "move", "copy", "delete", "decompress"],
  },
  { id: "download", names: ["offline_download"] },
  { id: "share", names: ["share", "customize_share_id"] },
  {
    id: "protocol",
    names: ["webdav_read", "webdav_manage", "ftp_read", "ftp_manage"],
  },
  { id: "account", names: ["manage_user_info"] },
]

export const permissionGroups = () => {
  const placed = new Set(PERMISSION_GROUPS.flatMap((g) => g.names))
  const rest = UserPermissions.filter((p) => !placed.has(p))
  return rest.length > 0
    ? [...PERMISSION_GROUPS, { id: "other", names: rest }]
    : PERMISSION_GROUPS
}

const blankUser = (): User => ({
  id: 0,
  username: "",
  password: "",
  base_path: "",
  role: 0,
  permission: 0,
  disabled: false,
  sso_id: "",
  allow_ldap: false,
})

const AddOrEdit = () => {
  const t = useT()
  const { params, to } = useRouter()
  const { id } = params
  const [user, setUser] = createStore<User>(blankUser())
  const [baseline, setBaseline] = createSignal(JSON.stringify(user))
  const dirty = createMemo(() => JSON.stringify(user) !== baseline())
  const [error, setError] = createSignal<string>()

  const [loading, loadUser] = useFetch(
    (): PResp<User> => r.get(`/admin/user/get?id=${id}`),
    true,
  )
  const init = async () => {
    if (!id) {
      setUser(reconcile(blankUser()))
      setBaseline(JSON.stringify(user))
      return
    }
    handleResp(
      await loadUser(),
      (data) => {
        setError(undefined)
        setUser(data)
        setBaseline(JSON.stringify(user))
      },
      setError,
    )
  }
  init()

  const [saving, setSaving] = createSignal(false)
  const save = async () => {
    setSaving(true)
    const resp: Awaited<PEmptyResp> = await r.post(
      `/admin/user/${id ? "update" : "create"}`,
      getTarget(user),
    )
    setSaving(false)
    handleResp(resp, async () => {
      notify.success(t("global.save_success"))
      if (user.username === me().username)
        handleResp(await (r.get("/me") as PResp<Me>), setMe)
      to("/@manage/users", false, { replace: true })
    })
  }

  const setBit = (bit: number, on: boolean) =>
    setUser("permission", (p) => (on ? p | (1 << bit) : p & ~(1 << bit)))

  const isAdmin = () => UserMethods.is_admin(me())

  return (
    <SettingsForm
      dirty={dirty()}
      saving={saving()}
      resetting={loading()}
      saveLabel={t(`global.${id ? "save" : "add"}`)}
      onSave={save}
      onReset={init}
    >
      <DataState
        loading={id ? loading() : false}
        error={error()}
        onRetry={init}
      >
        <Show when={!UserMethods.is_guest(user)}>
          <SettingsSection
            id="user-account"
            title={t(`global.${id ? "edit" : "add"}`)}
          >
            <FieldRenderer
              field={{
                id: "username",
                type: Type.String,
                labelKey: "users.username",
                required: true,
              }}
              value={user.username}
              onChange={(raw) => setUser("username", String(raw))}
            />
            <FieldRenderer
              field={{
                id: "password",
                type: Type.String,
                labelKey: "users.password",
                required: true,
                secret: true,
                placeholder: "********",
              }}
              value={user.password}
              onChange={(raw) => setUser("password", String(raw))}
            />
          </SettingsSection>
        </Show>

        {/* Privileged fields: only a real admin may edit base path, permission
            bits, disabled and LDAP. A delegated (non-admin) editor sees just
            username/password, matching the backend update policy. */}
        <Show when={isAdmin()}>
          <SettingsSection id="user-access" title={t("users.permission")}>
            <FieldRenderer
              field={{
                id: "base_path",
                type: Type.String,
                labelKey: "users.base_path",
                required: true,
                picker: "folder",
              }}
              value={user.base_path}
              onChange={(raw) => setUser("base_path", String(raw))}
            />
            <div class="flex flex-col gap-4 py-3" data-field="permission">
              <For each={permissionGroups()}>
                {(group) => (
                  <fieldset class="flex flex-col gap-2">
                    <legend class="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t(`settings.form.permission_groups.${group.id}`)}
                    </legend>
                    <div class="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                      <For each={group.names}>
                        {(name) => {
                          const bit = UserPermissions.indexOf(name)
                          return (
                            <Checkbox
                              class="flex items-center gap-2"
                              data-permission={name}
                              checked={UserMethods.can(user, bit)}
                              onChange={(on) => setBit(bit, on)}
                            >
                              <CheckboxControl />
                              <CheckboxLabel class="text-sm">
                                {t(`users.permissions.${name}`)}
                              </CheckboxLabel>
                            </Checkbox>
                          )
                        }}
                      </For>
                    </div>
                  </fieldset>
                )}
              </For>
            </div>
            <FieldRenderer
              field={{
                id: "disabled",
                type: Type.Bool,
                labelKey: "users.disabled",
              }}
              value={user.disabled}
              onChange={(raw) => setUser("disabled", raw === true)}
            />
            <FieldRenderer
              field={{
                id: "allow_ldap",
                type: Type.Bool,
                labelKey: "users.allow_ldap",
              }}
              value={user.allow_ldap}
              onChange={(raw) => setUser("allow_ldap", raw === true)}
            />
          </SettingsSection>
        </Show>
        <Show when={id && !UserMethods.is_guest(user)}>
          <PublicKeys isMine={false} userId={parseInt(id)} />
        </Show>
      </DataState>
    </SettingsForm>
  )
}

export default AddOrEdit
