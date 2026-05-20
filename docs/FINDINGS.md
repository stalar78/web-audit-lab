# Findings Template

This document is for raw audit findings and observations discovered in `web-audit-lab`.

A finding records what the audit found. A production fix task defines what should be changed in a production repository.

Use this file when you need a simple evidence log. Use `docs/PRODUCTION_FIX_TASKS.md` when a finding is important enough to become an actionable implementation task.

## Difference Between Findings and Production Fix Tasks

### Finding

A finding answers:

- What did the audit detect?
- Where was it detected?
- What evidence supports it?
- How severe does it look?

Findings can include raw observations, low-priority notes, duplicate symptoms, or items that still need manual confirmation.

### Production fix task

A production fix task answers:

- What exactly should be fixed?
- In which production repository?
- What is the recommended implementation direction?
- Who or which agent should handle it?
- How will the fix be validated?

Production fix tasks should be created only for important findings that require action.

## When to Convert a Finding Into a Task

Create production fix tasks for:

- all `error` or `critical` findings;
- most `warning` findings;
- `info` findings only when they represent a meaningful business, SEO, accessibility, legal, or UX improvement.

Do not create production tasks for every raw `info` finding automatically.

Group duplicate findings when they have the same root cause.

## Finding Entry

- Date:
- Site:
- Page:
- Severity: `Critical | High | Medium | Low | Info`
- Category: `seo | technical | links | responsive | accessibility | performance | content | legal | other`
- Issue:
- Expected Behavior:
- Actual Behavior:
- Evidence:
- Recommended Fix:
- Convert to Production Task: `Yes | No | Later`
- Production Task Reference:
- Status: `Open | In Progress | Fixed | Blocked | Won't Fix | Accepted Risk`

## Example

- Date: 2026-05-20
- Site: Stalarvision (`stalarvision`)
- Page: `https://stalarvision.ru/privacy`
- Severity: High
- Category: technical
- Issue: Privacy page returns a non-200 response.
- Expected Behavior: Privacy policy page should load successfully for all users and crawlers.
- Actual Behavior: Page returned HTTP 404 during automated audit.
- Evidence:
  - Report: `reports/stalarvision/audit-2026-05-20T10-37-11-123Z.md`
  - JSON: `reports/stalarvision/audit-2026-05-20T10-37-11-123Z.json`
  - Screenshot: `screenshots/stalarvision/_privacy.png`
- Recommended Fix: Restore valid route/content for `/privacy` and validate legal page availability.
- Convert to Production Task: Yes
- Production Task Reference: `WAL-20260520-001`
- Status: Open

## Related Document

Use `docs/PRODUCTION_FIX_TASKS.md` to write the actionable task that will be handed to Codex, SourceCraft/Copilot, or a human reviewer for implementation in the target production repository.
