import { createSignal } from "solid-js"

/** Whether the Task Center drawer is open; the TopBar button toggles it. */
export const [taskCenterOpen, setTaskCenterOpen] = createSignal(false)
