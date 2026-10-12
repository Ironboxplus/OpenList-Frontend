import { TbPlus } from "solid-icons/tb"
import { createSignal } from "solid-js"
import { Badge } from "~/components/ui/badge"
import {
  createDeleteConfirm,
  ResourceList,
  StatusBadge,
  type RowAction,
  type StatusTone,
} from "~/features/settings/form"
import { useFetch, useManageTitle, useRouter, useT, useUtil } from "~/hooks"
import { getSetting, me } from "~/store"
import {
  PageResp,
  PEmptyResp,
  ShareInfo,
  UserMethods,
  UserPermissions,
} from "~/types"
import {
  handleResp,
  handleRespWithNotifySuccess,
  makeTemplateData,
  matchTemplate,
  notify,
  r,
} from "~/utils"

const STATUS_TONE: Record<string, StatusTone> = {
  work: "success",
  disabled: "neutral",
  invalid: "error",
  denied: "warning",
}

const CREATOR_VARIANT = ["secondary", "outline", "default"] as const

const Shares = () => {
  const t = useT()
  useManageTitle("manage.sidemenu.shares")
  const { to } = useRouter()
  const { copy } = useUtil()
  const [loading, fetchList] = useFetch(
    (): Promise<PageResp<ShareInfo>> => r.get("/share/list"),
    true,
  )
  const [shares, setShares] = createSignal<ShareInfo[]>([])
  const [error, setError] = createSignal<string>()
  const refresh = async () => {
    handleResp(
      await fetchList(),
      (data) => {
        setError(undefined)
        setShares(data.content)
      },
      setError,
    )
  }
  refresh()

  const canShare = () => UserMethods.can(me(), UserPermissions.indexOf("share"))
  const isAdmin = () => UserMethods.is_admin(me())

  const filesText = (s: ShareInfo) => {
    if (s.files.length === 0) return ""
    return s.files.length > 1
      ? s.files[0] + t("shares.files_etc", { more: s.files.length - 1 })
      : s.files[0]
  }
  const accessedText = (s: ShareInfo) =>
    s.max_accessed > 0 ? `${s.accessed} / ${s.max_accessed}` : `${s.accessed}`
  const expiresText = (s: ShareInfo) =>
    s.expires ? new Date(s.expires).toLocaleString() : ""
  const status = (s: ShareInfo) => {
    if (s.disabled) return "disabled"
    if (
      (s.max_accessed > 0 && s.accessed >= s.max_accessed) ||
      s.files.length === 0 ||
      (s.expires && new Date(s.expires) < new Date())
    )
      return "invalid"
    if (s.creator === me().username && !canShare()) return "denied"
    return "work"
  }
  const StatusChip = (props: { share: ShareInfo }) => (
    <StatusBadge
      tone={STATUS_TONE[status(props.share)]}
      label={t(`shares.status_list.${status(props.share)}`)}
    />
  )
  const Creator = (props: { share: ShareInfo }) =>
    props.share.creator_role < 0 ? null : (
      <Badge variant={CREATOR_VARIANT[props.share.creator_role]}>
        {props.share.creator}
      </Badge>
    )

  const copyMessage = (s: ShareInfo) => {
    const data = makeTemplateData(s, { site_title: getSetting("site_title") })
    copy(matchTemplate(getSetting("share_summary_content"), data))
  }
  const toggleDisabled = async (s: ShareInfo) => {
    const resp: Awaited<PEmptyResp> = await r.post(
      `/share/${s.disabled ? "enable" : "disable"}?id=${s.id}`,
    )
    handleRespWithNotifySuccess(resp, refresh)
  }
  const removal = createDeleteConfirm<ShareInfo>({
    name: (s) => s.id,
    run: async (s) => {
      const resp: Awaited<PEmptyResp> = await r.post(`/share/delete?id=${s.id}`)
      handleResp(resp, () => {
        notify.success(t("global.delete_success"))
        refresh()
      })
    },
  })

  const actions = (s: ShareInfo): RowAction<ShareInfo>[] => [
    { id: "copy", label: t("shares.copy_msg"), onSelect: copyMessage },
    {
      id: "toggle",
      label: t(`global.${s.disabled ? "enable" : "disable"}`),
      onSelect: toggleDisabled,
    },
    {
      id: "delete",
      label: t("global.delete"),
      destructive: true,
      onSelect: removal.ask,
    },
  ]

  return (
    <>
      <ResourceList
        rows={shares()}
        rowKey={(s) => s.id}
        loading={loading()}
        error={error()}
        onRefresh={refresh}
        toolbarActions={[
          {
            id: "add",
            label: t("global.add"),
            icon: <TbPlus class="mr-1.5 size-4" />,
            disabled: !canShare(),
            hint: t("shares.no_permission_tip"),
            onSelect: () => to("/@manage/shares/add"),
          },
        ]}
        columns={[
          {
            id: "files",
            header: t("shares.files"),
            cell: (s) => <span class="break-all">{filesText(s)}</span>,
          },
          {
            id: "id",
            header: t("shares.id"),
            cell: (s) => <span class="break-all font-mono">{s.id}</span>,
            sort: (s) => s.id,
          },
          ...(isAdmin()
            ? [
                {
                  id: "creator",
                  header: t("shares.creator"),
                  cell: (s: ShareInfo) => <Creator share={s} />,
                  sort: (s: ShareInfo) => s.creator,
                },
              ]
            : []),
          {
            id: "expires",
            header: t("shares.expires"),
            cell: (s) => expiresText(s),
            sort: (s) => s.expires ?? "",
          },
          {
            id: "accessed",
            header: t("shares.accessed"),
            cell: (s) => accessedText(s),
            sort: (s) => s.accessed,
          },
          {
            id: "status",
            header: t("shares.status"),
            cell: (s) => <StatusChip share={s} />,
          },
          {
            id: "remark",
            header: t("shares.remark"),
            cell: (s) => <span class="break-all">{s.remark}</span>,
          },
        ]}
        card={{
          title: (s) => <span class="break-all">{filesText(s)}</span>,
          badges: (s) => <StatusChip share={s} />,
          body: (s) => (
            <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt class="text-muted-foreground">{t("shares.id")}</dt>
              <dd class="break-all font-mono">{s.id}</dd>
              <dt class="text-muted-foreground">{t("shares.accessed")}</dt>
              <dd>{accessedText(s)}</dd>
              {s.expires ? (
                <>
                  <dt class="text-muted-foreground">{t("shares.expires")}</dt>
                  <dd>{expiresText(s)}</dd>
                </>
              ) : null}
            </dl>
          ),
        }}
        primary={(s) => ({
          id: "edit",
          label: t("global.edit"),
          disabled: !canShare(),
          onSelect: () => to(`/@manage/shares/edit/${s.id}`),
        })}
        actions={actions}
      />
      {removal.dialog()}
    </>
  )
}

export default Shares
