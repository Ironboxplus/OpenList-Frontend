import CommonSettings from "../settings/Common"
import { useManageTitle } from "~/hooks"
import { Group } from "~/types"
import { Sessions } from "./Sessions"

/** The device limit settings above the list of everyone's signed-in devices. */
const DEVICE_KEYS = ["max_devices", "device_evict_policy", "device_session_ttl"]

const SessionsPage = () => {
  useManageTitle("manage.sidemenu.sessions")
  return (
    <div class="flex w-full flex-col gap-4">
      <CommonSettings group={Group.GLOBAL} keys={DEVICE_KEYS} />
      <Sessions admin />
    </div>
  )
}

export default SessionsPage
