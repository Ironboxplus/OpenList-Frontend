import { useRouter, useT } from "~/hooks"
import { JSXElement } from "solid-js"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"

type PasswordProps = {
  title: string
  password: () => string
  setPassword: (s: string) => void
  enterCallback: () => void
  children?: JSXElement
}

const Password = (props: PasswordProps) => {
  const t = useT()
  const { back } = useRouter()
  return (
    <div class="flex flex-col p-8 items-start gap-y-3 w-full md:w-lg">
      <h2 class="font-semibold">{props.title}</h2>
      <Input
        autofocus={true}
        type="password"
        value={props.password()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            props.enterCallback()
          }
        }}
        onInput={(e) => props.setPassword(e.currentTarget.value)}
      />
      <div class="flex flex-row items-center w-full justify-between">
        <div class="flex text-sm text-muted-foreground gap-x-1 flex-col sm:flex-row">
          {props.children}
        </div>
        <div class="flex flex-row items-center gap-x-2">
          <Button variant="secondary" onClick={back}>
            {t("global.back")}
          </Button>
          <Button variant="subtle" onClick={() => props.enterCallback()}>
            {t("global.ok")}
          </Button>
        </div>
      </div>
    </div>
  )
}
export default Password
