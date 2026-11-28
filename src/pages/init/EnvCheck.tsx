import { Accessor, createSignal, For, JSX, Show } from "solid-js"
import { useT } from "~/hooks"
import { EnvCheck as EnvCheckData, EnvCheckIssue, Resp } from "~/types"
import { r } from "~/utils"
import { Badge } from "~/components/ui/badge"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/utils/cn"

/** 各平台部署教程：对照绑定存储驱动 */
const DEPLOY_DOCS = [
  {
    label: "CF Worker",
    url: "https://doc.oplist.org/ecosystem/official_worker/guide_cfw",
  },
  {
    label: "EdgeOne",
    url: "https://doc.oplist.org/ecosystem/official_worker/guide_eom",
  },
  {
    label: "ESA",
    url: "https://doc.oplist.org/ecosystem/official_worker/guide_esa",
  },
]

/** 拿不到自检结果时各项的占位符 */
const UNKNOWN = "-"

/**
 * 环境自检状态（仅 TS Worker 后端提供 /public/env_check）。
 *
 * Go 后端用 MySQL/SQLite 自带持久化，既没有该接口，也不存在「先修配置才能
 * 初始化」的场景，故由调用方决定是否调用。
 */
export const useEnvCheck = () => {
  const [check, setCheck] = createSignal<EnvCheckData>()
  /**
   * 初值为 true：表示「尚未探测」。
   *
   * 若初值为 false，调用方的 createEffect 会在首帧看到「探测已完成且不支持」
   * 而误判为 Go 后端，把用户从自检步骤直接推进到账号步（步骤闪烁）。
   * 在 refresh() 真正开始前保持 loading，可避免这个瞬时误判。
   */
  const [loading, setLoading] = createSignal(true)
  /**
   * 该后端是否提供环境自检能力。
   *
   * 不复用 isTsWorker()：它依赖 /public/settings 的 backend 字段，而存储
   * 未绑定时该接口被 503 拦截，导致判定停留在默认的 Go 后端，环境自检步骤
   * 整步不渲染——恰恰是最需要自检的场景。
   *
   * /public/env_check 是 TS Worker 独有接口（Go 后端未注册该路由），因此
   * 「能否取到它」本身就是可靠的后端能力探测，且不受 settings 失败影响。
   */
  const [supported, setSupported] = createSignal(false)
  /** 接口本身未返回可用结果（网络异常、超时或服务端 5xx） */
  const [failed, setFailed] = createSignal(false)

  const refresh = async () => {
    setLoading(true)
    setFailed(false)
    try {
      const resp = (await r.get("/public/env_check")) as Resp<EnvCheckData>
      if (resp?.code === 200 && resp.data) {
        setSupported(true)
        setCheck(resp.data)
      } else {
        // 非 200：Go 后端没有该接口（未注册路由，通常 404），
        // 或拿不到各项状态。此时不展示自检步骤，交由后端自行校验。
        setCheck(undefined)
        setFailed(true)
      }
    } catch {
      setCheck(undefined)
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }

  /** 环境是否允许继续：ready 为真才放行 */
  const ready = () => Boolean(check()?.ready)

  return { check, loading, failed, supported, refresh, ready }
}

/** 解析值：与配置值不同时以 `配置值 → 解析值` 展示 */
const Resolved = (props: { raw?: string | null; actual?: string | null }) => (
  <>
    {props.raw || UNKNOWN}
    <Show when={props.actual && props.actual !== props.raw}>
      {" → " + props.actual}
    </Show>
  </>
)

/** 一行「标签 —— 值」；传 ok 时按状态着色，否则用等宽字体 */
const Row = (props: { label: string; ok?: boolean; children: JSX.Element }) => (
  <div class="flex flex-row items-center text-xs">
    <p class="text-muted-foreground">{props.label}</p>
    <div class="flex-1 self-stretch" />
    <p
      class={cn(
        props.ok === undefined && "font-mono",
        props.ok === true && "text-success",
        props.ok === false && "text-destructive",
      )}
    >
      {props.children}
    </p>
  </div>
)

/**
 * 环境自检面板（纯展示）。
 *
 * 状态由 useEnvCheck 提供，调用方据此判断能否进入下一步。
 */
const EnvCheck = (props: {
  check: Accessor<EnvCheckData | undefined>
  loading: Accessor<boolean>
  failed: Accessor<boolean>
}) => {
  const t = useT()
  const status = (ok?: boolean) =>
    ok ? t("init.env_status_ok") : t("init.env_status_bad")

  return (
    <div class="flex flex-col w-full p-3 rounded-md bg-muted items-stretch gap-y-2">
      <div class="flex flex-row items-center">
        <p class="text-sm font-medium">{t("init.env_check")}</p>
        <div class="flex-1 self-stretch" />
        <Show when={props.loading()}>
          <Spinner size="xs" />
        </Show>
        <Show when={!props.loading() && (props.check() || props.failed())}>
          <Badge variant={props.check()?.ready ? "success" : "danger"}>
            {props.check()?.ready
              ? t("init.env_check_ready")
              : t("init.env_check_not_ready")}
          </Badge>
        </Show>
      </div>

      {/* 骨架始终渲染：接口不可用时各行显示占位符，让用户看到检查了哪些项 */}
      <Show when={props.check() || (!props.loading() && props.failed())}>
        <div class="flex flex-col items-stretch gap-y-1">
          <Row label={t("init.env_format")}>
            <Resolved
              raw={props.check()?.config.db_format}
              actual={props.check()?.config.resolved_format}
            />
          </Row>
          <Row label={t("init.env_driver")}>
            <Resolved
              raw={props.check()?.config.db_driver}
              actual={props.check()?.config.resolved_driver}
            />
          </Row>
          <Row label={t("init.env_runtime")}>
            {props.check()
              ? props.check()?.runtime.serverless
                ? t("init.env_serverless")
                : t("init.env_local")
              : UNKNOWN}
          </Row>
          <Row
            label={t("init.env_storage")}
            ok={props.check()?.storage.available}
          >
            {status(props.check()?.storage.available)}
          </Row>
          <Row label={t("init.env_jwt")} ok={props.check()?.jwt.ready}>
            {status(props.check()?.jwt.ready)}
          </Row>
        </div>
      </Show>

      {/* 问题清单：原因 + 怎么改 + 文档链接 */}
      <For each={props.check()?.issues ?? []}>
        {(issue: EnvCheckIssue) => (
          <div
            class="flex flex-col items-stretch gap-y-1 rounded-sm p-2"
            classList={{
              "bg-destructive/10": issue.level === "error",
              "bg-warning/10": issue.level !== "error",
            }}
          >
            {/* 只展示一行短原因：后端 message 是给排查用的多行长文，
                界面上会变成「半句 + 省略号」，读不懂 */}
            <p class="text-xs text-foreground">
              {issue.summary || issue.message}
            </p>
            {/* 「怎么改」必须单独成段并置顶于文档链接之前：原因常是多行说明，
                用户真正需要的是下一步动作，混在长文本里容易被忽略或截断 */}
            <Show when={issue.suggestion}>
              <p class="text-xs font-medium text-foreground">
                {t("init.env_fix_title")}
              </p>
              <p class="text-xs text-foreground">{issue.suggestion}</p>
            </Show>
            <a
              class="text-xs text-primary underline"
              href={issue.docUrl}
              target="_blank"
              rel="noopener"
            >
              {t("init.env_doc_link")}
            </a>
          </div>
        )}
      </For>

      <Show when={props.check() && !props.check()?.ready}>
        <p class="text-xs text-destructive">{t("init.env_blocked_tip")}</p>
      </Show>

      {/* 部署教程：按平台直达，方便用户对照绑定存储 */}
      <div class="flex flex-row items-center pt-1 flex-wrap gap-x-3">
        <p class="text-xs text-muted-foreground">{t("init.env_deploy_docs")}</p>
        <For each={DEPLOY_DOCS}>
          {(doc) => (
            <a
              class="text-xs text-primary underline"
              href={doc.url}
              target="_blank"
              rel="noopener"
            >
              {doc.label}
            </a>
          )}
        </For>
      </div>
    </div>
  )
}

export default EnvCheck
