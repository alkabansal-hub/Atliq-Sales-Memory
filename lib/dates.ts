export const DAY = 86_400_000;

export const toDate = (s: string) => new Date(`${s}T00:00:00Z`);

export const daysBetween = (from: string, to: string) => Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY);

export const addDays = (s: string, n: number) => new Date(toDate(s).getTime() + n * DAY).toISOString().slice(0, 10);

export const isIsoDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toDate(s).getTime());

export function fmt(s: string | null | undefined): string {
  if (!s) return "";
  return toDate(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
