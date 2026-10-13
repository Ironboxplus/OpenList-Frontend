import {
  createEffect,
  createMemo,
  createSignal,
  JSXElement,
  on,
  Show,
  untrack,
} from "solid-js"
import { Error, FullScreenLoading } from "~/components"
import { useRouter, useT } from "~/hooks"
import { activeNavId } from "~/features/shell/nav-items"
import { Me, me, setMe } from "~/store"
import { PResp } from "~/types"
import { r, handleResp, handleRespWithoutAuthAndNotify } from "~/utils"

const GUEST: Me = {
  id: 2,
  username: "guest",
  password: "",
  base_path: "/",
  role: 1,
  disabled: false,
  permission: 0,
  sso_id: "",
  otp: false,
  allow_ldap: false,
}

const FIELDS = Object.keys(GUEST) as (keyof Me)[]

/** Same user, same rights: replacing me() with an equal object only wakes everything up for nothing. */
export const sameUser = (a: Me, b: Me): boolean =>
  FIELDS.every((k) => a[k] === b[k])

const adopt = (next: Me) => {
  if (!sameUser(untrack(me), next)) setMe(next)
}

export interface LoadMeOptions {
  /** A share page: a user who is not signed in browses it as a guest. */
  share: boolean
  /** Background revalidation: failures stay quiet (a 401 still goes to login). */
  quiet?: boolean
  onFail?: (message: string) => void
}

/**
 * The one /me request of the app and what to do with its answer. Pages that
 * need a signed-in user send a 401 to the login page; share pages fall back to
 * a guest on any failure.
 */
export const loadMe = async (
  fetchMe: () => PResp<Me>,
  { share, quiet, onFail }: LoadMeOptions,
) => {
  const resp = await fetchMe()
  if (share) {
    handleRespWithoutAuthAndNotify(resp, adopt, () => adopt(GUEST))
  } else {
    handleResp(resp, adopt, (msg) => onFail?.(msg), true, !quiet)
  }
}

const fetchMe = (): PResp<Me> => r.get("/me")

/**
 * Asks for the signed-in user once, around the whole shell. Children wait for
 * the first answer; after that moving between sections revalidates /me in the
 * background without unmounting anything, so no page change blanks the shell.
 */
export const SessionGate = (props: {
  children: JSXElement
  /** Test seam. */
  fetchMe?: () => PResp<Me>
}) => {
  const t = useT()
  const { pathname, isShare } = useRouter()
  const [ready, setReady] = createSignal(false)
  const [err, setErr] = createSignal<string>()
  const section = createMemo(
    () => `${isShare() ? "share" : "user"}:${activeNavId(pathname())}`,
  )
  let seq = 0
  createEffect(
    on(section, async () => {
      const mine = ++seq
      const first = !ready()
      await loadMe(props.fetchMe ?? fetchMe, {
        share: isShare(),
        quiet: !first,
        onFail: (msg) => mine === seq && setErr(msg),
      })
      if (mine !== seq) return
      // A 401 sends the first load to the login page; stay on the spinner.
      if (me().id !== undefined) {
        setErr(undefined)
        setReady(true)
      }
    }),
  )
  return (
    <Show
      when={ready() || err() !== undefined}
      fallback={<FullScreenLoading />}
    >
      <Show
        when={err() === undefined}
        fallback={
          <Error msg={t("home.get_current_user_failed") + err()} h="100vh" />
        }
      >
        {props.children}
      </Show>
    </Show>
  )
}
