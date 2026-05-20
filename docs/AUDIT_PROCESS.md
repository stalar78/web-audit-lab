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

Automated checks currently include:

- page response status;
- page title;
- meta description presence;
- `h1` extraction;
- link count;
- basic image alt checks (`img` without alt or empty alt);
- browser console/page errors;
- full-page screenshots.

## 4. Review Screenshots

1. Open `reports/<site-id>/` and read the newest Markdown report (`audit-<timestamp>.md`) first.
2. Open JSON report (`audit-<timestamp>.json`) only if raw fields/details are needed.
3. Open `screenshots/<site-id>/`.
4. Check desktop layout consistency across key pages.
5. Spot obvious visual defects:
   - broken sections;
   - overlapping content;
   - hidden text;
   - missing images/icons;
   - unexpected blank states.
6. Cross-check screenshot issues with report errors.

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
