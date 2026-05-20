# Codex Operating Protocol

This document defines the standard operating protocol for using Codex inside `web-audit-lab`.

`web-audit-lab` is an external audit workspace. It is used to run audits, collect evidence, review reports, and prepare production fix tasks. It must not directly modify production website repositories.

---

## 1. Core rule

Codex works in two separate modes:

1. **Audit mode** inside `web-audit-lab`
2. **Implementation mode** inside the relevant production repository

These modes must not be mixed.

In `web-audit-lab`, Codex may:

- run audit commands;
- read Markdown reports;
- read JSON reports;
- inspect screenshots;
- summarize findings;
- prepare production fix tasks.

In `web-audit-lab`, Codex must not:

- edit production website code;
- apply fixes to `site-stalarvision`, `localkit`, or any other product repository;
- create unrelated tooling;
- change audit scripts unless the audit tool itself is being improved;
- commit generated reports or screenshots.

---

## 2. Standard audit command flow

For a specific site:

```bat
cmd /c "set SITE_ID=<SITE_ID>&&npm run audit"
```

Then find the newest Markdown report:

```bat
cmd /c "npm run report:latest -- <SITE_ID>"
```

For all configured sites:

```bat
cmd /c npm run audit
cmd /c npm run report:latest
```

For fast desktop/link/SEO triage without mobile screenshots:

```bat
cmd /c "set MOBILE_AUDIT=0&&set SITE_ID=<SITE_ID>&&npm run audit"
```

For link-heavy pages:

```bat
cmd /c "set LINK_CHECK_LIMIT=20&&set SITE_ID=<SITE_ID>&&npm run audit"
```

---

## 3. Report review order

Codex must review reports in this order:

1. Open the latest Markdown report.
2. Read `## Triage Summary` first.
3. Review `Recommended review order`.
4. Review `Top issues`.
5. Review pages requiring attention.
6. Review issue categories:
   - technical;
   - links;
   - responsive;
   - accessibility;
   - SEO;
   - performance;
   - content/legal if present.
7. Review desktop screenshots when visual/layout evidence is needed.
8. Review mobile screenshots for responsive issues.
9. Open JSON only when raw structured details are needed.

Markdown is the primary human-readable report. JSON is the secondary raw data source.

---

## 4. Evidence rules

Every important finding should include evidence.

Preferred evidence types:

- Markdown report path;
- exact issue text from `Triage Summary` or page result;
- affected page path and full URL;
- desktop screenshot path;
- mobile screenshot path;
- JSON field/path only when needed.

Examples:

```text
Report: reports/stalarvision/audit-2026-05-20T14-08-43-897Z.md
Page: /
URL: https://stalarvision.ru/
Desktop screenshot: screenshots/stalarvision/home.png
Mobile screenshot: screenshots/stalarvision/mobile/home.png
Issue: [warning][responsive] Mobile horizontal overflow detected (64px).
```

---

## 5. Finding prioritization

Codex should prioritize findings as follows:

### Priority 1 — must handle first

- error / critical findings;
- 5xx or missing HTTP response;
- broken important internal navigation;
- unusable mobile layout;
- serious accessibility blockers;
- missing or broken legal pages;
- production trust issues.

### Priority 2 — should usually become production tasks

- warning findings;
- broken internal links;
- missing canonical;
- missing meta description on important pages;
- missing or multiple H1;
- mobile horizontal overflow;
- images without alt;
- form controls without labels;
- high transfer size or many failed resources.

### Priority 3 — review selectively

- info findings;
- Open Graph image missing;
- title/description slightly outside recommended length;
- placeholder-only form labels;
- special links found;
- elevated but not severe request count.

Not every `info` finding needs a production task.

---

## 6. Task conversion rules

Use:

- `docs/FINDINGS.md` for raw findings and observations;
- `docs/PRODUCTION_FIX_TASKS.md` for actionable production fix tasks.

Codex should create production fix tasks for:

- all error/critical findings;
- most warnings;
- info findings only when they have clear SEO, UX, accessibility, legal, business, or performance value.

Codex should group duplicate findings when they have the same root cause.

Prefer:

```text
one task per fixable cause
```

not:

```text
one task per repeated symptom
```

Example:

If the same layout container causes mobile overflow on three pages, create one task for the shared layout issue and list all affected pages.

---

## 7. Required production task fields

Every production fix task must include:

- Task ID;
- Title;
- Severity;
- Category;
- Source report;
- Evidence;
- Site;
- Page;
- Expected behavior;
- Actual behavior;
- Recommended fix;
- Target production repository;
- Suggested agent;
- Validation steps;
- Status.

Use `docs/PRODUCTION_FIX_TASKS.md` as the canonical template.

---

## 8. Suggested agent selection

Use **Codex** for:

- complex implementation;
- multi-file changes;
- layout debugging;
- SEO metadata architecture;
- responsive fixes;
- accessibility fixes involving components;
- routing issues;
- production regression analysis.

Use **SourceCraft/Copilot** for:

- simple copy changes;
- adding alt attributes;
- changing a wrong href;
- adding a simple meta tag;
- small docs edits;
- small component edits.

Use **human review** for:

- legal text;
- compliance language;
- brand claims;
- pricing;
- guarantees;
- business-sensitive content.

---

## 9. Standard Codex prompt: full site audit

Use this prompt when asking Codex to run a real audit.

```text
You are working inside the `web-audit-lab` repository.

Audit site id: <SITE_ID>.

Important boundaries:
- This is an external audit workspace.
- Do not modify any production repository.
- Do not modify audit scripts unless the audit command fails.
- Do not commit generated reports or screenshots.

Steps:
1. Run:
   cmd /c "set SITE_ID=<SITE_ID>&&npm run audit"
2. Run:
   cmd /c "npm run report:latest -- <SITE_ID>"
3. Open the latest Markdown report.
4. Read `Triage Summary` first.
5. Review recommended review order, top issues, and pages requiring attention.
6. Review page details only where needed.
7. Review desktop screenshots in:
   screenshots/<SITE_ID>/
8. Review mobile screenshots in:
   screenshots/<SITE_ID>/mobile/
9. Open JSON only if raw structured details are needed.
10. Produce:
   - concise audit summary;
   - prioritized findings;
   - production fix tasks using docs/PRODUCTION_FIX_TASKS.md.
11. For each production task, include evidence and validation steps.
12. Do not apply fixes in this workspace.
```

---

## 10. Standard Codex prompt: fast triage audit

Use this when you want a faster audit without mobile screenshots.

```text
You are working inside the `web-audit-lab` repository.

Run a fast triage audit for site id: <SITE_ID>.

Use:
cmd /c "set MOBILE_AUDIT=0&&set SITE_ID=<SITE_ID>&&npm run audit"

Then:
cmd /c "npm run report:latest -- <SITE_ID>"

Read `Triage Summary` first.
Focus on technical, SEO, links, accessibility, and performance issues.
Do not report missing mobile screenshots as a failure because MOBILE_AUDIT is intentionally disabled.

Return:
- concise audit summary;
- prioritized findings;
- production fix tasks using docs/PRODUCTION_FIX_TASKS.md;
- validation commands for re-audit.

Do not modify any production repository.
```

---

## 11. Standard Codex prompt: regression audit

Use this after fixes were applied in a production repository.

```text
You are working inside the `web-audit-lab` repository.

Run a regression audit for site id: <SITE_ID> after production fixes.

Steps:
1. Run:
   cmd /c "set SITE_ID=<SITE_ID>&&npm run audit"
2. Run:
   cmd /c "npm run report:latest -- <SITE_ID>"
3. Open the latest Markdown report.
4. Read `Triage Summary` first.
5. Compare the latest results against the previous known findings/tasks.
6. Confirm whether each tracked task is:
   - fixed;
   - still open;
   - regressed;
   - needs follow-up;
   - accepted risk.
7. Identify any new issues introduced by the fix.
8. Do not modify production repositories from this workspace.
```

---

## 12. Standard Codex prompt: production task generation only

Use this when an audit already exists and Codex only needs to convert findings into tasks.

```text
You are working inside the `web-audit-lab` repository.

Create production fix tasks for site id: <SITE_ID> from the latest audit report.

Steps:
1. Run:
   cmd /c "npm run report:latest -- <SITE_ID>"
2. Open the latest Markdown report.
3. Read `Triage Summary` first.
4. Review all error and warning findings.
5. Review info findings only if they have clear SEO, UX, accessibility, legal, business, or performance value.
6. Group duplicate findings by root cause.
7. Create production fix tasks using docs/PRODUCTION_FIX_TASKS.md.
8. Include evidence and validation steps for each task.
9. Do not modify any production repository.
```

---

## 13. Output format expected from Codex

Codex should return:

```md
# Audit Summary

## Scope

- Site:
- Pages:
- Report:
- Screenshots:

## Triage

- Errors:
- Warnings:
- Info:
- Main categories:

## Prioritized Findings

### 1. Finding title

- Severity:
- Category:
- Page:
- Evidence:
- Why it matters:
- Recommended action:

## Production Fix Tasks

### Task WAL-YYYYMMDD-001

Use the format from `docs/PRODUCTION_FIX_TASKS.md`.

## Validation Plan

- Re-audit command:
- Report helper command:
- Screenshot review needed: yes/no
```

---

## 14. Validation principle

A fix is not complete when code is changed.

A fix is complete only when:

1. the production repository has been updated;
2. the site is available in the audited environment;
3. `web-audit-lab` audit has been re-run;
4. the finding is gone, reduced, or explicitly accepted as risk;
5. evidence is recorded.

---

## 15. Status labels

Use these statuses for production fix tasks:

- `open`
- `in-progress`
- `fixed`
- `verified`
- `needs-follow-up`
- `accepted-risk`
- `rejected`

---

## 16. Operating principle

`web-audit-lab` is the source of audit evidence.

Production repositories are the source of implementation changes.

Do not mix them.
