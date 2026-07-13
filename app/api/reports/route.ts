import { NextResponse } from "next/server";
import { getBlobToken, listReports } from "@/lib/blob";
import { isReportEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!getBlobToken()) {
    return NextResponse.json(
      { error: "RESULTS_READ_WRITE_TOKEN or BLOB_READ_WRITE_TOKEN is not configured" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const env = searchParams.get("env") ?? "";
  if (!isReportEnv(env)) {
    return NextResponse.json({ error: "Query env must be TST or DEV" }, { status: 400 });
  }

  const reports = await listReports(env);
  return NextResponse.json({ env, reports });
}
