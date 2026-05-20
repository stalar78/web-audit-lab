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

    return {
        totalPagesAudited: siteResults.length,
        successfulPages,
        pagesWithErrors,
        totalErrors,
        totalImagesWithoutAlt,
        totalIssues,
        totalSeoWarnings,
        totalSeoErrors,
        pagesWithIssues
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
    }

    lines.push("");
    return lines.join("\n");
}

async function auditPage(browser, site, pagePath) {
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
            waitUntil: "networkidle",
            timeout: 45000
        });

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

        const screenshotDir = path.join(
            process.cwd(),
            "screenshots",
            site.id
        );

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
            result.seo = buildSeoData(result, {
                canonical: null,
                robots: null,
                htmlLang: null,
                viewport: null,
                openGraph: {
                    title: null,
                    description: null,
                    image: null,
                    url: null,
                    type: null
                }
            });
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

    for (const site of selectedSites) {
        console.log(`\nAuditing: ${site.name}`);
        const siteResults = [];

        for (const pagePath of site.pages) {
            console.log(`  ${pagePath}`);

            const result = await auditPage(browser, site, pagePath);
            siteResults.push(result);
        }

        const summary = buildSiteSummary(siteResults);
        const siteReportDir = path.join(process.cwd(), "reports", site.id);
        ensureDir(siteReportDir);

        const jsonReportPath = path.join(
            siteReportDir,
            `audit-${reportTimestamp}.json`
        );

        const markdownReportPath = path.join(
            siteReportDir,
            `audit-${reportTimestamp}.md`
        );

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

    console.log(`\nAudit completed.`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
