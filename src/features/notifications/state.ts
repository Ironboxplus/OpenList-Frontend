import { createSignal } from "solid-js"

/** Whether the error center sheet is open; the bell button and the phone "me" panel open it. */
export const [errorCenterOpen, setErrorCenterOpen] = createSignal(false)
