const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const sitesConfig = require("../configs/sites.json");
const STABILIZATION_WAIT_MS = 2000;
const MOBILE_VIEWPORT = {
    width: 390,
    height: 844
};

function toReportTimestamp(isoString) {
    return isoString.replace(/[:.]/g, "-");
}

function getSelectedSites(allSites) {
    const rawSiteId = process.env.SITE_ID;

    if (!rawSiteId) {
        return allSites;
    }

    const targetIds = rawSiteId
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

    const selectedSites = allSites.filter((site) => targetIds.includes(site.id));
    const missingIds = targetIds.filter(
        (id) => !selectedSites.some((site) => site.id === id)
    );

    if (missingIds.length > 0) {
        console.error(`Unknown SITE_ID value(s): ${missingIds.join(", ")}`);
        console.error(
            `Available site ids: ${allSites.map((site) => site.id).join(", ")}`
        );
        return [];
    }

    return selectedSites;
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function normalizeUrl(baseUrl, pagePath) {
    const cleanBase = baseUrl.replace(/\/$/, "");
    const cleanPath = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
    return `${cleanBase}${cleanPath}`;
}

function getScreenshotFileName(pagePath) {
    return `${pagePath === "/" ? "home" : pagePath.replace(/\//g, "_")}.png`;
}

function getLinkCheckLimit() {
    const rawLimit = process.env.LINK_CHECK_LIMIT;

    if (!rawLimit) {
        return null;
    }

    const parsed = Number.parseInt(rawLimit, 10);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        console.warn(
            `Invalid LINK_CHECK_LIMIT value: "${rawLimit}". Expected a positive integer. Falling back to unlimited link checks.`
        );
        return null;
    }

    return parsed;
}

function getMobileAuditEnabled() {
    const rawValue = process.env.MOBILE_AUDIT;

    if (!rawValue) {
        return true;
    }

    const normalized = rawValue.trim().toLowerCase();

    if (normalized === "1" || normalized === "true") {
        return true;
    }

    if (normalized === "0" || normalized === "false") {
        return false;
    }

    console.warn(
        `Invalid MOBILE_AUDIT value: "${rawValue}". Expected one of: 1, true, 0, false. Falling back to enabled mobile audit.`
    );
    return true;
}

function normalizeText(value) {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

async function getAttributeSafe(page, selector, attribute) {
    return page
        .locator(selector)
        .first()
        .getAttribute(attribute)
        .then((value) => normalizeText(value))
        .catch(() => null);
}

function buildDefaultSeo() {
    return {
        titlePresent: false,
        titleLength: 0,
        descriptionPresent: false,
        descriptionLength: 0,
        h1Count: 0,
        canonical: null,
        canonicalPresent: false,
        robots: null,
        robotsPresent: false,
        htmlLang: null,
        htmlLangPresent: false,
        viewport: null,
        viewportPresent: false,
        openGraph: {
            title: null,
            description: null,
            image: null,
            url: null,
            type: null
        },
        openGraphPresent: false
    };
}

function buildSeoData(result, rawSeo) {
    const titleText = normalizeText(result.title);
    const descriptionText = normalizeText(result.description);
    const canonicalText = normalizeText(rawSeo.canonical);
    const robotsText = normalizeText(rawSeo.robots);
    const htmlLangText = normalizeText(rawSeo.htmlLang);
    const viewportText = normalizeText(rawSeo.viewport);

    const openGraph = {
        title: normalizeText(rawSeo.openGraph.title),
        description: normalizeText(rawSeo.openGraph.description),
        image: normalizeText(rawSeo.openGraph.image),
        url: normalizeText(rawSeo.openGraph.url),
        type: normalizeText(rawSeo.openGraph.type)
    };

    const openGraphPresent = Object.values(openGraph).some(Boolean);

    return {
        titlePresent: Boolean(titleText),
        titleLength: titleText ? titleText.length : 0,
        descriptionPresent: Boolean(descriptionText),
        descriptionLength: descriptionText ? descriptionText.length : 0,
        h1Count: result.h1.length,
        canonical: canonicalText,
        canonicalPresent: Boolean(canonicalText),
        robots: robotsText,
        robotsPresent: Boolean(robotsText),
        htmlLang: htmlLangText,
        htmlLangPresent: Boolean(htmlLangText),
        viewport: viewportText,
        viewportPresent: Boolean(viewportText),
        openGraph,
        openGraphPresent
    };
}

function getDefaultLinks() {
    return {
        total: 0,
        internal: 0,
        external: 0,
        special: 0,
        empty: 0,
        checked: 0,
        broken: 0,
        skipped: 0,
        items: []
    };
}

function getDefaultResponsive() {
    return {
        mobile: {
            enabled: true,
            skipped: false,
            skipReason: null,
            viewport: {
                width: MOBILE_VIEWPORT.width,
                height: MOBILE_VIEWPORT.height
            },
            screenshotPath: null,
            documentWidth: null,
            viewportWidth: null,
            bodyScrollWidth: null,
            hasHorizontalOverflow: false,
            overflowAmount: 0,
            visibleTextLength: null,
            errors: []
        }
    };
}

function getDefaultAccessibility() {
    return {
        buttonsTotal: 0,
        buttonsWithoutAccessibleName: 0,
        linksTotal: 0,
        linksWithoutAccessibleName: 0,
        formControlsTotal: 0,
        formControlsWithoutLabel: 0,
        formControlsWithPlaceholderOnly: 0,
        imagesTotal: 0,
        imagesWithoutAlt: 0,
        hasHeader: false,
        hasMain: false,
        hasNav: false,
        hasFooter: false,
        landmarks: {
            header: false,
            main: false,
            nav: false,
            footer: false
        },
        items: {
            buttonsWithoutAccessibleName: [],
            linksWithoutAccessibleName: [],
            formControlsWithoutLabel: []
        }
    };
}

async function collectAccessibilityData(page) {
    return page.evaluate(() => {
        const trimText = (value) =>
            typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

        const getLabelledByText = (element) => {
            const labelledBy = trimText(element.getAttribute("aria-labelledby"));
            if (!labelledBy) {
                return "";
            }

            return labelledBy
                .split(/\s+/)
                .map((id) => {
                    const target = document.getElementById(id);
                    return target ? trimText(target.textContent || "") : "";
                })
                .filter(Boolean)
                .join(" ");
        };

        const getButtonOrLinkName = (element) => {
            const ariaLabel = trimText(element.getAttribute("aria-label"));
            if (ariaLabel) {
                return ariaLabel;
            }

            const labelledByText = getLabelledByText(element);
            if (labelledByText) {
                return labelledByText;
            }

            const title = trimText(element.getAttribute("title"));
            if (title) {
                return title;
            }

            if (element instanceof HTMLInputElement) {
                const value = trimText(element.value || "");
                if (value) {
                    return value;
                }
            }

            return trimText(element.textContent || "");
        };

        const hasAssociatedForLabel = (control) => {
            const controlId = trimText(control.id || "");
            if (!controlId) {
                return false;
            }

            const labels = Array.from(document.querySelectorAll("label[for]"));
            return labels.some((label) => trimText(label.getAttribute("for")) === controlId);
        };

        const buttons = Array.from(
            document.querySelectorAll(
                "button, input[type='button'], input[type='submit'], input[type='reset']"
            )
        );
        const buttonsWithoutAccessibleName = [];
        for (const button of buttons) {
            if (!getButtonOrLinkName(button)) {
                buttonsWithoutAccessibleName.push({
                    tag: button.tagName.toLowerCase(),
                    text: trimText(button.textContent || ""),
                    type: trimText(button.getAttribute("type") || "")
                });
            }
        }

        const links = Array.from(document.querySelectorAll("a")).filter((link) => {
            const href = trimText(link.getAttribute("href"));
            if (!href || href === "#") {
                return false;
            }

            const lowerHref = href.toLowerCase();
            if (
                href.startsWith("#") ||
                lowerHref.startsWith("mailto:") ||
                lowerHref.startsWith("tel:") ||
                lowerHref.startsWith("javascript:")
            ) {
                return false;
            }

            return true;
        });

        const linksWithoutAccessibleName = [];
        for (const link of links) {
            if (!getButtonOrLinkName(link)) {
                linksWithoutAccessibleName.push({
                    href: trimText(link.getAttribute("href") || ""),
                    text: trimText(link.textContent || "")
                });
            }
        }

        const controls = Array.from(
            document.querySelectorAll("input, select, textarea")
        ).filter((control) => {
            if (!(control instanceof HTMLElement)) {
                return false;
            }

            if (control instanceof HTMLInputElement) {
                const inputType = trimText(control.type || "").toLowerCase();
                if (inputType === "hidden") {
                    return false;
                }
            }

            return true;
        });

        const formControlsWithoutLabel = [];
        let formControlsWithPlaceholderOnly = 0;
        for (const control of controls) {
            const hasWrappingLabel = Boolean(control.closest("label"));
            const hasForLabel = hasAssociatedForLabel(control);
            const hasAriaLabel = Boolean(trimText(control.getAttribute("aria-label")));
            const hasAriaLabelledBy = Boolean(getLabelledByText(control));
            const hasTitle = Boolean(trimText(control.getAttribute("title")));
            const hasPlaceholder = Boolean(trimText(control.getAttribute("placeholder")));

            const hasStrongLabel =
                hasWrappingLabel ||
                hasForLabel ||
                hasAriaLabel ||
                hasAriaLabelledBy ||
                hasTitle;

            if (!hasStrongLabel && hasPlaceholder) {
                formControlsWithPlaceholderOnly += 1;
            }

            if (!hasStrongLabel && !hasPlaceholder) {
                formControlsWithoutLabel.push({
                    tag: control.tagName.toLowerCase(),
                    type: trimText(control.getAttribute("type") || ""),
                    name: trimText(control.getAttribute("name") || "")
                });
            }
        }

        const images = Array.from(document.querySelectorAll("img"));
        const imagesWithoutAlt = images.filter((img) => {
            const alt = img.getAttribute("alt");
            return alt === null || trimText(alt) === "";
        });

        const landmarks = {
            header: Boolean(document.querySelector("header, [role='banner']")),
            main: Boolean(document.querySelector("main, [role='main']")),
            nav: Boolean(document.querySelector("nav, [role='navigation']")),
            footer: Boolean(document.querySelector("footer, [role='contentinfo']"))
        };

        return {
            buttonsTotal: buttons.length,
            buttonsWithoutAccessibleName: buttonsWithoutAccessibleName.length,
            linksTotal: links.length,
            linksWithoutAccessibleName: linksWithoutAccessibleName.length,
            formControlsTotal: controls.length,
            formControlsWithoutLabel: formControlsWithoutLabel.length,
            formControlsWithPlaceholderOnly,
            imagesTotal: images.length,
            imagesWithoutAlt: imagesWithoutAlt.length,
            hasHeader: landmarks.header,
            hasMain: landmarks.main,
            hasNav: landmarks.nav,
            hasFooter: landmarks.footer,
            landmarks,
            items: {
                buttonsWithoutAccessibleName,
                linksWithoutAccessibleName,
                formControlsWithoutLabel
            }
        };
    });
}

async function auditMobileResponsive(browser, site, pagePath, url) {
    const mobilePage = await browser.newPage({
        viewport: {
            width: MOBILE_VIEWPORT.width,
            height: MOBILE_VIEWPORT.height
        }
    });

    const mobileResult = getDefaultResponsive().mobile;

    try {
        await mobilePage.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 45000
        });
        await mobilePage.waitForTimeout(STABILIZATION_WAIT_MS);

        const metrics = await mobilePage.evaluate(() => {
            const docEl = document.documentElement;
            const body = document.body;
            const documentWidth = docEl ? docEl.scrollWidth : 0;
            const viewportWidth =
                window.innerWidth || (docEl ? docEl.clientWidth : 0) || 0;
            const bodyScrollWidth = body ? body.scrollWidth : 0;
            const maxScrollWidth = Math.max(documentWidth, bodyScrollWidth);
            const overflowAmount = Math.max(0, maxScrollWidth - viewportWidth);
            const visibleTextLength = ((body && body.innerText) || "")
                .replace(/\s+/g, " ")
                .trim().length;

            return {
                documentWidth,
                viewportWidth,
                bodyScrollWidth,
                hasHorizontalOverflow: overflowAmount > 0,
                overflowAmount,
                visibleTextLength
            };
        });

        mobileResult.documentWidth = metrics.documentWidth;
        mobileResult.viewportWidth = metrics.viewportWidth;
        mobileResult.bodyScrollWidth = metrics.bodyScrollWidth;
        mobileResult.hasHorizontalOverflow = metrics.hasHorizontalOverflow;
        mobileResult.overflowAmount = metrics.overflowAmount;
        mobileResult.visibleTextLength = metrics.visibleTextLength;

        const mobileScreenshotDir = path.join(
            process.cwd(),
            "screenshots",
            site.id,
            "mobile"
        );
        ensureDir(mobileScreenshotDir);

        const screenshotFileName = getScreenshotFileName(pagePath);
        const mobileScreenshotPath = path.join(
            mobileScreenshotDir,
            screenshotFileName
        );
        mobileResult.screenshotPath = path.relative(
            process.cwd(),
            mobileScreenshotPath
        );

        await mobilePage.screenshot({
            path: mobileScreenshotPath,
            fullPage: true
        });
    } catch (error) {
        mobileResult.errors.push(error.message);
    } finally {
        await mobilePage.close();
    }

    return mobileResult;
}

function classifyLink(href, resolvedUrl, siteOrigin) {
    const rawHref = typeof href === "string" ? href.trim() : "";
    const lowerHref = rawHref.toLowerCase();

    if (!rawHref || rawHref === "#") {
        return {
            kind: "empty",
            reason: "Missing, empty, or placeholder # href."
        };
    }

    if (
        lowerHref.startsWith("mailto:") ||
        lowerHref.startsWith("tel:") ||
        lowerHref.startsWith("javascript:") ||
        rawHref.startsWith("#")
    ) {
        return {
            kind: "special",
            reason: "Special link type (mailto/tel/javascript/anchor)."
        };
    }

    if (!resolvedUrl) {
        return {
            kind: "special",
            reason: "Invalid or unresolved URL."
        };
    }

    try {
        const resolvedOrigin = new URL(resolvedUrl).origin;
        if (resolvedOrigin === siteOrigin) {
            return { kind: "internal", reason: undefined };
        }

        return { kind: "external", reason: "External origin." };
    } catch (error) {
        return {
            kind: "special",
            reason: "Invalid URL after resolution."
        };
    }
}

async function checkInternalLinkStatus(requestContext, resolvedUrl, linkStatusCache) {
    if (linkStatusCache.has(resolvedUrl)) {
        return linkStatusCache.get(resolvedUrl);
    }

    try {
        const response = await requestContext.get(resolvedUrl, {
            timeout: 20000,
            failOnStatusCode: false
        });

        const status = response ? response.status() : null;
        const item = {
            status,
            ok: typeof status === "number" ? status < 400 : false,
            reason: status === null ? "No HTTP response received." : undefined
        };

        linkStatusCache.set(resolvedUrl, item);
        return item;
    } catch (error) {
        const item = {
            status: null,
            ok: false,
            reason: `Request failed: ${error.message}`
        };

        linkStatusCache.set(resolvedUrl, item);
        return item;
    }
}

async function buildLinksData(
    page,
    site,
    pageUrl,
    linkStatusCache,
    linkCheckLimit
) {
    const siteOrigin = new URL(site.url).origin;
    const anchorItems = await page
        .locator("a")
        .evaluateAll((links) =>
            links.map((link) => ({
                href: link.getAttribute("href"),
                text: (link.textContent || "").trim()
            }))
        )
        .catch(() => []);

    const items = anchorItems.map((item) => {
        const rawHref = typeof item.href === "string" ? item.href.trim() : null;
        let resolvedUrl = null;

        if (rawHref && rawHref !== "#" && !rawHref.startsWith("#")) {
            try {
                resolvedUrl = new URL(rawHref, pageUrl).toString();
            } catch (error) {
                resolvedUrl = null;
            }
        }

        const classification = classifyLink(rawHref, resolvedUrl, siteOrigin);

        return {
            href: rawHref,
            text: item.text || "",
            resolvedUrl,
            kind: classification.kind,
            status: null,
            ok: null,
            reason: classification.reason
        };
    });

    const linksSummary = {
        total: items.length,
        internal: 0,
        external: 0,
        special: 0,
        empty: 0,
        checked: 0,
        broken: 0,
        skipped: 0,
        items
    };

    let checkedInternalCount = 0;

    for (const item of items) {
        if (item.kind === "internal") {
            linksSummary.internal += 1;

            if (
                typeof linkCheckLimit === "number" &&
                checkedInternalCount >= linkCheckLimit
            ) {
                item.reason = `Skipped because LINK_CHECK_LIMIT=${linkCheckLimit} was reached.`;
                linksSummary.skipped += 1;
                continue;
            }

            const check = await checkInternalLinkStatus(
                page.request,
                item.resolvedUrl,
                linkStatusCache
            );

            item.status = check.status;
            item.ok = check.ok;
            if (check.reason) {
                item.reason = check.reason;
            }

            linksSummary.checked += 1;
            checkedInternalCount += 1;
            if (check.ok === false) {
                linksSummary.broken += 1;
            }
            continue;
        }

        if (item.kind === "external") {
            linksSummary.external += 1;
            linksSummary.skipped += 1;
            continue;
        }

        if (item.kind === "special") {
            linksSummary.special += 1;
            linksSummary.skipped += 1;
            continue;
        }

        linksSummary.empty += 1;
        linksSummary.skipped += 1;
    }

    return linksSummary;
}

function addIssue(issues, severity, category, message) {
    issues.push({
        severity,
        category,
        message
    });
}

function buildIssues(result) {
    const issues = [];
    const { status, seo } = result;

    if (status === null || status >= 500) {
        addIssue(
            issues,
            "error",
            "technical",
            "HTTP status is missing or server error (>= 500)."
        );
    } else if (status >= 400) {
        addIssue(
            issues,
            "warning",
            "technical",
            "HTTP status is client error (4xx)."
        );
    }

    if (!seo.titlePresent) {
        addIssue(issues, "warning", "seo", "Page title is missing.");
    } else if (seo.titleLength < 20 || seo.titleLength > 70) {
        addIssue(
            issues,
            "info",
            "seo",
            `Page title length is ${seo.titleLength} (recommended 20-70).`
        );
    }

    if (!seo.descriptionPresent) {
        addIssue(issues, "warning", "seo", "Meta description is missing.");
    } else if (seo.descriptionLength < 50 || seo.descriptionLength > 170) {
        addIssue(
            issues,
            "info",
            "seo",
            `Meta description length is ${seo.descriptionLength} (recommended 50-170).`
        );
    }

    if (seo.h1Count === 0) {
        addIssue(issues, "warning", "seo", "No H1 found on the page.");
    } else if (seo.h1Count > 1) {
        addIssue(issues, "warning", "seo", `Multiple H1 tags found (${seo.h1Count}).`);
    }

    if (!seo.canonicalPresent) {
        addIssue(issues, "warning", "seo", "Canonical link is missing.");
    }

    if (!seo.htmlLangPresent) {
        addIssue(issues, "warning", "technical", "HTML lang attribute is missing.");
    }

    if (!seo.viewportPresent) {
        addIssue(issues, "warning", "technical", "Viewport meta tag is missing.");
    }

    if (!seo.openGraph.title) {
        addIssue(issues, "info", "seo", "Open Graph title is missing.");
    }

    if (!seo.openGraph.description) {
        addIssue(issues, "info", "seo", "Open Graph description is missing.");
    }

    if (!seo.openGraph.image) {
        addIssue(issues, "info", "seo", "Open Graph image is missing.");
    }

    if (result.imagesWithoutAlt.length > 0) {
        addIssue(
            issues,
            "warning",
            "accessibility",
            `Images without alt found (${result.imagesWithoutAlt.length}).`
        );
    }

    if (result.links.empty > 0) {
        addIssue(
            issues,
            "info",
            "technical",
            `Empty links found (${result.links.empty}).`
        );
    }

    if (result.links.special > 0) {
        addIssue(
            issues,
            "info",
            "technical",
            `Special links found (${result.links.special}).`
        );
    }

    const brokenInternalItems = result.links.items.filter(
        (item) => item.kind === "internal" && item.ok === false
    );
    const linkIssueSeen = new Set();

    for (const item of brokenInternalItems) {
        const identifier = `${item.resolvedUrl || item.href}|${item.status}|${item.reason || ""}`;
        if (linkIssueSeen.has(identifier)) {
            continue;
        }
        linkIssueSeen.add(identifier);

        if (typeof item.status === "number" && item.status >= 400) {
            addIssue(
                issues,
                "warning",
                "technical",
                `Internal link returns HTTP ${item.status}: ${item.resolvedUrl || item.href}`
            );
        } else {
            addIssue(
                issues,
                "error",
                "technical",
                `Internal link check failed: ${item.resolvedUrl || item.href}${
                    item.reason ? ` (${item.reason})` : ""
                }`
            );
        }
    }

    const accessibility = result.accessibility;

    if (accessibility.buttonsWithoutAccessibleName > 0) {
        addIssue(
            issues,
            "warning",
            "accessibility",
            `Buttons without accessible name: ${accessibility.buttonsWithoutAccessibleName}.`
        );
    }

    if (accessibility.linksWithoutAccessibleName > 0) {
        addIssue(
            issues,
            "warning",
            "accessibility",
            `Links without accessible name: ${accessibility.linksWithoutAccessibleName}.`
        );
    }

    if (accessibility.formControlsWithoutLabel > 0) {
        addIssue(
            issues,
            "warning",
            "accessibility",
            `Form controls without label: ${accessibility.formControlsWithoutLabel}.`
        );
    }

    if (accessibility.formControlsWithPlaceholderOnly > 0) {
        addIssue(
            issues,
            "info",
            "accessibility",
            `Form controls using placeholder as only label: ${accessibility.formControlsWithPlaceholderOnly}.`
        );
    }

    if (!accessibility.hasMain) {
        addIssue(issues, "warning", "accessibility", "Main landmark is missing.");
    }

    if (!accessibility.hasHeader) {
        addIssue(issues, "info", "accessibility", "Header landmark is missing.");
    }

    if (!accessibility.hasNav) {
        addIssue(issues, "info", "accessibility", "Nav landmark is missing.");
    }

    if (!accessibility.hasFooter) {
        addIssue(issues, "info", "accessibility", "Footer landmark is missing.");
    }

    const mobile = result.responsive.mobile;

    if (!mobile.enabled || mobile.skipped) {
        return issues;
    }

    if (mobile.errors.length > 0) {
        for (const mobileError of mobile.errors) {
            addIssue(
                issues,
                "error",
                "responsive",
                `Mobile audit failed: ${mobileError}`
            );
        }
    } else {
        if (mobile.hasHorizontalOverflow) {
            addIssue(
                issues,
                "warning",
                "responsive",
                `Mobile horizontal overflow detected (${mobile.overflowAmount}px).`
            );
        }

        if (
            typeof mobile.visibleTextLength === "number" &&
            mobile.visibleTextLength < 100
        ) {
            addIssue(
                issues,
                "info",
                "responsive",
                `Low visible text length on mobile (${mobile.visibleTextLength} characters).`
            );
        }
    }

    return issues;
}

function buildSiteSummary(siteResults) {
    const successfulPages = siteResults.filter(
        (result) =>
            typeof result.status === "number" &&
            result.status >= 200 &&
            result.status < 400 &&
            result.errors.length === 0
    ).length;

    const pagesWithErrors = siteResults.filter(
        (result) =>
            result.errors.length > 0 ||
            typeof result.status !== "number" ||
            result.status >= 400
    ).length;

    const totalErrors = siteResults.reduce(
        (count, result) => count + result.errors.length,
        0
    );

    const totalImagesWithoutAlt = siteResults.reduce(
        (count, result) => count + result.imagesWithoutAlt.length,
        0
    );

    const totalIssues = siteResults.reduce(
        (count, result) => count + result.issues.length,
        0
    );

    const totalSeoWarnings = siteResults.reduce(
        (count, result) =>
            count +
            result.issues.filter(
                (issue) => issue.category === "seo" && issue.severity === "warning"
            ).length,
        0
    );

    const totalSeoErrors = siteResults.reduce(
        (count, result) =>
            count +
            result.issues.filter(
                (issue) => issue.category === "seo" && issue.severity === "error"
            ).length,
        0
    );

    const pagesWithIssues = siteResults.filter(
        (result) => result.issues.length > 0
    ).length;

    const totalLinks = siteResults.reduce(
        (count, result) => count + result.links.total,
        0
    );

    const totalInternalLinks = siteResults.reduce(
        (count, result) => count + result.links.internal,
        0
    );

    const totalExternalLinks = siteResults.reduce(
        (count, result) => count + result.links.external,
        0
    );

    const totalBrokenLinks = siteResults.reduce(
        (count, result) => count + result.links.broken,
        0
    );

    const pagesWithBrokenLinks = siteResults.filter(
        (result) => result.links.broken > 0
    ).length;

    const pagesWithResponsiveIssues = siteResults.filter((result) =>
        result.issues.some((issue) => issue.category === "responsive")
    ).length;

    const totalResponsiveWarnings = siteResults.reduce(
        (count, result) =>
            count +
            result.issues.filter(
                (issue) =>
                    issue.category === "responsive" &&
                    issue.severity === "warning"
            ).length,
        0
    );

    const totalResponsiveErrors = siteResults.reduce(
        (count, result) =>
            count +
            result.issues.filter(
                (issue) =>
                    issue.category === "responsive" &&
                    issue.severity === "error"
            ).length,
        0
    );

    const pagesWithAccessibilityIssues = siteResults.filter((result) =>
        result.issues.some((issue) => issue.category === "accessibility")
    ).length;

    const totalAccessibilityWarnings = siteResults.reduce(
        (count, result) =>
            count +
            result.issues.filter(
                (issue) =>
                    issue.category === "accessibility" &&
                    issue.severity === "warning"
            ).length,
        0
    );

    const totalAccessibilityErrors = siteResults.reduce(
        (count, result) =>
            count +
            result.issues.filter(
                (issue) =>
                    issue.category === "accessibility" &&
                    issue.severity === "error"
            ).length,
        0
    );

    return {
        totalPagesAudited: siteResults.length,
        successfulPages,
        pagesWithErrors,
        totalErrors,
        totalImagesWithoutAlt,
        totalIssues,
        totalSeoWarnings,
        totalSeoErrors,
        pagesWithIssues,
        totalLinks,
        totalInternalLinks,
        totalExternalLinks,
        totalBrokenLinks,
        pagesWithBrokenLinks,
        pagesWithResponsiveIssues,
        totalResponsiveWarnings,
        totalResponsiveErrors,
        pagesWithAccessibilityIssues,
        totalAccessibilityWarnings,
        totalAccessibilityErrors
    };
}

function renderMarkdownReport(site, generatedAt, siteResults, summary) {
    const lines = [
        "# Website Audit Report",
        "",
        `- Site Name: ${site.name}`,
        `- Site ID: ${site.id}`,
        `- Base URL: ${site.url}`,
        `- Timestamp: ${generatedAt}`,
        "",
        "## Summary",
        "",
        `- Total pages audited: ${summary.totalPagesAudited}`,
        `- Successful pages: ${summary.successfulPages}`,
        `- Pages with errors: ${summary.pagesWithErrors}`,
        `- Total console/page/audit errors: ${summary.totalErrors}`,
        `- Total images without alt: ${summary.totalImagesWithoutAlt}`,
        `- Total issues: ${summary.totalIssues}`,
        `- Total SEO warnings: ${summary.totalSeoWarnings}`,
        `- Total SEO errors: ${summary.totalSeoErrors}`,
        `- Pages with issues: ${summary.pagesWithIssues}`,
        `- Total links: ${summary.totalLinks}`,
        `- Total internal links: ${summary.totalInternalLinks}`,
        `- Total external links: ${summary.totalExternalLinks}`,
        `- Total broken internal links: ${summary.totalBrokenLinks}`,
        `- Pages with broken links: ${summary.pagesWithBrokenLinks}`,
        `- Pages with responsive issues: ${summary.pagesWithResponsiveIssues}`,
        `- Total responsive warnings: ${summary.totalResponsiveWarnings}`,
        `- Total responsive errors: ${summary.totalResponsiveErrors}`,
        `- Pages with accessibility issues: ${summary.pagesWithAccessibilityIssues}`,
        `- Total accessibility warnings: ${summary.totalAccessibilityWarnings}`,
        `- Total accessibility errors: ${summary.totalAccessibilityErrors}`,
        "",
        "## Page Results"
    ];

    for (const result of siteResults) {
        lines.push("");
        lines.push(`### ${result.pagePath}`);
        lines.push(`- Full URL: ${result.url}`);
        lines.push(`- HTTP status: ${result.status === null ? "N/A" : result.status}`);
        lines.push(`- Title: ${result.title || "N/A"}`);
        lines.push(
            `- Meta description present: ${
                result.description && result.description.trim() ? "Yes" : "No"
            }`
        );
        lines.push(`- Meta description length: ${result.seo.descriptionLength}`);
        lines.push(
            `- H1 values: ${result.h1.length > 0 ? result.h1.join(" | ") : "None"}`
        );
        lines.push(`- Links count: ${result.linksCount}`);
        lines.push(`- Images without alt count: ${result.imagesWithoutAlt.length}`);
        lines.push(`- Screenshot path: ${result.screenshotPath}`);
        lines.push(
            `- Mobile screenshot path: ${result.responsive.mobile.screenshotPath || "Not generated"}`
        );
        lines.push(
            `- Link summary: total=${result.links.total}, internal=${result.links.internal}, external=${result.links.external}, special=${result.links.special}, empty=${result.links.empty}, checked=${result.links.checked}, broken=${result.links.broken}, skipped=${result.links.skipped}`
        );
        lines.push(
            `- Accessibility summary: buttons=${result.accessibility.buttonsTotal} (without name: ${result.accessibility.buttonsWithoutAccessibleName}), links=${result.accessibility.linksTotal} (without name: ${result.accessibility.linksWithoutAccessibleName}), form controls=${result.accessibility.formControlsTotal} (without label: ${result.accessibility.formControlsWithoutLabel}), images=${result.accessibility.imagesTotal} (without alt: ${result.accessibility.imagesWithoutAlt})`
        );
        lines.push(
            `- Landmarks: header=${result.accessibility.landmarks.header ? "Yes" : "No"}, main=${result.accessibility.landmarks.main ? "Yes" : "No"}, nav=${result.accessibility.landmarks.nav ? "Yes" : "No"}, footer=${result.accessibility.landmarks.footer ? "Yes" : "No"}`
        );
        lines.push("- Mobile responsive:");
        lines.push(
            `  - Enabled: ${result.responsive.mobile.enabled ? "Yes" : "No"}`
        );
        lines.push(
            `  - Skipped: ${result.responsive.mobile.skipped ? "Yes" : "No"}`
        );
        if (result.responsive.mobile.skipReason) {
            lines.push(`  - Skip reason: ${result.responsive.mobile.skipReason}`);
        }
        lines.push(
            `  - Viewport: ${result.responsive.mobile.viewport.width}x${result.responsive.mobile.viewport.height}`
        );
        if (result.responsive.mobile.skipped) {
            lines.push("  - Metrics: skipped");
        } else {
            lines.push(
                `  - Document width: ${
                    result.responsive.mobile.documentWidth === null
                        ? "N/A"
                        : result.responsive.mobile.documentWidth
                }`
            );
            lines.push(
                `  - Viewport width: ${
                    result.responsive.mobile.viewportWidth === null
                        ? "N/A"
                        : result.responsive.mobile.viewportWidth
                }`
            );
            lines.push(
                `  - Body scroll width: ${
                    result.responsive.mobile.bodyScrollWidth === null
                        ? "N/A"
                        : result.responsive.mobile.bodyScrollWidth
                }`
            );
            lines.push(
                `  - Horizontal overflow: ${
                    result.responsive.mobile.hasHorizontalOverflow ? "Yes" : "No"
                }`
            );
            lines.push(
                `  - Overflow amount: ${result.responsive.mobile.overflowAmount}px`
            );
            lines.push(
                `  - Visible text length: ${
                    result.responsive.mobile.visibleTextLength === null
                        ? "N/A"
                        : result.responsive.mobile.visibleTextLength
                }`
            );
        }
        lines.push("- SEO signals:");
        lines.push(
            `  - Title present: ${result.seo.titlePresent ? "Yes" : "No"} (length: ${result.seo.titleLength})`
        );
        lines.push(
            `  - Description present: ${result.seo.descriptionPresent ? "Yes" : "No"} (length: ${result.seo.descriptionLength})`
        );
        lines.push(`  - H1 count: ${result.seo.h1Count}`);
        lines.push(
            `  - Canonical present: ${result.seo.canonicalPresent ? "Yes" : "No"}`
        );
        lines.push(
            `  - Robots present: ${result.seo.robotsPresent ? "Yes" : "No"}`
        );
        lines.push(
            `  - HTML lang present: ${result.seo.htmlLangPresent ? "Yes" : "No"}`
        );
        lines.push(
            `  - Viewport present: ${result.seo.viewportPresent ? "Yes" : "No"}`
        );
        lines.push(
            `  - Open Graph present: ${result.seo.openGraphPresent ? "Yes" : "No"}`
        );
        lines.push(
            `  - Open Graph fields: title=${result.seo.openGraph.title ? "Yes" : "No"}, description=${result.seo.openGraph.description ? "Yes" : "No"}, image=${result.seo.openGraph.image ? "Yes" : "No"}, url=${result.seo.openGraph.url ? "Yes" : "No"}, type=${result.seo.openGraph.type ? "Yes" : "No"}`
        );

        if (result.errors.length > 0) {
            lines.push("- Errors:");
            for (const errorItem of result.errors) {
                lines.push(`  - [${errorItem.type}] ${errorItem.message}`);
            }
        } else {
            lines.push("- Errors: None");
        }

        if (result.issues.length > 0) {
            lines.push("- Issues:");
            for (const issue of result.issues) {
                lines.push(`  - [${issue.severity}][${issue.category}] ${issue.message}`);
            }
        } else {
            lines.push("- Issues: None");
        }

        const brokenInternalLinks = result.links.items.filter(
            (item) => item.kind === "internal" && item.ok === false
        );
        if (brokenInternalLinks.length > 0) {
            lines.push("- Broken internal links:");
            for (const item of brokenInternalLinks) {
                lines.push(
                    `  - ${item.resolvedUrl || item.href} (status: ${
                        item.status === null ? "N/A" : item.status
                    }${item.reason ? `; reason: ${item.reason}` : ""})`
                );
            }
        }
    }

    lines.push("");
    return lines.join("\n");
}

async function auditPage(
    browser,
    site,
    pagePath,
    linkStatusCache,
    linkCheckLimit,
    mobileAuditEnabled
) {
    const url = normalizeUrl(site.url, pagePath);
    const page = await browser.newPage({
        viewport: {
            width: 1440,
            height: 1100
        }
    });

    const result = {
        siteId: site.id,
        siteName: site.name,
        url,
        pagePath,
        status: null,
        title: null,
        description: null,
        h1: [],
        linksCount: 0,
        links: getDefaultLinks(),
        imagesWithoutAlt: [],
        screenshotPath: null,
        responsive: getDefaultResponsive(),
        accessibility: getDefaultAccessibility(),
        seo: null,
        issues: [],
        errors: [],
        timestamp: new Date().toISOString()
    };

    page.on("console", (msg) => {
        if (msg.type() === "error") {
            result.errors.push({
                type: "console",
                message: msg.text()
            });
        }
    });

    page.on("pageerror", (error) => {
        result.errors.push({
            type: "pageerror",
            message: error.message
        });
    });

    let mobileAuditCompleted = false;
    if (!mobileAuditEnabled) {
        result.responsive.mobile.enabled = false;
        result.responsive.mobile.skipped = true;
        result.responsive.mobile.skipReason = "Skipped because MOBILE_AUDIT=0.";
    }

    try {
        const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 45000
        });
        await page.waitForTimeout(STABILIZATION_WAIT_MS);

        result.status = response ? response.status() : null;
        result.title = await page.title();

        result.description = await page
            .locator('meta[name="description"]')
            .getAttribute("content")
            .catch(() => null);

        result.h1 = await page
            .locator("h1")
            .allTextContents()
            .catch(() => []);

        result.linksCount = await page
            .locator("a")
            .count()
            .catch(() => 0);

        result.imagesWithoutAlt = await page
            .locator("img:not([alt]), img[alt='']")
            .evaluateAll((imgs) =>
                imgs.map((img) => ({
                    src: img.getAttribute("src"),
                    className: img.getAttribute("class")
                }))
            )
            .catch(() => []);

        result.accessibility = await collectAccessibilityData(page).catch(() =>
            getDefaultAccessibility()
        );

        result.links = await buildLinksData(
            page,
            site,
            url,
            linkStatusCache,
            linkCheckLimit
        );

        const rawSeo = {
            canonical: await getAttributeSafe(page, 'link[rel="canonical"]', "href"),
            robots: await getAttributeSafe(page, 'meta[name="robots"]', "content"),
            htmlLang: await getAttributeSafe(page, "html", "lang"),
            viewport: await getAttributeSafe(page, 'meta[name="viewport"]', "content"),
            openGraph: {
                title: await getAttributeSafe(page, 'meta[property="og:title"]', "content"),
                description: await getAttributeSafe(
                    page,
                    'meta[property="og:description"]',
                    "content"
                ),
                image: await getAttributeSafe(page, 'meta[property="og:image"]', "content"),
                url: await getAttributeSafe(page, 'meta[property="og:url"]', "content"),
                type: await getAttributeSafe(page, 'meta[property="og:type"]', "content")
            }
        };

        result.seo = buildSeoData(result, rawSeo);

        const screenshotDir = path.join(process.cwd(), "screenshots", site.id);

        ensureDir(screenshotDir);
        const screenshotFileName = getScreenshotFileName(pagePath);
        const screenshotFullPath = path.join(screenshotDir, screenshotFileName);
        result.screenshotPath = path.relative(process.cwd(), screenshotFullPath);

        await page.screenshot({
            path: screenshotFullPath,
            fullPage: true
        });

        if (mobileAuditEnabled) {
            result.responsive.mobile = await auditMobileResponsive(
                browser,
                site,
                pagePath,
                url
            );
            result.responsive.mobile.enabled = true;
            result.responsive.mobile.skipped = false;
            result.responsive.mobile.skipReason = null;
            mobileAuditCompleted = true;
        }

        result.issues = buildIssues(result);
    } catch (error) {
        result.errors.push({
            type: "audit",
            message: error.message
        });
    } finally {
        if (!result.seo) {
            result.seo = buildDefaultSeo();
        }

        if (!result.responsive) {
            result.responsive = getDefaultResponsive();
        }

        if (!result.accessibility) {
            result.accessibility = getDefaultAccessibility();
        }

        if (mobileAuditEnabled && !mobileAuditCompleted) {
            result.responsive.mobile = await auditMobileResponsive(
                browser,
                site,
                pagePath,
                url
            );
            result.responsive.mobile.enabled = true;
            result.responsive.mobile.skipped = false;
            result.responsive.mobile.skipReason = null;
            mobileAuditCompleted = true;
        }

        if (result.issues.length === 0) {
            result.issues = buildIssues(result);
        }

        await page.close();
    }

    return result;
}

async function main() {
    const selectedSites = getSelectedSites(sitesConfig.sites);

    if (selectedSites.length === 0) {
        process.exit(1);
    }

    const browser = await chromium.launch({
        headless: true
    });

    const runTimestampIso = new Date().toISOString();
    const reportTimestamp = toReportTimestamp(runTimestampIso);
    const linkCheckLimit = getLinkCheckLimit();
    const mobileAuditEnabled = getMobileAuditEnabled();

    for (const site of selectedSites) {
        console.log(`\nAuditing: ${site.name}`);
        const siteResults = [];
        const linkStatusCache = new Map();

        for (const pagePath of site.pages) {
            console.log(`  ${pagePath}`);

            const result = await auditPage(
                browser,
                site,
                pagePath,
                linkStatusCache,
                linkCheckLimit,
                mobileAuditEnabled
            );
            siteResults.push(result);
        }

        const summary = buildSiteSummary(siteResults);
        const siteReportDir = path.join(process.cwd(), "reports", site.id);
        ensureDir(siteReportDir);

        const jsonReportPath = path.join(siteReportDir, `audit-${reportTimestamp}.json`);

        const markdownReportPath = path.join(siteReportDir, `audit-${reportTimestamp}.md`);

        const jsonPayload = {
            reportTitle: "Website Audit Report",
            siteName: site.name,
            siteId: site.id,
            baseUrl: site.url,
            timestamp: runTimestampIso,
            summary,
            pages: siteResults
        };

        fs.writeFileSync(jsonReportPath, JSON.stringify(jsonPayload, null, 2), "utf8");
        fs.writeFileSync(
            markdownReportPath,
            renderMarkdownReport(site, runTimestampIso, siteResults, summary),
            "utf8"
        );

        console.log(`  JSON report: ${jsonReportPath}`);
        console.log(`  Markdown report: ${markdownReportPath}`);
    }

    await browser.close();

    console.log("\nAudit completed.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
