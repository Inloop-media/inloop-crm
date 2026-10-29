import "server-only";
import { cookies } from "next/headers";

/** "dark" (default) or "light", picked with the theme switch and kept in a cookie. */
export async function getTheme() {
  return (await cookies()).get("crm_theme")?.value === "light" ? "light" : "dark";
}
