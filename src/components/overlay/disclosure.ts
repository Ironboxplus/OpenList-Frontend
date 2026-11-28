import { createSignal, createUniqueId } from "solid-js"

export interface CreateDisclosureProps {
  defaultIsOpen?: boolean
  /** Controlled: the caller owns the state. */
  isOpen?: boolean
  onOpen?: () => void
  onClose?: () => void
}

/**
 * hope-ui's createDisclosure, value for value (hope-ui 0.6.8,
 * dist/index.mjs 15098-15137), so its 31 callers keep working unchanged.
 */
export function createDisclosure(props: CreateDisclosureProps = {}) {
  const id = `disclosure-${createUniqueId()}`
  const [isOpenState, setIsOpenState] = createSignal(
    props.defaultIsOpen || false,
  )
  const isControlled = () => props.isOpen !== undefined
  const isOpen = () => (isControlled() ? !!props.isOpen : isOpenState())
  const onClose = () => {
    if (!isControlled()) setIsOpenState(false)
    props.onClose?.()
  }
  const onOpen = () => {
    if (!isControlled()) setIsOpenState(true)
    props.onOpen?.()
  }
  const onToggle = () => (isOpen() ? onClose() : onOpen())
  const triggerProps = () => ({
    "aria-expanded": isOpen(),
    "aria-controls": id,
  })
  const disclosureProps = () => ({ id, hidden: !isOpen() })
  return {
    isControlled,
    isOpen,
    onOpen,
    onClose,
    onToggle,
    triggerProps,
    disclosureProps,
  }
}
