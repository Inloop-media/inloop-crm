import "server-only";
import { cookies } from "next/headers";

/** "light" (default) or "dark", picked with the theme switch and kept in a cookie. */
export async function getTheme() {
  return (await cookies()).get("crm_theme")?.value === "dark" ? "dark" : "light";
}

export const THEME_COLOR = { light: "#ecebf6", dark: "#0c0b12" };
