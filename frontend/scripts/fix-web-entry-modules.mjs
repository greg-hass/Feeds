import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIST_DIR = path.resolve(process.cwd(), 'dist');

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

async function main() {
    const htmlFiles = await getHtmlFiles(DIST_DIR);
    let patchedCount = 0;

    for (const filePath of htmlFiles) {
        const original = await readFile(filePath, 'utf8');
        const patched = patchHtml(original);

        if (patched !== original) {
            await writeFile(filePath, patched, 'utf8');
            patchedCount += 1;
        }
    }

    console.log(`Patched ${patchedCount} HTML file(s) to use module scripts.`);
}

main().catch((error) => {
    console.error('Failed to patch web entry scripts:', error);
    process.exit(1);
});
