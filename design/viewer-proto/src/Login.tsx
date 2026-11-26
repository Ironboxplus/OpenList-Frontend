// Sign-in for looking at the prototype against one's own OpenList. The same
// request as the app's login page (src/pages/login/index.tsx): POST
// /auth/login/hash with the password through hashPwd, a second step when the
// server answers 402 (two-factor code), and the token kept by changeToken.
import { Show, createSignal } from "solid-js"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import type { Resp } from "~/types"
import { changeToken, hashPwd, r } from "~/utils"
import { signedIn } from "./state"

export const Login = () => {
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [otp, setOtp] = createSignal("")
  const [needOtp, setNeedOtp] = createSignal(false)
  const [error, setError] = createSignal("")
  const [busy, setBusy] = createSignal(false)

  const submit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (busy()) return
    setBusy(true)
    setError("")
    const resp = (await r.post("/auth/login/hash", {
      username: username(),
      password: hashPwd(password()),
      otp_code: otp(),
    })) as Resp<{ token: string }>
    setBusy(false)
    if (resp.code === 200) {
      changeToken(resp.data.token)
      setPassword("")
      signedIn()
    } else if (resp.code === 402 && !needOtp()) {
      setNeedOtp(true)
    } else {
      setError(resp.message || "登录失败")
    }
  }

  return (
    <div class="flex min-h-[calc(100dvh-var(--proto-bar))] w-full items-center justify-center p-4">
      <form
        data-testid="login"
        class="grid w-full max-w-xs gap-3 rounded-xl border bg-background p-6 text-foreground shadow-lg"
        onSubmit={submit}
      >
        <h1 class="text-base font-semibold">登录</h1>
        <Input
          name="username"
          autocomplete="username"
          placeholder="用户名"
          aria-label="用户名"
          required
          value={username()}
          onInput={(e) => setUsername(e.currentTarget.value)}
        />
        <Input
          name="password"
          type="password"
          autocomplete="current-password"
          placeholder="密码"
          aria-label="密码"
          required
          value={password()}
          onInput={(e) => setPassword(e.currentTarget.value)}
        />
        <Show when={needOtp()}>
          <Input
            name="otp"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="两步验证码"
            aria-label="两步验证码"
            value={otp()}
            onInput={(e) => setOtp(e.currentTarget.value)}
          />
        </Show>
        <Show when={error()}>
          <div class="text-sm text-destructive" role="alert">
            {error()}
          </div>
        </Show>
        <Button type="submit" disabled={busy()}>
          登录
        </Button>
      </form>
    </div>
  )
}
