import { getReportHtml } from "@/lib/blob";
import { viewerPathToBlobPath } from "@/lib/env";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { path } = await params;
  const blobPath = viewerPathToBlobPath(path);
  if (!blobPath) {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return new Response("BLOB_READ_WRITE_TOKEN is not configured", {
      status: 500,
      headers: { "content-type": "text/plain" },
    });
  }

  const report = await getReportHtml(blobPath);
  if (!report) {
    return new Response("Report not found", {
      status: 404,
      headers: { "content-type": "text/plain" },
    });
  }

  return new Response(report.body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
