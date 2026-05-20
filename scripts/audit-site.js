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

    return {
        totalPagesAudited: siteResults.length,
        successfulPages,
        pagesWithErrors,
        totalErrors,
        totalImagesWithoutAlt
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
        lines.push(
            `- H1 values: ${result.h1.length > 0 ? result.h1.join(" | ") : "None"}`
        );
        lines.push(`- Links count: ${result.linksCount}`);
        lines.push(`- Images without alt count: ${result.imagesWithoutAlt.length}`);
        lines.push(`- Screenshot path: ${result.screenshotPath}`);

        if (result.errors.length > 0) {
            lines.push("- Errors:");
            for (const errorItem of result.errors) {
                lines.push(`  - [${errorItem.type}] ${errorItem.message}`);
            }
        } else {
            lines.push("- Errors: None");
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
