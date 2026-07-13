import { list, put, head } from "@vercel/blob";
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
  });

  await put(latestBlobPath(params.env), params.body, {
    access: "public",
    contentType: params.contentType ?? "text/html; charset=utf-8",
    addRandomSuffix: false,
    allowOverwrite: true,
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
  const result = await list({ prefix });
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
    const meta = await head(pathname);
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
