import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// As utilidades tipográficas do design system (type-h1, type-body...) definem tamanho de fonte,
// então precisam conflitar entre si no merge.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "type-display",
        "type-h1",
        "type-h2",
        "type-h3",
        "type-body-lg",
        "type-body",
        "type-small",
        "type-caption",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
