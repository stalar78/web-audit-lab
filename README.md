# Web Audit Lab

External Playwright/MCP workspace for auditing multiple public websites.

## Purpose

This repository is used to run repeatable website audits and capture evidence:

- automated browser checks via Playwright;
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

Each site object should include:

- `id`: stable short identifier (used in screenshot folder names);
- `name`: display name;
- `url`: base URL;
- `pages`: list of page paths to audit.

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

- Reports: `reports/`
  - File format: timestamped JSON (`audit-YYYY-MM-DDTHH-mm-ss-sssZ.json`)
- Screenshots: `screenshots/<site-id>/`
  - One full-page PNG per audited path

## MCP Setup

MCP server config is stored in `.vscode/mcp.json` and uses:

- `@playwright/mcp@latest` via `npx` (stdio server)

## How Codex Should Use This Workspace

1. Update `configs/sites.json` with target sites/pages.
2. Run `npm run audit` (or filter with `SITE_ID`).
3. Review `reports/*.json` and `screenshots/<site-id>/*`.
4. Produce findings using `docs/FINDINGS.md` format.
5. Convert findings into fix tasks for the relevant production repository.
6. Re-run audits after fixes to confirm regressions are resolved.

## Future Improvement (Simple, Not Implemented)

Current reports are saved as flat files in `reports/`. A safe next step is to save reports under per-site folders, for example:

- `reports/<site-id>/audit-<timestamp>.json`

This keeps history easier to navigate without introducing a complex reporting system.
