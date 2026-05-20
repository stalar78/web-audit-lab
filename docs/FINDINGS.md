# Findings Template

Use one entry per finding.

## Finding Entry

- Date:
- Site:
- Page:
- Severity: `Critical | High | Medium | Low`
- Issue:
- Expected Behavior:
- Actual Behavior:
- Evidence:
- Recommended Fix:
- Status: `Open | In Progress | Fixed | Blocked | Won't Fix`

## Example

- Date: 2026-05-20
- Site: Stalarvision (`stalarvision`)
- Page: `https://stalarvision.ru/privacy`
- Severity: High
- Issue: Privacy page returns a non-200 response.
- Expected Behavior: Privacy policy page should load successfully for all users and crawlers.
- Actual Behavior: Page returned HTTP 404 during automated audit.
- Evidence:
  - Report: `reports/audit-2026-05-20T10-37-11-123Z.json` (entry with `pagePath: "/privacy"`)
  - Screenshot: `screenshots/stalarvision/_privacy.png`
- Recommended Fix: Restore valid route/content for `/privacy` and add regression test for legal page availability.
- Status: Open
