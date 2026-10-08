/**
 * Focus styling for controls we write by hand. There is no Tailwind preflight,
 * so the browser/hope-ui outline would otherwise show up after a mouse click;
 * keep it for keyboard focus only, as a ring.
 */
export const focusRing =
  "outline-none! focus-visible:ring-[1.5px] focus-visible:ring-ring"
