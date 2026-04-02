import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const DIST_SW_PATH = path.join(DIST_DIR, 'sw.js');

async function getHtmlFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await getHtmlFiles(fullPath));
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.html')) {
            files.push(fullPath);
        }
    }

    return files;
}

function patchHtml(html) {
    return html.replace(
        /<script\s+src="(\/_expo\/static\/js\/web\/[^"]+\.js)"\s+defer><\/script>/g,
        '<script type="module" src="$1" defer></script>'
    );
}

function resolveBuildSha() {
    const fromEnv = process.env.EXPO_PUBLIC_BUILD_SHA?.trim() || process.env.BUILD_SHA?.trim();
    if (fromEnv) {
        return fromEnv;
    }

    try {
        return execSync('git rev-parse --short HEAD', {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'ignore'],
            encoding: 'utf8',
        }).trim();
    } catch {
        return `local-${Date.now().toString(36)}`;
    }
}

async function main() {
    const htmlFiles = await getHtmlFiles(DIST_DIR);
    let patchedCount = 0;
    const buildSha = resolveBuildSha();

    for (const filePath of htmlFiles) {
        const original = await readFile(filePath, 'utf8');
        const patched = patchHtml(original);

        if (patched !== original) {
            await writeFile(filePath, patched, 'utf8');
            patchedCount += 1;
        }
    }

    try {
        const swOriginal = await readFile(DIST_SW_PATH, 'utf8');
        const swPatched = swOriginal.replace(/__FEEDS_BUILD_SHA__/g, buildSha);
        if (swPatched !== swOriginal) {
            await writeFile(DIST_SW_PATH, swPatched, 'utf8');
        }
    } catch (error) {
        console.warn(`Skipped service worker build id patch (${error instanceof Error ? error.message : String(error)})`);
    }

    console.log(`Patched ${patchedCount} HTML file(s) to use module scripts.`);
    console.log(`Using service worker build id: ${buildSha}`);
}

main().catch((error) => {
    console.error('Failed to patch web entry scripts:', error);
    process.exit(1);
});
