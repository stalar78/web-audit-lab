# Audit Process

This document defines the standard workflow for running audits in this workspace and turning findings into production tasks.

## 1. Prepare Scope

1. Open `configs/sites.json`.
2. Before adding or editing targets, check `configs/sites.example.json` for the expected schema.
3. Identify the site `id`, base `url`, and required `pages`.
4. Confirm you are auditing public/staging URLs only (never edit production code from this repo).

## 2. Select Target Site

Option A: Audit all configured sites.

```bash
cmd /c npm run audit
```

Option B: Audit a specific site by `id`.

`cmd.exe`:

```bat
cmd /c "set SITE_ID=stalarvision&&npm run audit"
```

Option C: Audit multiple sites.

- Use comma-separated ids: `SITE_ID=stalarvision,localkit`

After changing `configs/sites.json`, validate immediately:

```bat
cmd /c npm run audit
cmd /c "set SITE_ID=<site-id>&&npm run audit"
```

## 3. Run Automated Checks

1. Execute the audit command.
2. Confirm script output ends with `Audit completed.`
3. Capture the generated report path under `reports/`.
4. Run `npm run report:latest` to quickly find the newest Markdown report per site.
5. For very link-heavy pages, optionally run with `LINK_CHECK_LIMIT` (for example `cmd /c "set LINK_CHECK_LIMIT=20&&npm run audit"`).
6. For faster desktop/link/SEO triage runs, optionally disable mobile checks with `cmd /c "set MOBILE_AUDIT=0&&npm run audit"`.

Automated checks currently include:

- page response status;
- page title;
- meta description presence;
- `h1` extraction;
- link count;
- basic image alt checks (`img` without alt or empty alt);
- basic accessibility checks (accessible names, form labels, landmarks);
- responsive mobile layout signals (horizontal overflow and visible text length);
- browser console/page errors;
- full-page desktop and mobile screenshots.

## 4. Review Screenshots

1. Open `reports/<site-id>/` and read the newest Markdown report (`audit-<timestamp>.md`) first.
2. Review SEO/technical/accessibility issue sections in the Markdown report before manual visual checks.
3. Review broken internal link sections in the Markdown report and prioritize high-traffic navigation paths.
4. Open JSON report (`audit-<timestamp>.json`) only if raw fields/details are needed.
5. Open desktop screenshots in `screenshots/<site-id>/`.
6. Open mobile screenshots in `screenshots/<site-id>/mobile/`.
7. Check desktop and mobile layout consistency across key pages.
8. Spot obvious visual defects:
   - broken sections;
   - overlapping content;
   - hidden text;
   - missing images/icons;
   - unexpected blank states.
9. Cross-check screenshot issues with report errors and reported page issues.

## 5. Log Findings

1. Use `docs/FINDINGS.md` template for each issue.
2. Include concrete evidence:
   - screenshot path(s);
   - report JSON entry;
   - exact URL/page path.
3. Assign severity and status.

## 6. Convert Findings to Production Fix Tasks

For each validated finding, create a task in the target production repository tracker with:

- clear title: `[Audit][Site][Severity] Short issue`;
- page URL and reproduction steps;
- expected vs actual behavior;
- evidence links (screenshot/report);
- suggested implementation direction;
- acceptance criteria;
- owner and due date.

Important: this repository is audit-only. Production fixes must be implemented in the proper website repository.

## 7. Re-Audit After Fixes

1. Re-run the same scope (`SITE_ID` and pages).
2. Compare new report/screenshots to previous run.
3. Mark findings as `Fixed` or `Needs follow-up` in tracking.
