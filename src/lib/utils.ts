import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Theme helpers: centralize repeated CSS color-mix and box-shadow strings
export const themeColorMix = (opacity = 90) =>
  `color-mix(in srgb, var(--theme-color), transparent ${opacity}%)`;
export const themeBoxShadow = (opacity = 60) =>
  `0 0 0 1px var(--theme-color), 0 0 18px ${themeColorMix(opacity)}`;

// CSS variable constants to avoid repeating raw strings across components
export const THEME_COLOR = "var(--theme-color)";
export const TEXT_COLOR = "var(--text-color)";
export const ACTIVE_COLOR = "var(--active-color)";
export const BUTTON_BG_COLOR = "var(--button-bg-color)";
export const BUTTON_TEXT_COLOR = "var(--button-text-color)";
