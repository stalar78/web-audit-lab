# Codex Audit Prompts

Reusable prompts for running audits in this workspace.

## Config Validation Reminder

Before editing audit targets:

- Compare `configs/sites.json` (active list) with `configs/sites.example.json` (schema reference).

After config changes:

- Run full audit: `cmd /c npm run audit`
- Run single-site audit: `cmd /c "set SITE_ID=<site-id>&&npm run audit"`

## Production Repository Boundary

`web-audit-lab` is an external audit workspace.

Codex may:

- run audits;
- read Markdown reports;
- read JSON reports;
- review screenshots;
- summarize findings;
- prepare production fix tasks.

Codex must not:

- modify production website repositories from this workspace;
- apply website fixes directly in `web-audit-lab`;
- create production changes without a separate task and explicit target repository.

Use:

- `docs/FINDINGS.md` for raw findings;
- `docs/PRODUCTION_FIX_TASKS.md` for actionable production fix tasks.

## Full Website Audit

```text
You are working in the web-audit-lab workspace.
Audit the target website end-to-end.

Scope:
- Use configs/sites.json and select site id: <SITE_ID>
- Audit all configured pages for that site

Actions:
1) Run:
   cmd /c "set SITE_ID=<SITE_ID>&&npm run audit"
2) Run:
   cmd /c "npm run report:latest -- <SITE_ID>"
3) Open the newest Markdown report.
4) Read `Triage Summary` first.
5) Review issue categories in Markdown, then open JSON only for raw details.
6) Review screenshots in screenshots/<SITE_ID>/ and screenshots/<SITE_ID>/mobile/.
7) Identify issues across availability, SEO basics, accessibility basics, mobile layout, navigation, content, legal pages, performance, and regression risk.
8) Produce:
   - concise audit summary;
   - prioritized findings;
   - production fix tasks using docs/PRODUCTION_FIX_TASKS.md.
9) Do not modify any production repository.

Constraints:
- Keep this repo as an external audit workspace.
- Do not add CI/CD.
- Do not over-engineer.
- Keep npm run audit flow intact.
```

## Homepage-Only Audit

```text
You are working in web-audit-lab.
Run a focused homepage audit for site id: <SITE_ID>.

Scope:
- Homepage path only: /

Actions:
1) Confirm / is present in configs/sites.json for the site.
2) Run automated audit for that site:
   cmd /c "set SITE_ID=<SITE_ID>&&npm run audit"
3) Run:
   cmd /c "npm run report:latest -- <SITE_ID>"
4) Open the newest Markdown report and read `Triage Summary` first.
5) Review homepage screenshots and report entry details.
6) Return:
   - concise audit summary;
   - prioritized findings;
   - production fix tasks using docs/PRODUCTION_FIX_TASKS.md.
7) Do not modify any production repository.
```

## Mobile Audit

```text
You are working in web-audit-lab.
Perform a mobile-focused audit for site id: <SITE_ID>.

Actions:
1) Run automated audit first:
   cmd /c "set SITE_ID=<SITE_ID>&&npm run audit"
2) Read `Triage Summary` first, then inspect responsive issues.
3) Review mobile screenshots in screenshots/<SITE_ID>/mobile/.
4) Use MCP/Playwright manual checks on mobile viewport for key pages if needed.
5) Validate no horizontal scroll, no clipped content, usable nav/CTA, readable typography.
6) Record important issues with screenshot evidence.
7) Produce production fix tasks using docs/PRODUCTION_FIX_TASKS.md.
8) Do not modify any production repository.
```

## SEO Audit

```text
You are working in web-audit-lab.
Perform an SEO-basics audit for site id: <SITE_ID>.

Checks:
- Title presence/quality
- Meta description presence/quality
- H1 presence/clarity
- Canonical
- Robots meta
- Open Graph
- Internal link coverage and obvious broken links
- Legal page indexability/accessibility basics

Actions:
1) Run automated audit:
   cmd /c "set SITE_ID=<SITE_ID>&&npm run audit"
2) Open the newest Markdown report.
3) Read `Triage Summary` first.
4) Focus on SEO category issues.
5) Summarize SEO findings per page.
6) Create production fix tasks using docs/PRODUCTION_FIX_TASKS.md for important SEO warnings/errors.
7) Do not modify any production repository.
```

## Accessibility Audit

```text
You are working in web-audit-lab.
Perform an accessibility-basics audit for site id: <SITE_ID>.

Checks:
- Missing/empty alt text
- Accessible names for links/buttons
- Form labels
- Landmark presence
- Heading structure sanity
- Keyboard navigation basics by manual review if needed
- Obvious contrast/readability issues by manual review if needed

Actions:
1) Run automated audit:
   cmd /c "set SITE_ID=<SITE_ID>&&npm run audit"
2) Read `Triage Summary` first.
3) Focus on accessibility category issues.
4) Perform manual verification for high-impact pages.
5) Create production fix tasks using docs/PRODUCTION_FIX_TASKS.md for important accessibility findings.
6) Do not modify any production repository.
```

## Performance Audit

```text
You are working in web-audit-lab.
Perform a lightweight performance/page-weight audit for site id: <SITE_ID>.

Important:
- These are lightweight triage signals, not Lighthouse scores.

Actions:
1) Run automated audit:
   cmd /c "set SITE_ID=<SITE_ID>&&npm run audit"
2) Read `Triage Summary` first.
3) Focus on performance category issues.
4) Review request count, failed requests, transfer size, and largest resources.
5) Create production fix tasks using docs/PRODUCTION_FIX_TASKS.md for important performance warnings.
6) Do not modify any production repository.
```

## Regression Audit After Production Fixes

```text
You are working in web-audit-lab.
Run a regression audit for site id: <SITE_ID> after production fixes.

Actions:
1) Re-run automated checks for the same site/page scope used previously:
   cmd /c "set SITE_ID=<SITE_ID>&&npm run audit"
2) Run:
   cmd /c "npm run report:latest -- <SITE_ID>"
3) Read `Triage Summary` first to identify severity/category shifts vs baseline.
4) Compare latest report/screenshots with the previous baseline.
5) Confirm fixed findings are resolved.
6) Identify any newly introduced issues.
7) Return status for each tracked production fix task:
   - Fixed
   - Still Open
   - Regressed
   - Needs Follow-up
8) Propose follow-up production tasks only where needed.
9) Do not modify any production repository.
```

## Production Fix Task Generation

```text
You are working in web-audit-lab.
Convert the latest audit results for site id <SITE_ID> into production fix tasks.

Actions:
1) Run:
   cmd /c "npm run report:latest -- <SITE_ID>"
2) Open the latest Markdown report.
3) Read `Triage Summary` first.
4) Review all error and warning findings.
5) Ignore low-value info findings unless they have clear SEO, accessibility, UX, legal, or business value.
6) Group duplicate findings by root cause.
7) Create production fix tasks using docs/PRODUCTION_FIX_TASKS.md.
8) For each task include:
   - Task ID
   - Title
   - Severity
   - Category
   - Source report
   - Evidence
   - Site
   - Page
   - Expected behavior
   - Actual behavior
   - Recommended fix
   - Target production repository
   - Suggested agent
   - Validation steps
   - Status
9) Do not modify production repositories from this workspace.
```
