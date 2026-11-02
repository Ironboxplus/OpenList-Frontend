import axios from "axios"
import { classifyAxiosError, requestPath } from "~/platform/api/classify"
import { api, log } from "."
import { getClientId } from "./client-id"

const instance = axios.create({
  baseURL: api + "/api",
  // timeout: 5000
  headers: {
    "Content-Type": "application/json;charset=utf-8",
    // 'Authorization': localStorage.getItem("admin-token") || "",
  },
  withCredentials: false,
})

instance.interceptors.request.use(
  (config) => {
    // do something before request is sent
    return config
  },
  (error) => {
    // do something with request error
    console.log("Error: " + error.message) // for debug
    return Promise.reject(error)
  },
)

// response interceptor
instance.interceptors.response.use(
  (response) => {
    const resp = response.data
    // Which request this answers, for whoever reports a failure of it.
    if (resp && typeof resp === "object") {
      resp.source = requestPath(response.config?.url)
    }
    log(resp)
    return resp
  },
  (error) => {
    // response error
    // A request the page itself superseded (usePath cancels the previous
    // fetch on every path change) is not an error worth a console line.
    if (!axios.isCancel(error)) console.error(error) // for debug
    // notificationService.show({
    //   status: "danger",
    //   title: error.code,
    //   description: error.message,
    // });
    // Keep the legacy {code, message} shape, plus the transport category so
    // handleResp can tell "the request never completed" from a business error.
    return classifyAxiosError(error)
  },
)

instance.defaults.headers.common["Authorization"] =
  localStorage.getItem("token") || ""

// Only this app's own requests carry it; WebDAV and other clients do not.
instance.defaults.headers.common["Client-Id"] = getClientId()

export const changeToken = (token?: string) => {
  instance.defaults.headers.common["Authorization"] = token ?? ""
  localStorage.setItem("token", token ?? "")
}

export { instance as r }
