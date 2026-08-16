import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Derives a clean, shortened display name for mobile headers.
 * Strips common business category suffixes (Restaurant, Cafe, Salon, Bistro, Kitchen, Bar, etc.)
 * and limits length gracefully so it fits neatly on small viewports without clipping.
 */
export function getShortBusinessName(name?: string | null, maxChars: number = 14): string {
  if (!name || typeof name !== "string") return "";
  let trimmed = name.trim();
  if (!trimmed) return "";

  // Common business suffixes to remove on mobile
  const suffixRegex = /\s+(Restaurant|Restro|Cafe|Café|Bar|Salon|Bistro|Kitchen|Diner|Lounge|Spa|Pizzeria|Bakery|Grill|Eatery|Outlet|Express|Hotel|Dhaba|Food\s*Court|Pvt\.?\s*Ltd\.?|LLC|Inc\.?)$/i;

  // Strip trailing suffixes (loops in case of "Bistro & Cafe Restaurant" etc.)
  let previous = "";
  while (trimmed !== previous && suffixRegex.test(trimmed)) {
    previous = trimmed;
    trimmed = trimmed.replace(suffixRegex, "").trim();
  }

  // If the stripped name already fits within maxChars, return it
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  // If still longer than maxChars, take first 2-3 meaningful words if they fit, otherwise 1st word or truncate
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    // Check if 3 words with connector fit (e.g. "Fire & Flare")
    if ((words[1] === "&" || words[1].toLowerCase() === "and") && words.length >= 3) {
      const threeWords = `${words[0]} ${words[1]} ${words[2]}`;
      if (threeWords.length <= maxChars) {
        return threeWords;
      }
    }
    const twoWords = `${words[0]} ${words[1]}`;
    if (twoWords.length <= maxChars) {
      return twoWords;
    }
    if (words[0].length <= maxChars) {
      return words[0];
    }
  }

  // Truncate gracefully with ellipsis if single long word
  return `${trimmed.slice(0, maxChars - 1)}…`;
}

