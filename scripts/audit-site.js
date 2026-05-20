const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const sitesConfig = require("../configs/sites.json");

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

        await page.screenshot({
            path: path.join(
                screenshotDir,
                `${pagePath === "/" ? "home" : pagePath.replace(/\//g, "_")}.png`
            ),
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

    const allResults = [];

    for (const site of selectedSites) {
        console.log(`\nAuditing: ${site.name}`);

        for (const pagePath of site.pages) {
            console.log(`  ${pagePath}`);

            const result = await auditPage(browser, site, pagePath);
            allResults.push(result);
        }
    }

    await browser.close();

    const reportsDir = path.join(process.cwd(), "reports");
    ensureDir(reportsDir);

    const reportPath = path.join(
        reportsDir,
        `audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );

    fs.writeFileSync(reportPath, JSON.stringify(allResults, null, 2), "utf8");

    console.log(`\nAudit completed.`);
    console.log(`Report saved to: ${reportPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
