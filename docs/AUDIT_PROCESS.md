# Audit Process

This document defines the standard workflow for running audits in this workspace and turning findings into production tasks.

## 1. Prepare Scope

1. Open `configs/sites.json`.
2. Before adding or editing targets, check `configs/sites.example.json` for the expected schema.
3. Identify the site `id`, base `url`, and required `pages`.
4. Confirm you are auditing public/staging URLs only.
5. Remember: never edit production code from this repository.

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
- basic performance/page-weight signals (requests, transfer size, failed requests, largest resources);
- responsive mobile layout signals (horizontal overflow and visible text length);
- browser console/page errors;
- full-page desktop and mobile screenshots.

Performance signals in this workspace are lightweight triage metrics, not Lighthouse performance scores.

## 4. Review the Report

1. Open `reports/<site-id>/` and read the newest Markdown report (`audit-<timestamp>.md`) first.
2. Read `## Triage Summary` before the full page-by-page details.
3. Review the recommended review order.
4. Review top issues by severity and category.
5. Review SEO/technical/accessibility/performance issue sections in the Markdown report.
6. Review broken internal link sections and prioritize high-traffic navigation paths.
7. Open JSON report (`audit-<timestamp>.json`) only if raw fields/details are needed.
8. Open desktop screenshots in `screenshots/<site-id>/`.
9. Open mobile screenshots in `screenshots/<site-id>/mobile/`.
10. Check desktop and mobile layout consistency across key pages.
11. Cross-check screenshot issues with report errors and reported page issues.

## 5. Log Raw Findings When Needed

Use `docs/FINDINGS.md` when you need to record raw findings or observations.

A raw finding is useful when:

- the issue needs manual confirmation;
- there are duplicate symptoms;
- the finding may or may not become a production task;
- you need a lightweight audit log.

Include concrete evidence:

- screenshot path(s);
- Markdown report path;
- JSON report path or exact JSON field if needed;
- exact URL/page path.

## 6. Convert Important Findings to Production Fix Tasks

After reviewing `Triage Summary`, convert important findings into production fix tasks using `docs/PRODUCTION_FIX_TASKS.md`.

Create production fix tasks for:

- all `error` or `critical` findings;
- most `warning` findings;
- `info` findings only when they represent meaningful business, SEO, accessibility, legal, UX, or performance value.

Do not create production tasks for every `info` finding automatically.

A good production fix task must include:

- clear title;
- severity;
- category;
- source report;
- evidence;
- affected site and page;
- expected vs actual behavior;
- recommended fix;
- target production repository;
- suggested agent;
- validation steps;
- status.

Important: this repository is audit-only. Production fixes must be implemented in the proper website repository.

## 7. Apply Fixes Outside This Repository

Use the task from `docs/PRODUCTION_FIX_TASKS.md` as the handoff to the implementation agent.

Implementation should happen in the target production repository, for example:

- `site-stalarvision`;
- `localkit`;
- another website repository.

Do not change production website code from `web-audit-lab`.

## 8. Re-Audit After Fixes

1. Re-run the same scope (`SITE_ID` and pages).
2. Compare new report/screenshots to the previous run.
3. Confirm the finding is gone, reduced in severity, or intentionally accepted as risk.
4. Mark the production fix task as `verified`, `accepted-risk`, or `needs-follow-up`.
