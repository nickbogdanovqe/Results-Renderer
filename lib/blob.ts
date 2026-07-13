import { list, put, head, del } from "@vercel/blob";
import type { ReportEnv } from "./env";
import { blobPrefix, blobPathToSharePath, latestBlobPath, timestampedBlobPath } from "./env";


export type ReportItem = {
  pathname: string;
  url: string;
  uploadedAt: string;
  size: number;
  sharePath: string;
  label: string;
  isLatest: boolean;
};

/** Prefer RESULTS_* (custom Blob prefix) then default BLOB_READ_WRITE_TOKEN. */
export function getBlobToken(): string | undefined {
  return process.env.RESULTS_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
}

function tokenOptions() {
  const token = getBlobToken();
  return token ? { token } : {};
}

export async function uploadReport(params: {
  env: ReportEnv;
  filename: string;
  body: ArrayBuffer | Blob | Buffer | string;
  contentType?: string;
}): Promise<{ pathname: string; url: string; sharePath: string; latestSharePath: string }> {
  const pathname = timestampedBlobPath(params.env, params.filename);
  const uploaded = await put(pathname, params.body, {
    access: "public",
    contentType: params.contentType ?? "text/html; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: false,
    ...tokenOptions(),
  });

  await put(latestBlobPath(params.env), params.body, {
    access: "public",
    contentType: params.contentType ?? "text/html; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: true,
    ...tokenOptions(),
  });

  const sharePath = blobPathToSharePath(uploaded.pathname) ?? `/r/${params.env}/latest`;
  return {
    pathname: uploaded.pathname,
    url: uploaded.url,
    sharePath,
    latestSharePath: `/r/${params.env}/latest`,
  };
}

export async function listReports(env: ReportEnv): Promise<ReportItem[]> {
  const prefix = blobPrefix(env);
  const result = await list({ prefix, ...tokenOptions() });
  const items: ReportItem[] = result.blobs
    .filter((b) => b.pathname.toLowerCase().endsWith(".html"))
    .map((b) => {
      const file = b.pathname.slice(prefix.length);
      const isLatest = file === "latest.html";
      return {
        pathname: b.pathname,
        url: b.url,
        uploadedAt: b.uploadedAt.toISOString(),
        size: b.size,
        sharePath: blobPathToSharePath(b.pathname) ?? `/r/${env}/latest`,
        label: isLatest ? "latest.html" : file,
        isLatest,
      };
    });

  items.sort((a, b) => {
    if (a.isLatest !== b.isLatest) return a.isLatest ? -1 : 1;
    return b.uploadedAt.localeCompare(a.uploadedAt);
  });

  return items;
}

export async function getReportHtml(pathname: string): Promise<{
  body: string;
  contentType: string;
} | null> {
  let url: string;
  try {
    const meta = await head(pathname, tokenOptions());
    url = meta.url;
  } catch {
    return null;
  }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const body = await res.text();
  return {
    body,
    contentType: res.headers.get("content-type") ?? "text/html; charset=utf-8",
  };
}

/** Path must be reports/{TST|DEV}/....html with no traversal. */
export function isDeletableReportPath(pathname: string): boolean {
  if (!pathname || pathname.includes("..") || pathname.includes("\\")) return false;
  return /^reports\/(TST|DEV)\/[^/]+\.html$/i.test(pathname);
}

export async function deleteReport(pathname: string): Promise<void> {
  if (!isDeletableReportPath(pathname)) {
    throw new Error("Invalid report pathname");
  }
  await del(pathname, tokenOptions());
}
