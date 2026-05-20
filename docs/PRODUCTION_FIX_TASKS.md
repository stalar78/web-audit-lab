# Production Fix Tasks

This document defines how audit findings from `web-audit-lab` should be converted into actionable production fix tasks.

`web-audit-lab` is an external audit workspace. It discovers issues, captures evidence, and prepares tasks. It must not directly modify production website repositories.

Fixes must be applied in the relevant production repository, for example:

- `site-stalarvision`
- `localkit`
- another target website repository

---

## 1. Workflow: from audit finding to production fix

Recommended flow:

1. Run the audit from `web-audit-lab`.
2. Open the latest Markdown report.
3. Read `## Triage Summary` first.
4. Review issue categories and affected pages.
5. Check screenshots if the issue is visual, responsive, or layout-related.
6. Check JSON only when raw structured details are needed.
7. Convert important findings into production fix tasks using the template below.
8. Apply fixes in the target production repository.
9. Re-run the audit from `web-audit-lab`.
10. Mark the task as verified only after the issue disappears or is intentionally accepted.

Not every finding needs a production task. Some `info` findings may be notes for later review.

---

## 2. Production fix task template

Use this template when converting audit findings into actionable tasks.

```md
## Task ID

WAL-YYYYMMDD-001

## Title

Short, action-oriented title.

## Severity

error | critical | warning | info

## Category

seo | technical | links | responsive | accessibility | performance | content | legal | other

## Source report

Path to the audit report, for example:

`reports/stalarvision/audit-2026-05-20T14-08-43-897Z.md`

## Evidence

Relevant evidence from the audit:

- Triage Summary item
- Page Results issue
- Desktop screenshot path
- Mobile screenshot path
- JSON path/details if needed

## Site

Site name and site id.

Example:

`Stalarvision / stalarvision`

## Page

Affected page path and full URL.

Example:

`/privacy`  
`https://stalarvision.ru/privacy`

## Expected behavior

What should happen or what should be present.

## Actual behavior

What the audit found.

## Recommended fix

Concrete implementation recommendation for the production repository.

## Target production repository

Repository where the fix should be made.

Example:

`site-stalarvision`

## Suggested agent

Recommended executor:

- Codex — complex code, architecture, non-trivial refactor, multi-file change
- SourceCraft/Copilot — simple edits, copy updates, minor component fixes
- Human review — legal, brand, business, or content-sensitive decision

## Validation steps

How to verify the fix.

Example:

1. Apply the fix in the production repository.
2. Deploy or run the target site locally.
3. Re-run the audit:
   `cmd /c "set SITE_ID=stalarvision&&npm run audit"`
4. Open the latest Markdown report:
   `cmd /c "npm run report:latest -- stalarvision"`
5. Confirm the issue is gone.
6. Review screenshots if applicable.

## Status

open | in-progress | fixed | verified | accepted-risk | rejected
```

---

## 3. Severity guidance

### critical / error

Use for issues that break essential behavior, indexing, accessibility, or trust.

Examples:

- page returns 5xx;
- key route fails to load;
- internal navigation breaks important user journey;
- mobile layout is unusable;
- form cannot be used;
- critical legal page is missing;
- severe accessibility blocker.

### warning

Use for important issues that should be fixed but do not fully block the page.

Examples:

- missing canonical;
- missing meta description;
- multiple or missing H1;
- broken internal link;
- images without alt;
- form fields without labels;
- mobile horizontal overflow;
- high transfer size;
- failed resource requests.

### info

Use for lower-priority findings, review notes, or improvement suggestions.

Examples:

- title slightly too short or too long;
- Open Graph image missing;
- placeholder-only form label;
- high but not severe request count;
- special links found;
- optional content/UX improvement.

---

## 4. Category guidance

Use one primary category per task.

### seo

Search and social metadata:

- title;
- meta description;
- H1;
- canonical;
- robots;
- Open Graph;
- language metadata.

### technical

Page status and technical correctness:

- HTTP status;
- console/page errors;
- malformed markup symptoms;
- viewport/meta issues;
- unexpected audit failures.

### links

Navigation and link integrity:

- broken internal links;
- important navigation missing;
- wrong internal target;
- external links requiring manual review.

### responsive

Mobile and layout behavior:

- horizontal overflow;
- broken mobile layout;
- unreadable mobile content;
- missing mobile screenshot evidence;
- mobile content unexpectedly absent.

### accessibility

Basic accessibility and semantic structure:

- image without alt;
- button without accessible name;
- link without accessible name;
- form control without label;
- missing main landmark;
- missing semantic structure.

### performance

Lightweight page-weight findings:

- high request count;
- large transfer size;
- many image/script/font resources;
- failed resource requests;
- large resources requiring review.

### content

Content quality and correctness:

- placeholder text;
- typo;
- wrong business information;
- unclear CTA;
- missing expected copy;
- duplicated content.

### legal

Legal, compliance, and trust pages:

- privacy page issue;
- terms page issue;
- missing legal link;
- outdated legal copy;
- incorrect footer legal navigation.

### other

Use only when no other category fits.

---

## 5. Example task: image without alt

```md
## Task ID

WAL-20260520-001

## Title

Add meaningful alt text to homepage image

## Severity

warning

## Category

accessibility

## Source report

`reports/localkit/audit-2026-05-20T13-18-09-504Z.md`

## Evidence

Audit issue:

`[warning][accessibility] Images without alt found (1).`

Desktop screenshot:

`screenshots/localkit/home.png`

## Site

LocalKit / localkit

## Page

`/`  
`https://localkit.ru/`

## Expected behavior

Important images should have meaningful `alt` text. Decorative images should use `alt=""` intentionally.

## Actual behavior

The audit found one image without alt text.

## Recommended fix

Find the image on the homepage and add meaningful alt text if it conveys content. If the image is decorative, add an explicit empty alt attribute and confirm that it is not announced unnecessarily by assistive technologies.

## Target production repository

`localkit`

## Suggested agent

SourceCraft/Copilot

## Validation steps

1. Apply the alt fix in the production repository.
2. Re-run:
   `cmd /c "set SITE_ID=localkit&&npm run audit"`
3. Open the latest report:
   `cmd /c "npm run report:latest -- localkit"`
4. Confirm the accessibility warning is gone.

## Status

open
```

---

## 6. Example task: missing canonical

```md
## Task ID

WAL-20260520-002

## Title

Add canonical URL to page metadata

## Severity

warning

## Category

seo

## Source report

`reports/stalarvision/audit-2026-05-20T14-08-43-897Z.md`

## Evidence

Audit issue:

`[warning][seo] Canonical link is missing.`

## Site

Stalarvision / stalarvision

## Page

`/`  
`https://stalarvision.ru/`

## Expected behavior

The page should include a canonical URL pointing to the preferred indexable version of the page.

## Actual behavior

The audit did not find a canonical link.

## Recommended fix

Add a canonical tag to the page metadata. Ensure the URL is absolute, stable, and matches the preferred production URL.

Example:

`<link rel="canonical" href="https://stalarvision.ru/" />`

## Target production repository

`site-stalarvision`

## Suggested agent

Codex

## Validation steps

1. Add canonical metadata in the production repository.
2. Re-run:
   `cmd /c "set SITE_ID=stalarvision&&npm run audit"`
3. Confirm the canonical warning is gone in the latest Markdown report.

## Status

open
```

---

## 7. Example task: mobile horizontal overflow

```md
## Task ID

WAL-20260520-003

## Title

Fix mobile horizontal overflow on homepage

## Severity

warning

## Category

responsive

## Source report

`reports/stalarvision/audit-2026-05-20T14-08-43-897Z.md`

## Evidence

Audit issue:

`[warning][responsive] Mobile horizontal overflow detected (64px).`

Mobile screenshot:

`screenshots/stalarvision/mobile/home.png`

## Site

Stalarvision / stalarvision

## Page

`/`  
`https://stalarvision.ru/`

## Expected behavior

The page should fit within the mobile viewport without horizontal scrolling.

## Actual behavior

The audit detected horizontal overflow on mobile.

## Recommended fix

Inspect mobile layout containers, hero section, wide images, grid columns, fixed-width blocks, and any `100vw` usage. Replace unsafe fixed widths with responsive constraints such as `max-width: 100%`, `overflow-wrap`, responsive grid rules, or container padding adjustments.

## Target production repository

`site-stalarvision`

## Suggested agent

Codex

## Validation steps

1. Apply the responsive layout fix.
2. Re-run:
   `cmd /c "set SITE_ID=stalarvision&&npm run audit"`
3. Review:
   `screenshots/stalarvision/mobile/home.png`
4. Confirm `hasHorizontalOverflow=false` and no responsive warning remains.

## Status

open
```

---

## 8. Example task: broken internal link

```md
## Task ID

WAL-20260520-004

## Title

Fix broken internal link to privacy page

## Severity

warning

## Category

links

## Source report

`reports/stalarvision/audit-2026-05-20T14-08-43-897Z.md`

## Evidence

Audit issue:

`[warning][technical] Internal link returns HTTP 404: https://stalarvision.ru/privacy-policy`

## Site

Stalarvision / stalarvision

## Page

`/`  
`https://stalarvision.ru/`

## Expected behavior

All important internal links should resolve to valid pages.

## Actual behavior

The audit found an internal link returning HTTP 404.

## Recommended fix

Update the broken href to the correct route, or create the missing target page if the route is intended.

## Target production repository

`site-stalarvision`

## Suggested agent

SourceCraft/Copilot

## Validation steps

1. Fix the link in the production repository.
2. Re-run:
   `cmd /c "set SITE_ID=stalarvision&&npm run audit"`
3. Confirm `totalBrokenLinks=0` or that this specific link no longer appears in broken internal links.

## Status

open
```

---

## 9. Task selection rules

When converting findings into production fix tasks:

- Create tasks for all `error` findings.
- Create tasks for `warning` findings unless they are known and intentionally accepted.
- Do not automatically create tasks for every `info` finding.
- Group duplicate findings when they have the same cause.
- Prefer one task per fixable cause, not one task per repeated symptom.
- Include evidence paths so the production agent can verify the issue.
- Include validation steps that require re-running the audit.

---

## 10. Suggested agent selection

Use Codex when the task requires:

- multi-file implementation;
- debugging layout or routing;
- SEO metadata architecture;
- component refactor;
- responsive layout changes;
- complex accessibility fixes.

Use SourceCraft/Copilot when the task is:

- small copy update;
- adding an alt attribute;
- replacing a wrong href;
- updating a simple metadata field;
- editing a checklist or docs file.

Use human review when the task touches:

- legal copy;
- compliance;
- brand claims;
- pricing;
- guarantees;
- business-sensitive content.

---

## 11. Validation principle

A production fix task is not complete until the audit is re-run and the finding is either:

- gone;
- reduced to a lower severity;
- intentionally marked as accepted risk with a reason.

Always record the validation command and the report path used for verification.
