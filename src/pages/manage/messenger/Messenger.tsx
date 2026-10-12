import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Component, createSignal, For, onCleanup } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { Dynamic } from "solid-js/web"
import { useFetch, useT } from "~/hooks"
import { PEmptyResp, PResp } from "~/types"
import {
  handleRespWithNotifySuccess,
  handleRespWithoutNotify,
  notify,
  r,
} from "~/utils"
import { StringShow, ImageShow } from "./Show"

export interface Message {
  type: string
  content: any
}

export const Shower: Record<string, Component<Message>> = {
  string: StringShow,
  image: ImageShow,
}

export const Messenger = () => {
  const t = useT()
  notify.info(t("manage.messenger-tips"))
  const [toSend, setToSend] = createSignal("")
  const [getLoading, getR] = useFetch((): PResp<Message> =>
    r.post("/admin/message/get"),
  )
  const [sendLoading, sendR] = useFetch((): PEmptyResp =>
    r.post("/admin/message/send", {
      message: toSend(),
    }),
  )
  const [received, setReceived] = createStore<Message[]>([])
  const get = async () => {
    const resp = await getR()
    handleRespWithoutNotify(resp, (msg) => {
      setReceived(produce((msgs) => msgs.push(msg)))
    })
  }
  const send = async () => {
    const resp = await sendR()
    handleRespWithNotifySuccess(resp)
  }
  const getInterval = setInterval(get, 1000)
  onCleanup(() => clearInterval(getInterval))
  return (
    <div class="flex w-full flex-col gap-3">
      <Card class="flex flex-col gap-2 p-4">
        <h2 class="text-base font-semibold">{t("manage.received_msgs")}</h2>
        <For each={received}>
          {(item) => <Dynamic component={Shower[item.type]} {...item} />}
        </For>
      </Card>
      <Input
        value={toSend()}
        onInput={(e) => setToSend(e.currentTarget.value)}
      />
      <div class="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={getLoading()}
          onClick={get}
        >
          {t("manage.receive")}
        </Button>
        <Button type="button" disabled={sendLoading()} onClick={send}>
          {t("manage.send")}
        </Button>
      </div>
    </div>
  )
}

export default Messenger
