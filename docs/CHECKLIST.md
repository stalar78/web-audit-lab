# Audit Checklist

Use this checklist during every audit pass.

## Availability

- [ ] Homepage loads with HTTP 200.
- [ ] Key pages from `configs/sites.json` load successfully.
- [ ] No critical console/page runtime errors.
- [ ] 404 page exists and is user-friendly.

## SEO Basics

- [ ] Unique, meaningful `<title>` per page.
- [ ] Meta description present and relevant.
- [ ] One clear primary `<h1>` per page.
- [ ] Internal links are crawlable and not obviously broken.

## Accessibility Basics

- [ ] Images have non-empty `alt` where required.
- [ ] Headings follow logical structure.
- [ ] Interactive elements appear keyboard-reachable.
- [ ] Link/button text is descriptive (not generic "click here").

## Mobile Layout

- [ ] No horizontal overflow at common mobile widths.
- [ ] Key content remains visible without clipping.
- [ ] Primary CTA remains usable on small screens.
- [ ] Navigation/menu is operable on mobile viewport.

## Navigation

- [ ] Main menu links to expected sections/pages.
- [ ] Header/footer navigation is consistent.
- [ ] Logo links to homepage.
- [ ] Breadcrumbs/back links (if present) behave correctly.

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

- [ ] First screen renders without long blank delay.
- [ ] Large media is reasonably optimized.
- [ ] No obvious layout thrashing/reflow during load.
- [ ] Third-party scripts do not visibly block core content.

## Regression Checks

- [ ] Previously fixed issues stay fixed.
- [ ] No new high-severity issues introduced.
- [ ] Critical user flows still work.
- [ ] Screenshots are compared against previous baseline.
