import { TbPlus } from "solid-icons/tb"
import { createSignal, For } from "solid-js"
import { Badge } from "~/components/ui/badge"
import { createDeleteConfirm, ResourceList } from "~/features/settings/form"
import { useFetch, useManageTitle, useRouter, useT } from "~/hooks"
import {
  PEmptyResp,
  PPageResp,
  User,
  UserMethods,
  UserPermissions,
  UserRole,
} from "~/types"
import { handleResp, notify, r } from "~/utils"
import { cn } from "~/utils/cn"

const ROLES = {
  [UserRole.GENERAL]: { name: "general", variant: "secondary" },
  [UserRole.GUEST]: { name: "guest", variant: "outline" },
  [UserRole.ADMIN]: { name: "admin", variant: "default" },
} as const

const RoleBadge = (props: { role: UserRole }) => (
  <Badge variant={ROLES[props.role].variant}>{ROLES[props.role].name}</Badge>
)

/** One dot per permission bit: green granted, red not; names on hover. */
const PermissionDots = (props: { user: User }) => {
  const t = useT()
  const granted = () =>
    UserPermissions.filter((_, i) => UserMethods.can(props.user, i)).length
  return (
    <span
      role="img"
      aria-label={`${granted()} / ${UserPermissions.length}`}
      class="inline-flex flex-wrap gap-0.5"
    >
      <For each={UserPermissions}>
        {(name, i) => (
          <span
            title={t(`users.permissions.${name}`)}
            class={cn(
              "size-2 rounded-full",
              UserMethods.can(props.user, i())
                ? "bg-success"
                : "bg-destructive",
            )}
          />
        )}
      </For>
    </span>
  )
}

const Availability = (props: { user: User }) => {
  const t = useT()
  return (
    <Badge variant={props.user.disabled ? "destructive" : "success"}>
      {t(`global.${props.user.disabled ? "no" : "yes"}`)}
    </Badge>
  )
}

const Users = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.users")
  const { to } = useRouter()
  const [loading, fetchList] = useFetch(
    (): PPageResp<User> => r.get("/admin/user/list"),
    true,
  )
  const [users, setUsers] = createSignal<User[]>([])
  const [error, setError] = createSignal<string>()
  const refresh = async () => {
    handleResp(
      await fetchList(),
      (data) => {
        setError(undefined)
        setUsers(data.content)
      },
      setError,
    )
  }
  refresh()

  const removal = createDeleteConfirm<User>({
    name: (u) => u.username,
    run: async (u) => {
      const resp: Awaited<PEmptyResp> = await r.post(
        `/admin/user/delete?id=${u.id}`,
      )
      handleResp(resp, () => {
        notify.success(t("global.delete_success"))
        refresh()
      })
    },
  })

  const cancel2fa = async (u: User) => {
    const resp: Awaited<PEmptyResp> = await r.post(
      `/admin/user/cancel_2fa?id=${u.id}`,
    )
    handleResp(resp, () => {
      notify.success(t("users.cancel_2fa_success"))
      refresh()
    })
  }

  return (
    <>
      <ResourceList
        rows={users()}
        rowKey={(u) => u.id}
        loading={loading()}
        error={error()}
        onRefresh={refresh}
        toolbarActions={[
          {
            id: "add",
            label: t("global.add"),
            icon: <TbPlus class="mr-1.5 size-4" />,
            onSelect: () => to("/@manage/users/add"),
          },
        ]}
        columns={[
          {
            id: "username",
            header: t("users.username"),
            cell: (u) => <span class="font-medium">{u.username}</span>,
            sort: (u) => u.username,
          },
          {
            id: "base_path",
            header: t("users.base_path"),
            cell: (u) => <span class="break-all">{u.base_path}</span>,
            sort: (u) => u.base_path,
          },
          {
            id: "role",
            header: t("users.role"),
            cell: (u) => <RoleBadge role={u.role} />,
            sort: (u) => u.role,
          },
          {
            id: "permission",
            header: t("users.permission"),
            cell: (u) => <PermissionDots user={u} />,
          },
          {
            id: "available",
            header: t("users.available"),
            cell: (u) => <Availability user={u} />,
          },
        ]}
        card={{
          title: (u) => u.username,
          badges: (u) => (
            <>
              <RoleBadge role={u.role} />
              <Availability user={u} />
            </>
          ),
          body: (u) => (
            <div class="flex flex-col gap-2">
              <span class="break-all">{u.base_path}</span>
              <PermissionDots user={u} />
            </div>
          ),
        }}
        primary={(u) => ({
          id: "edit",
          label: t("global.edit"),
          onSelect: () => to(`/@manage/users/edit/${u.id}`),
        })}
        actions={() => [
          {
            id: "cancel-2fa",
            label: t("users.cancel_2fa"),
            onSelect: cancel2fa,
          },
          {
            id: "delete",
            label: t("global.delete"),
            destructive: true,
            onSelect: removal.ask,
          },
        ]}
      />
      {removal.dialog()}
    </>
  )
}

export default Users
