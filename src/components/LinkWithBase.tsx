import { Link } from "@solidjs/router"
import { joinBase, encodePath } from "~/utils"
import { useRouter } from "~/hooks"
import { ComponentProps } from "solid-js"
import { cn } from "~/utils/cn"

export const LinkWithBase = (
  props: ComponentProps<typeof Link> & { encode?: boolean },
) => (
  <Link
    {...props}
    href={joinBase(props.encode ? encodePath(props.href) : props.href)}
  />
)

/** A link with hope's Anchor look (our theme: rounded, padded, a grey hover). */
export const AnchorWithBase = (
  props: ComponentProps<typeof Link> & { cancelBase?: boolean },
) => (
  <Link
    {...props}
    class={cn(
      "relative cursor-pointer rounded-lg px-1.5 py-1 no-underline outline-none transition-[text-decoration] hover:bg-[rgba(132,133,141,0.18)] active:scale-95",
      props.class,
    )}
    href={props.cancelBase ? props.href : joinBase(props.href)}
  />
)

export const LinkWithPush = (props: ComponentProps<typeof LinkWithBase>) => {
  const { pushHref } = useRouter()
  return <LinkWithBase {...props} href={pushHref(props.href)} />
}
