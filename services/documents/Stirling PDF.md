---
version: 0.14.0
---

# Stirling PDF

A toolbox for PDFs that never leaves the house: merge, split, rotate, compress, convert, OCR, and sign.

<!-- BEGIN homelab:generated (./homelab docs rewrites this block) -->
| | |
|---|---|
| Service | `stirling-pdf` in `compose/documents.yaml` (project `homelab_documents`) |
| Image | `ghcr.io/stirling-tools/stirling-pdf:latest` |
| Category | Documents |
| Starts with `./homelab up` | No: optional, `./homelab install stirling-pdf` |
| Address | https://pdf.example.com (LAN, through Nginx Proxy Manager) |
| On this machine | http://localhost:8095 (`STIRLING_PDF_PORT`) |
| Data | `data/appdata/stirling-pdf` → `/configs` |
| Updates | Watchtower, nightly at 4 AM |
<!-- END homelab:generated -->

## Purpose

Do quick PDF jobs without uploading documents to an online converter.

## Setup

`./homelab install stirling-pdf` and open `https://<TAILSCALE_HOST>:8095` (Home mode), or, with a domain, run `./homelab domain setup` and open https://pdf.example.com. No login is needed on the LAN.

## How it works

- A Java (Spring Boot) web app on port 8080. The heavy lifting is done by tools bundled in the image: PDFBox and qpdf for page work, OCRmyPDF and Tesseract for OCR, and LibreOffice for Office conversions.
- Each tool is a form that posts your file to the server, which returns the result. Every tool is also an HTTP API endpoint, so the same jobs can be scripted.
- Its settings are in `settings.yml` in `/configs`; values you change belong in `custom_settings.yml`, which overrides it and survives upgrades.
- Whether it asks for a sign-in is `security.enableLogin` in `settings.yml`. If a new version starts asking, set it to `false` and restart for the no-login setup this note describes.

## Where things live

| What | Where |
|---|---|
| Main settings | `data/appdata/stirling-pdf/settings.yml` → `/configs/settings.yml` |
| Your overrides | `data/appdata/stirling-pdf/custom_settings.yml` → `/configs/custom_settings.yml` |
| Accounts, when login is on | also in `data/appdata/stirling-pdf` |

## Everyday use

- **Find a tool:** type in the search box on the home page (merge, split, compress, OCR, sign, redact) rather than browsing the list.
- **Many pages at once:** the page editor (multi tool) reorders, rotates, deletes, and splits pages by dragging.
- **Scans:** OCR adds a text layer so a scanned PDF becomes searchable and copyable.
- **Office and images:** convert Word, Excel, PowerPoint, or images to PDF and back.
- **Private papers:** Redact (automatic by search, or by hand) and Add Password before sending a document.

## Connects to

- [Paperless-ngx](<Paperless-ngx.md>): tidy a batch here (merge, split, remove blank pages), then drop the result into `appdata/paperless/consume`.
- [Nginx Proxy Manager](<../network/Nginx Proxy Manager.md>) serves `https://pdf.example.com`; `.env` sets only `STIRLING_PDF_PORT` (default `8095`).
- [Pocket ID](<../security/Pocket ID.md>) can be its sign-in through OAuth2 (`security.oauth2` in `settings.yml`) if you turn the login on.

## Tinkering ideas

- Pipelines: chain steps (for example OCR, then compress, then add a watermark) and run them in one go from the pipeline tool.
- Compare: the compare tool shows the text differences between two versions of a contract.
- Script it: every tool has an API endpoint; the Swagger page lists them with their fields.
- Sign: draw or upload a signature once and place it on any PDF.
- Accounts for the family: turn the login on in `settings.yml` if you want to restrict who can use it.

## Useful commands

Follow the log, restart, read the settings, and rotate a PDF through the API (the result lands in the current folder):

```zsh
./homelab logs stirling-pdf -f
./homelab compose stirling-pdf restart stirling-pdf
./homelab compose stirling-pdf exec stirling-pdf cat /configs/settings.yml
curl -s -o rotated.pdf -F fileInput=@scan.pdf -F angle=90 http://localhost:8095/api/v1/general/rotate-pdf
```

## API

- **Key:** none while login is off. With login on, each account has an API key in its account settings, sent as the `X-API-KEY` header.
- **Base URL:** `http://localhost:8095/api/v1/` on this Mac, or `https://pdf.example.com/api/v1/`.
- **Reference:** the Swagger page at `http://localhost:8095/swagger-ui/index.html` lists every endpoint and lets you try it.

## Learn more

- [Stirling PDF documentation](https://docs.stirlingpdf.com)
- [GitHub: Stirling-Tools/Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) (source of the `ghcr.io/stirling-tools/stirling-pdf` image)

## Backup

`data/appdata/stirling-pdf` holds only settings; it is in the Homelab AppData job. Files are processed and discarded.

## Troubleshooting

Large OCR jobs are slow on CPU; give OrbStack more memory if a job fails.
