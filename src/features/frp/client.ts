import { r } from "~/utils"
import type {
  FrpSaveReq,
  FrpSaveResp,
  FrpStatus,
  FrpView,
  PResp,
} from "~/types"

export const frpGet = (): PResp<FrpView> => r.get("/admin/frp")
export const frpSave = (req: FrpSaveReq): PResp<FrpSaveResp> =>
  r.post("/admin/frp", req)
export const frpStart = (): PResp<FrpSaveResp> => r.post("/admin/frp/start")
export const frpStop = (): PResp<FrpSaveResp> => r.post("/admin/frp/stop")
export const frpStatus = (): PResp<FrpStatus> => r.get("/admin/frp/status")
export const frpRuntime = (limit = 200): PResp<{ lines: string[] }> =>
  r.get(`/admin/frp/runtime?limit=${limit}`)
