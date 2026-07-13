export const ENVS = ["TST", "DEV"] as const;

export type ReportEnv = (typeof ENVS)[number];

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export function isReportEnv(value: string): value is ReportEnv {
  return (ENVS as readonly string[]).includes(value);
}

/** Guess env from filename like latest-TST.html or live-DEV-....html */
export function detectEnvFromFilename(filename: string): ReportEnv | null {
  const upper = filename.toUpperCase();
  for (const env of ENVS) {
    if (
      upper.includes(`-${env}.`) ||
      upper.includes(`-${env}-`) ||
      upper.includes(`_${env}.`) ||
      upper.includes(`_${env}_`) ||
      upper.startsWith(`${env}-`) ||
      upper.startsWith(`${env}_`) ||
      upper.includes(`LATEST-${env}`)
    ) {
      return env;
    }
  }
  return null;
}

export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "report.html";
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const withExt = cleaned.toLowerCase().endsWith(".html")
    ? cleaned
    : `${cleaned || "report"}.html`;
  return withExt.slice(0, 180);
}

export function toIsoFilenameStamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function blobPrefix(env: ReportEnv): string {
  return `reports/${env}/`;
}

export function timestampedBlobPath(env: ReportEnv, filename: string, date = new Date()): string {
  return `${blobPrefix(env)}${toIsoFilenameStamp(date)}-${sanitizeFilename(filename)}`;
}

export function latestBlobPath(env: ReportEnv): string {
  return `${blobPrefix(env)}latest.html`;
}

/** Map /r/TST/latest → reports/TST/latest.html */
export function viewerPathToBlobPath(segments: string[]): string | null {
  if (segments.length < 2) return null;
  const [env, ...rest] = segments;
  if (!isReportEnv(env)) return null;
  if (rest.some((s) => s === ".." || s === "." || s.includes("\\"))) return null;

  if (rest.length === 1 && rest[0] === "latest") {
    return latestBlobPath(env);
  }

  const joined = rest.join("/");
  if (!joined.toLowerCase().endsWith(".html")) return null;
  return `${blobPrefix(env)}${joined}`;
}

export function blobPathToSharePath(pathname: string): string | null {
  const match = pathname.match(/^reports\/(TST|DEV)\/(.+)$/);
  if (!match) return null;
  const [, env, file] = match;
  if (file === "latest.html") return `/r/${env}/latest`;
  return `/r/${env}/${file}`;
}
