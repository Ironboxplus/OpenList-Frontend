import clsx, { type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// tailwind-merge cannot see the colors defined in tokens.css, so `text-foreground`
// would be mistaken for a font size and wipe out `text-sm`. Declare them.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "background",
        "foreground",
        "card",
        "card-foreground",
        "popover",
        "popover-foreground",
        "primary",
        "primary-foreground",
        "secondary",
        "secondary-foreground",
        "muted",
        "muted-foreground",
        "accent",
        "accent-foreground",
        "destructive",
        "destructive-foreground",
        "success",
        "warning",
        "border",
        "input",
        "ring",
      ],
    },
  },
})

export const cn = (...classLists: ClassValue[]) => twMerge(clsx(classLists))
