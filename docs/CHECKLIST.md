# Audit Checklist

Use this checklist during every audit pass.

## Availability

- [ ] Homepage loads with HTTP 200.
- [ ] Key pages from `configs/sites.json` load successfully.
- [ ] No critical console/page runtime errors.
- [ ] 404 page exists and is user-friendly.

## SEO Basics

- [ ] `<title>` is present and length is roughly 20-70 characters.
- [ ] Meta description is present and length is roughly 50-170 characters.
- [ ] Exactly one clear `<h1>` exists on key pages.
- [ ] Canonical link is present on indexable pages.
- [ ] Open Graph title/description/image are present on key landing pages.
- [ ] Internal links are crawlable and not obviously broken.

## Accessibility Basics

- [ ] Buttons have accessible names (text, `aria-label`, `aria-labelledby`, or `title`).
- [ ] Actionable links have accessible names.
- [ ] Form controls have labels (label, aria-label, aria-labelledby, or title).
- [ ] Placeholder-only form labels are minimized and reviewed.
- [ ] Images have non-empty `alt` where required.
- [ ] Landmarks exist (`main` required, `header`/`nav`/`footer` reviewed).

## Mobile Layout

- [ ] No horizontal overflow at common mobile widths.
- [ ] Key content remains visible without clipping on mobile screenshots.
- [ ] Primary CTA remains usable on small screens.
- [ ] Navigation/menu is operable on mobile viewport.
- [ ] Mobile screenshot under `screenshots/<site-id>/mobile/` is reviewed manually.
- [ ] Mobile text/content density is readable and not unexpectedly empty.

## Navigation

- [ ] Main menu links to expected sections/pages.
- [ ] Header/footer navigation is consistent.
- [ ] Logo links to homepage.
- [ ] Breadcrumbs/back links (if present) behave correctly.
- [ ] Important navigation links are present on key pages.
- [ ] No broken internal links in primary navigation/footer/CTA areas.
- [ ] External links are reviewed manually for correctness and trust.

## Content

- [ ] No obvious placeholder or broken text.
- [ ] No severe typos in key conversion/legal areas.
- [ ] Contact details are present and readable (if expected).
- [ ] Core value proposition is visible above the fold on homepage.

## Legal Pages

- [ ] Privacy policy page exists and opens.
- [ ] Terms page exists and opens (if required).
- [ ] Cookie/consent messaging appears where applicable.
- [ ] Legal links are accessible from footer/navigation.

## Performance Signals

- [ ] High request count pages are reviewed (`>80` info, `>150` warning).
- [ ] High transfer size pages are reviewed (`>2MB` info, `>5MB` warning).
- [ ] Image/script request-heavy pages are reviewed (`>30` each info).
- [ ] Failed resource requests are investigated.
- [ ] Largest resources from report are manually reviewed for optimization opportunities.

## Regression Checks

- [ ] Previously fixed issues stay fixed.
- [ ] No new high-severity issues introduced.
- [ ] Critical user flows still work.
- [ ] Screenshots are compared against previous baseline.

## Technical Page Signals

- [ ] HTTP status is valid (no missing status, no 5xx on audited pages).
- [ ] `html lang` attribute is present.
- [ ] `meta viewport` tag is present.
- [ ] Robots directives are present where required by SEO policy.
