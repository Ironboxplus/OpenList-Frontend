import { createMemo, createSignal } from "solid-js"
import { Badge } from "~/components/ui/badge"
import { createDeleteConfirm, ResourceList } from "~/features/settings/form"
import { useFetch, useRouter, useT } from "~/hooks"
import { PEmptyResp, PPageResp, PResp, Session, User } from "~/types"
import { changeToken, handleResp, loginUrlFor, notify, r } from "~/utils"
import { formatDate } from "~/utils/str"
import { describeUA } from "~/utils/ua"

export interface SessionsProps {
  /** Every user's sessions (admin) instead of the signed-in user's own. */
  admin?: boolean
}

const at = (seconds: number) => formatDate(new Date(seconds * 1000).toString())

/** Logged-in devices, with the means to end any of them. */
export const Sessions = (props: SessionsProps) => {
  const t = useT()
  const { to } = useRouter()
  const [rows, setRows] = createSignal<Session[]>([])
  const [names, setNames] = createSignal<Record<number, string>>({})
  const [error, setError] = createSignal<string>()
  const [loading, fetchSessions] = useFetch(
    (): PResp<Session[]> =>
      r.get(props.admin ? "/admin/session/list" : "/me/sessions"),
    true,
  )
  const [, fetchUsers] = useFetch((): PPageResp<User> =>
    r.get("/admin/user/list"),
  )

  const refresh = async () => {
    handleResp(
      await fetchSessions(),
      (data) => {
        setError(undefined)
        setRows(data ?? [])
      },
      setError,
    )
    if (props.admin) {
      // Names are decoration: a failed lookup leaves "#id".
      handleResp(
        await fetchUsers(),
        (data) =>
          setNames(
            Object.fromEntries(data.content.map((u) => [u.id, u.username])),
          ),
        () => {},
        false,
        false,
      )
    }
  }
  refresh()

  // The device in hand first, then the most recently used.
  const sorted = createMemo(() =>
    [...rows()].sort(
      (a, b) =>
        Number(b.current) - Number(a.current) || b.last_active - a.last_active,
    ),
  )

  const device = (s: Session) => {
    const d = describeUA(s.ua)
    return d.browser || d.os
      ? [d.browser, d.os].filter(Boolean).join(" / ")
      : s.ua || t("users.sessions.unknown_device")
  }
  const user = (s: Session) =>
    s.user_id === undefined ? "" : (names()[s.user_id] ?? `#${s.user_id}`)

  const eviction = createDeleteConfirm<Session>({
    name: device,
    description: (s) =>
      s.current
        ? t("users.sessions.evict_current_confirm")
        : t("users.sessions.evict_confirm", { name: device(s) }),
    run: async (s) => {
      // A current session ends through the user's own endpoint in both views:
      // it is a logout, whoever is looking.
      const path =
        props.admin && !s.current
          ? "/admin/session/evict"
          : "/me/sessions/evict"
      const resp: Awaited<PEmptyResp> = await r.post(path, {
        session_id: s.session_id,
      })
      handleResp(
        resp,
        () => {
          if (s.current) {
            changeToken()
            notify.success(t("manage.logout_success"))
            to(loginUrlFor(location))
            return
          }
          notify.success(t("users.sessions.evicted"))
          refresh()
        },
        () => refresh(),
      )
    },
  })

  const currentBadge = (s: Session) =>
    s.current ? (
      <Badge variant="secondary" class="ml-2">
        {t("users.sessions.current")}
      </Badge>
    ) : null

  return (
    <>
      <ResourceList
        title={t(
          props.admin
            ? "users.sessions.admin_heading"
            : "users.sessions.heading",
        )}
        description={t("users.sessions.description")}
        rows={sorted()}
        rowKey={(s) => s.session_id}
        loading={loading()}
        error={error()}
        onRefresh={refresh}
        emptyText={t("users.sessions.empty")}
        columns={[
          {
            id: "device",
            header: t("users.sessions.device"),
            cell: (s) => (
              <span title={s.ua}>
                <span class="font-medium">{device(s)}</span>
                {currentBadge(s)}
              </span>
            ),
          },
          ...(props.admin
            ? [
                {
                  id: "user",
                  header: t("users.sessions.user"),
                  cell: (s: Session) => user(s),
                  sort: user,
                },
              ]
            : []),
          {
            id: "ip",
            header: t("users.sessions.ip"),
            cell: (s) => <span class="font-mono text-xs">{s.ip}</span>,
          },
          {
            id: "last_active",
            header: t("users.sessions.last_active"),
            cell: (s) => at(s.last_active),
            sort: (s) => s.last_active,
          },
          {
            id: "created_at",
            header: t("users.sessions.created_at"),
            cell: (s) => at(s.created_at),
            sort: (s) => s.created_at,
          },
        ]}
        card={{
          title: (s) => (
            <span>
              {device(s)}
              {currentBadge(s)}
            </span>
          ),
          body: (s) => (
            <div class="flex flex-col gap-1">
              {props.admin ? <span>{user(s)}</span> : null}
              <span class="font-mono text-xs">{s.ip}</span>
              <span>{at(s.last_active)}</span>
            </div>
          ),
        }}
        actions={(s) => [
          {
            id: "evict",
            label: t(
              s.current
                ? "users.sessions.sign_out_here"
                : "users.sessions.evict",
            ),
            destructive: true,
            onSelect: eviction.ask,
          },
        ]}
      />
      {eviction.dialog()}
    </>
  )
}
