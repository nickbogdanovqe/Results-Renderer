"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ENVS, type ReportEnv } from "@/lib/env";

type ReportItem = {
  pathname: string;
  url: string;
  uploadedAt: string;
  size: number;
  sharePath: string;
  label: string;
  isLatest: boolean;
};

export default function HomePage() {
  const [env, setEnv] = useState<ReportEnv>("TST");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const loadReports = useCallback(async (selected: ReportEnv) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports?env=${selected}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load reports");
      setReports(data.reports ?? []);
    } catch (err) {
      setReports([]);
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports(env);
  }, [env, loadReports]);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      setMessage(null);
      try {
        const form = new FormData();
        form.set("file", file);
        form.set("env", env);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setMessage(`Uploaded to ${data.env}. Share: ${data.latestSharePath}`);
        await loadReports(env);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [env, loadReports],
  );

  const onFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      void uploadFile(file);
    },
    [uploadFile],
  );

  const shareUrl = useCallback((sharePath: string) => {
    if (typeof window === "undefined") return sharePath;
    return `${window.location.origin}${sharePath}`;
  }, []);

  const copyLink = useCallback(
    async (sharePath: string) => {
      const url = shareUrl(sharePath);
      await navigator.clipboard.writeText(url);
      setCopiedPath(sharePath);
      window.setTimeout(() => setCopiedPath(null), 1500);
    },
    [shareUrl],
  );

  const emptyHint = useMemo(() => {
    if (loading) return "Loading…";
    if (error) return null;
    return `No reports in ${env} yet. Drop an HTML file to upload.`;
  }, [loading, error, env]);

  return (
    <main style={styles.wrap}>
      <header style={styles.header}>
        <p style={styles.eyebrow}>Results Renderer</p>
        <h1 style={styles.title}>Share HTML test reports</h1>
        <p style={styles.subtitle}>
          Upload self-contained reports, browse by environment, and send a link to your team.
        </p>
      </header>

      <div style={styles.tabs} role="tablist" aria-label="Environment">
        {ENVS.map((item) => {
          const active = item === env;
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setEnv(item)}
              style={{
                ...styles.tab,
                ...(active ? styles.tabActive : null),
              }}
            >
              {item}
            </button>
          );
        })}
      </div>

      <section
        style={{
          ...styles.dropzone,
          ...(dragOver ? styles.dropzoneActive : null),
          ...(uploading ? styles.dropzoneBusy : null),
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
      >
        <p style={styles.dropTitle}>{uploading ? "Uploading…" : `Drop ${env} HTML report`}</p>
        <p style={styles.dropHint}>or choose a file · .html only · max 2MB</p>
        <label style={styles.fileButton}>
          Choose file
          <input
            type="file"
            accept=".html,text/html"
            disabled={uploading}
            style={{ display: "none" }}
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </section>

      {error ? <p style={styles.error}>{error}</p> : null}
      {message ? <p style={styles.ok}>{message}</p> : null}

      <section style={styles.listSection}>
        <div style={styles.listHeader}>
          <h2 style={styles.listTitle}>{env} reports</h2>
          <button type="button" style={styles.refresh} onClick={() => void loadReports(env)}>
            Refresh
          </button>
        </div>

        {emptyHint ? <p style={styles.empty}>{emptyHint}</p> : null}

        <ul style={styles.list}>
          {reports.map((report) => (
            <li key={report.pathname} style={styles.row}>
              <div style={styles.rowMain}>
                <div style={styles.rowTitle}>
                  {report.label}
                  {report.isLatest ? <span style={styles.badge}>latest</span> : null}
                </div>
                <div style={styles.rowMeta}>
                  {new Date(report.uploadedAt).toLocaleString()} · {(report.size / 1024).toFixed(1)}{" "}
                  KB
                </div>
              </div>
              <div style={styles.actions}>
                <a href={report.sharePath} target="_blank" rel="noreferrer" style={styles.linkBtn}>
                  Open
                </a>
                <button type="button" style={styles.secondaryBtn} onClick={() => void copyLink(report.sharePath)}>
                  {copiedPath === report.sharePath ? "Copied" : "Copy link"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    maxWidth: 880,
    margin: "0 auto",
    padding: "2.5rem 1.25rem 3.5rem",
  },
  header: { marginBottom: "1.5rem" },
  eyebrow: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "var(--accent)",
  },
  title: {
    margin: "0.35rem 0 0.4rem",
    fontSize: "1.9rem",
    letterSpacing: "-0.02em",
  },
  subtitle: { margin: 0, color: "var(--muted)", maxWidth: 540 },
  tabs: { display: "flex", gap: "0.5rem", marginBottom: "1rem" },
  tab: {
    border: "1px solid var(--line)",
    background: "var(--card)",
    color: "var(--ink)",
    borderRadius: 999,
    padding: "0.45rem 1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  tabActive: {
    background: "var(--accent)",
    borderColor: "var(--accent)",
    color: "#fff",
  },
  dropzone: {
    border: "1.5px dashed var(--line)",
    background: "rgba(255,255,255,0.7)",
    borderRadius: 16,
    padding: "1.75rem 1.25rem",
    textAlign: "center",
    marginBottom: "1rem",
  },
  dropzoneActive: {
    borderColor: "var(--accent)",
    background: "var(--accent-soft)",
  },
  dropzoneBusy: { opacity: 0.7 },
  dropTitle: { margin: "0 0 0.25rem", fontWeight: 650, fontSize: "1.05rem" },
  dropHint: { margin: "0 0 1rem", color: "var(--muted)", fontSize: "0.92rem" },
  fileButton: {
    display: "inline-block",
    background: "var(--ink)",
    color: "#fff",
    borderRadius: 10,
    padding: "0.55rem 1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  error: { color: "var(--danger)", margin: "0 0 0.75rem" },
  ok: { color: "var(--ok)", margin: "0 0 0.75rem" },
  listSection: {
    background: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: 16,
    padding: "1rem 1.1rem 0.5rem",
  },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.5rem",
  },
  listTitle: { margin: 0, fontSize: "1.05rem" },
  refresh: {
    border: "1px solid var(--line)",
    background: "#fff",
    borderRadius: 8,
    padding: "0.35rem 0.7rem",
    cursor: "pointer",
  },
  empty: { color: "var(--muted)", margin: "0.5rem 0 1rem" },
  list: { listStyle: "none", margin: 0, padding: 0 },
  row: {
    display: "flex",
    gap: "1rem",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.85rem 0",
    borderTop: "1px solid var(--line)",
    flexWrap: "wrap",
  },
  rowMain: { minWidth: 0, flex: 1 },
  rowTitle: {
    fontWeight: 600,
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
    flexWrap: "wrap",
    wordBreak: "break-all",
  },
  badge: {
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: "var(--accent-soft)",
    color: "var(--accent)",
    borderRadius: 999,
    padding: "0.15rem 0.45rem",
    fontWeight: 700,
  },
  rowMeta: { color: "var(--muted)", fontSize: "0.85rem", marginTop: 2 },
  actions: { display: "flex", gap: "0.5rem" },
  linkBtn: {
    textDecoration: "none",
    background: "var(--accent)",
    color: "#fff",
    borderRadius: 8,
    padding: "0.4rem 0.75rem",
    fontWeight: 600,
    fontSize: "0.9rem",
  },
  secondaryBtn: {
    border: "1px solid var(--line)",
    background: "#fff",
    borderRadius: 8,
    padding: "0.4rem 0.75rem",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.9rem",
  },
};
