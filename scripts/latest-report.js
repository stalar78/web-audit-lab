const fs = require("fs");
const path = require("path");

const sitesConfig = require("../configs/sites.json");

function getRequestedSiteIds() {
    const inputIds = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);
    if (inputIds.length > 0) {
        return inputIds;
    }

    return sitesConfig.sites.map((site) => site.id);
}

function validateSiteIds(requestedIds, availableSites) {
    const availableIds = availableSites.map((site) => site.id);
    const unknownIds = requestedIds.filter((id) => !availableIds.includes(id));

    if (unknownIds.length > 0) {
        console.error(`Unknown site id(s): ${unknownIds.join(", ")}`);
        console.error(`Available site ids: ${availableIds.join(", ")}`);
        process.exit(1);
    }
}

function getLatestMarkdownReportPath(siteId) {
    const siteReportsDir = path.join(process.cwd(), "reports", siteId);

    if (!fs.existsSync(siteReportsDir)) {
        return null;
    }

    const markdownFiles = fs
        .readdirSync(siteReportsDir)
        .filter((fileName) => fileName.toLowerCase().endsWith(".md"))
        .map((fileName) => {
            const fullPath = path.join(siteReportsDir, fileName);
            const stats = fs.statSync(fullPath);
            return {
                fileName,
                fullPath,
                mtimeMs: stats.mtimeMs
            };
        });

    if (markdownFiles.length === 0) {
        return null;
    }

    markdownFiles.sort((a, b) => {
        if (b.mtimeMs !== a.mtimeMs) {
            return b.mtimeMs - a.mtimeMs;
        }

        return b.fileName.localeCompare(a.fileName);
    });

    return markdownFiles[0].fullPath;
}

function main() {
    const requestedSiteIds = getRequestedSiteIds();
    validateSiteIds(requestedSiteIds, sitesConfig.sites);

    for (const siteId of requestedSiteIds) {
        const latestReportPath = getLatestMarkdownReportPath(siteId);

        if (latestReportPath) {
            console.log(`${siteId}: ${latestReportPath}`);
        } else {
            console.log(`${siteId}: no Markdown reports found yet in reports/${siteId}/`);
        }
    }
}

main();
