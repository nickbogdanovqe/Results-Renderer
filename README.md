# Results Renderer

Upload self-contained HTML test reports, browse them by environment (`TST` / `DEV`), and share a stable link with your team.

Hosted entirely on **Vercel Hobby** with **Vercel Blob**. No other services.

## Features

- Drag-and-drop (or file picker) upload of `.html` reports (max 2MB)
- Organized by environment tabs: `TST` and `DEV`
- Each upload stores a timestamped copy plus overwrites `latest` for that env
- Shareable viewer URLs:
  - Latest: `/r/TST/latest` or `/r/DEV/latest`
  - Specific: `/r/TST/<timestamp>-filename.html`
- Open access (anyone with the site URL can upload and view)

## Local development

```bash
npm install
cp .env.example .env.local
# paste your Blob token into BLOB_READ_WRITE_TOKEN
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Sample reports live in [`samples/`](samples/) — upload them from the UI after Blob is configured.

## Deploy on Vercel (free)

1. Push this repo to GitHub (or GitLab / Bitbucket).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. In the Vercel project: **Storage → Create → Blob**, then connect it to the project.
   - This sets `BLOB_READ_WRITE_TOKEN` automatically.
4. Redeploy if the first deploy ran before Blob was connected.
5. Open your `*.vercel.app` URL and upload a report.

### Optional: seed sample reports

After deploy, open the site and upload files from `samples/` (for example `latest-TST.html`). They will appear under the `TST` tab, and `/r/TST/latest` will point at the newest upload.

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Multipart form: `file` (required), `env` (`TST` \| `DEV`, optional if detectable from filename) |
| `GET` | `/api/reports?env=TST` | List reports for an environment |
| `GET` | `/r/{ENV}/latest` | Render latest HTML report |
| `GET` | `/r/{ENV}/{filename}.html` | Render a specific report |

## Notes

- Hobby Blob storage has a free monthly allowance; HTML reports are typically tens of KB each.
- There is no authentication — treat the deployment URL as a shared team link.
