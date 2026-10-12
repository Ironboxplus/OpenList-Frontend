import { Message } from "./Messenger"

export const StringShow = (props: Message) => {
  return <p class="break-all text-base font-medium">{props.content}</p>
}

export const ImageShow = (props: Message) => {
  return <img src={props.content} alt="" class="max-w-full rounded-md" />
}
