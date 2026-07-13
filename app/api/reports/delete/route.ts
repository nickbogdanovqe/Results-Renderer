import { NextResponse } from "next/server";
import { deleteReport, getBlobToken, isDeletableReportPath } from "@/lib/blob";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  if (!getBlobToken()) {
    return NextResponse.json(
      { error: "RESULTS_READ_WRITE_TOKEN or BLOB_READ_WRITE_TOKEN is not configured" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const pathname =
    typeof body === "object" && body && "pathname" in body
      ? String((body as { pathname: unknown }).pathname ?? "")
      : "";

  if (!isDeletableReportPath(pathname)) {
    return NextResponse.json(
      { error: "pathname must be reports/{TST|DEV}/<file>.html" },
      { status: 400 },
    );
  }

  try {
    await deleteReport(pathname);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pathname });
}
