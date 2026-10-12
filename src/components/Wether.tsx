import { Badge } from "~/components/ui/badge"
import { useT } from "~/hooks"

export interface WetherProps {
  yes?: boolean
}

export const Wether = (props: WetherProps) => {
  const t = useT()
  return (
    <Badge variant={props.yes ? "success" : "destructive"}>
      {t(`global.${props.yes ? "yes" : "no"}`)}
    </Badge>
  )
}
