import { NextResponse } from "next/server";
import { uploadReport } from "@/lib/blob";
import {
  detectEnvFromFilename,
  isReportEnv,
  MAX_UPLOAD_BYTES,
  type ReportEnv,
} from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN is not configured" },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".html")) {
    return NextResponse.json({ error: "Only .html files are allowed" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit` },
      { status: 400 },
    );
  }

  const envField = String(form.get("env") ?? "");
  let env: ReportEnv | null = isReportEnv(envField) ? envField : null;
  if (!env) {
    env = detectEnvFromFilename(file.name);
  }
  if (!env) {
    return NextResponse.json(
      { error: "Could not determine environment; pass env=TST or env=DEV" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadReport({
    env,
    filename: file.name,
    body: buffer,
    contentType: "text/html; charset=utf-8",
  });

  return NextResponse.json({
    env,
    ...result,
  });
}
