# Web Audit Lab

External Playwright/MCP workspace for auditing multiple public websites.

## Purpose

This repository is used to run repeatable website audits and capture evidence:

- automated browser checks via Playwright;
- basic SEO/technical signals (status, metadata, canonical, lang, viewport, Open Graph);
- MCP-assisted manual inspection;
- JSON reports for machine-readable findings;
- screenshots for visual proof.

## What This Project Is Not

- Not a production website repository.
- Not a deployment pipeline.
- Not a CI/CD setup.
- Not a replacement for implementation work in real product repos.

Use this workspace to detect problems and prepare fix tasks. Apply fixes in the corresponding production repositories.

## Prerequisites

- Node.js 18+ (Node.js 20 LTS recommended)
- npm

## Install Dependencies

```bash
npm install
```

## Configure Sites

Targets are listed in `configs/sites.json`.

- `configs/sites.json` is the active audit target list used by `npm run audit`.
- `configs/sites.example.json` is a reference file only and is not used by the audit script.

Each site object should include:

- `id`: stable short identifier (used in screenshot folder names);
- `name`: display name;
- `url`: base URL;
- `pages`: list of page paths to audit.

Safe way to add a new site:

1. Copy one object shape from `configs/sites.example.json`.
2. Add it to the `sites` array in `configs/sites.json` with a unique `id`.
3. Start with a small `pages` list (for example only `/`) and run an audit.
4. Expand page coverage after the first successful run.

## Run Audit

Run all configured sites:

```bash
npm run audit
```

Run only one site by id (optional):

PowerShell:

```powershell
$env:SITE_ID="localkit"; npm run audit
```

`cmd.exe`:

```bat
set SITE_ID=localkit && npm run audit
```

Multiple ids are also supported:

- `SITE_ID=localkit,stalarvision`

## Output Locations

- Reports: `reports/<site-id>/`
  - Per-site JSON report: `audit-YYYY-MM-DDTHH-mm-ss-sssZ.json`
  - Per-site Markdown report: `audit-YYYY-MM-DDTHH-mm-ss-sssZ.md`
  - Includes SEO/technical issue summaries and per-page issue lists
- Screenshots: `screenshots/<site-id>/`
  - One full-page PNG per audited path

## Find Latest Markdown Reports

Use the helper command to quickly locate the newest human-readable report file:

```bash
npm run report:latest
```

For one site:

```bash
npm run report:latest -- localkit
```

## MCP Setup

MCP server config is stored in `.vscode/mcp.json` and uses:

- `@playwright/mcp@latest` via `npx` (stdio server)

## How Codex Should Use This Workspace

1. Update `configs/sites.json` with target sites/pages.
2. Run `npm run audit` (or filter with `SITE_ID`).
3. Review `reports/<site-id>/*.md` first for quick summary.
4. Review `reports/<site-id>/*.json` when raw detailed data is needed.
5. Review `screenshots/<site-id>/*` for visual evidence.
6. Produce findings using `docs/FINDINGS.md` format.
7. Convert findings into fix tasks for the relevant production repository.
8. Re-run audits after fixes to confirm regressions are resolved.

## Future Improvement (Simple, Not Implemented)
Current reports are already grouped per site. A safe next step is adding an optional lightweight index file per run (for example a small `reports/index.json`) to simplify history browsing across many audits.
