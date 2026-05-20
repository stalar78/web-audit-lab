const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const sitesConfig = require("../configs/sites.json");

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
            "technical",
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
        pagesWithBrokenLinks
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
            `- Link summary: total=${result.links.total}, internal=${result.links.internal}, external=${result.links.external}, special=${result.links.special}, empty=${result.links.empty}, checked=${result.links.checked}, broken=${result.links.broken}, skipped=${result.links.skipped}`
        );
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
    linkCheckLimit
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

    try {
        const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 45000
        });
        await page.waitForTimeout(2000);

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
        result.issues = buildIssues(result);

        const screenshotDir = path.join(process.cwd(), "screenshots", site.id);

        ensureDir(screenshotDir);
        const screenshotFileName = getScreenshotFileName(pagePath);
        const screenshotFullPath = path.join(screenshotDir, screenshotFileName);
        result.screenshotPath = path.relative(process.cwd(), screenshotFullPath);

        await page.screenshot({
            path: screenshotFullPath,
            fullPage: true
        });
    } catch (error) {
        result.errors.push({
            type: "audit",
            message: error.message
        });
    } finally {
        if (!result.seo) {
            result.seo = buildDefaultSeo();
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
                linkCheckLimit
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
