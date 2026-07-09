import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn-style helper: merge conditional class lists and resolve conflicting
// Tailwind utility classes (e.g. "p-2 p-4" -> "p-4") so component variants can be composed
// without manually tracking which utility wins.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
