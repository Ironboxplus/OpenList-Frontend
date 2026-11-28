import { createSignal } from "solid-js"
import { useT } from "~/hooks"
import { objStore } from "~/store"
import { FileInfo } from "./info"
import { Button } from "~/components/ui/button"

const Plist = () => {
  const t = useT()
  const [installing, setInstalling] = createSignal(false)
  return (
    <FileInfo>
      <Button
        as="a"
        variant="subtle"
        href={
          "itms-services://?action=download-manifest&url=" + objStore.raw_url
        }
        onClick={() => {
          setInstalling(true)
        }}
      >
        {t(`home.preview.${installing() ? "installing" : "install"}`)}
      </Button>
    </FileInfo>
  )
}

export default Plist
