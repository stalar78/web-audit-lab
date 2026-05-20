# Codex Audit Prompts

Reusable prompts for running audits in this workspace.

## Config Validation Reminder

Before editing audit targets:

- Compare `configs/sites.json` (active list) with `configs/sites.example.json` (schema reference).

After config changes:

- Run full audit: `cmd /c npm run audit`
- Run single-site audit: `cmd /c "set SITE_ID=<site-id>&&npm run audit"`

## Full Website Audit

```text
You are working in the web-audit-lab workspace.
Audit the target website end-to-end.

Scope:
- Use configs/sites.json and select site id: <SITE_ID>
- Audit all configured pages for that site

Actions:
1) Run the automated audit flow.
2) Open the newest Markdown report and read `Triage Summary` first.
3) Review issue categories in Markdown, then open JSON only for raw details.
4) Review screenshots in screenshots/<SITE_ID>/ and screenshots/<SITE_ID>/mobile/.
5) Identify issues across availability, SEO basics, accessibility basics, mobile layout, navigation, content, legal pages, performance, and regression risk.
6) Produce findings using docs/FINDINGS.md format.
7) Provide prioritized production fix tasks (do not modify production repos).

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
2) Run automated audit for that site.
3) Review `Triage Summary` in the newest Markdown report first.
4) Review homepage screenshots and report entry details.
5) Return findings with severity and evidence using docs/FINDINGS.md template.
6) Suggest concise production fix tasks.
```

## Mobile Audit

```text
You are working in web-audit-lab.
Perform a mobile-focused audit for site id: <SITE_ID>.

Actions:
1) Run automated audit first.
2) Read `Triage Summary` first, then inspect responsive issues.
3) Use MCP/Playwright manual checks on mobile viewport for key pages.
4) Validate no horizontal scroll, no clipped content, usable nav/CTA, readable typography.
5) Record each issue in docs/FINDINGS.md format with screenshot evidence.
6) Provide production fix tasks prioritized by user impact.
```

## SEO Audit

```text
You are working in web-audit-lab.
Perform an SEO-basics audit for site id: <SITE_ID>.

Checks:
- Title presence/quality
- Meta description presence/quality
- H1 presence/clarity
- Internal link coverage and obvious broken links
- Legal page indexability/accessibility basics

Actions:
1) Run automated audit.
2) Read `Triage Summary` first, then focus on SEO category issues.
3) Summarize SEO findings per page.
4) Output findings in docs/FINDINGS.md format.
5) Propose production tasks with acceptance criteria.
```

## Accessibility Audit

```text
You are working in web-audit-lab.
Perform an accessibility-basics audit for site id: <SITE_ID>.

Checks:
- Missing/empty alt text
- Heading structure sanity
- Keyboard navigation basics
- Link/button text clarity
- Obvious contrast/readability issues

Actions:
1) Run automated audit.
2) Read `Triage Summary` first, then focus on accessibility category issues.
3) Perform manual verification for high-impact pages.
4) Record issues in docs/FINDINGS.md format.
5) Recommend production fixes and verification steps.
```

## Regression Audit After Production Fixes

```text
You are working in web-audit-lab.
Run a regression audit for site id: <SITE_ID> after production fixes.

Actions:
1) Re-run automated checks for the same site/page scope used previously.
2) Read `Triage Summary` first to identify severity/category shifts vs baseline.
3) Compare latest report/screenshots with the previous baseline.
4) Confirm fixed findings are resolved.
5) Identify any newly introduced issues.
6) Return status for each tracked finding: Fixed, Still Open, or Regressed.
7) Propose follow-up production tasks only where needed.
```
