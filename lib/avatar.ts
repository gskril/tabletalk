/** Only remote HTTPS profile photos may be rendered; missing/bad URLs use initials. */
export function avatarUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 4096) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}
