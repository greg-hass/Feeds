import * as cheerio from 'cheerio';

export interface OPMLFeed {
    title: string;
    xmlUrl: string;
    htmlUrl?: string;
    folder?: string;
}

export interface OPMLFolder {
    name: string;
}

export function parseOPML(xml: string): { folders: OPMLFolder[]; feeds: OPMLFeed[] } {
    const $ = cheerio.load(xml, { xmlMode: true });

    const folders: OPMLFolder[] = [];
    const feeds: OPMLFeed[] = [];
    const seenFolders = new Set<string>();

    // Process outlines
    $('outline').each((_, el) => {
        const $el = $(el);
        const xmlUrl = $el.attr('xmlUrl') || $el.attr('xmlurl');
        const type = $el.attr('type');

        // If it has xmlUrl, it's a feed
        if (xmlUrl) {
            const parentFolder = $el.parent('outline').attr('text') ||
                $el.parent('outline').attr('title');

            feeds.push({
                title: $el.attr('text') || $el.attr('title') || xmlUrl,
                xmlUrl,
                htmlUrl: $el.attr('htmlUrl') || $el.attr('htmlurl'),
                folder: parentFolder || undefined,
            });

            // Track the folder
            if (parentFolder && !seenFolders.has(parentFolder)) {
                seenFolders.add(parentFolder);
                folders.push({ name: parentFolder });
            }
        }
        // If it has children and no xmlUrl, it's a folder
        else if ($el.children('outline').length > 0) {
            const folderName = $el.attr('text') || $el.attr('title');
            if (folderName && !seenFolders.has(folderName)) {
                seenFolders.add(folderName);
                folders.push({ name: folderName });
            }
        }
    });

    return { folders, feeds };
}

export function generateOPML(folders: OPMLFolder[], feeds: OPMLFeed[], title: string = 'Feeds Export'): string {
    const now = new Date().toISOString();

    // Group feeds by folder
    const feedsByFolder = new Map<string | undefined, OPMLFeed[]>();

    for (const feed of feeds) {
        const key = feed.folder;
        if (!feedsByFolder.has(key)) {
            feedsByFolder.set(key, []);
        }
        feedsByFolder.get(key)!.push(feed);
    }

    // Build OPML structure
    let opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(title)}</title>
    <dateCreated>${now}</dateCreated>
  </head>
  <body>
`;

    // Add uncategorized feeds first
    const uncategorized = feedsByFolder.get(undefined) || [];
    for (const feed of uncategorized) {
        opml += `    <outline type="rss" text="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.xmlUrl)}"${feed.htmlUrl ? ` htmlUrl="${escapeXml(feed.htmlUrl)}"` : ''}/>\n`;
    }

    // Add folders with their feeds
    for (const folder of folders) {
        const folderFeeds = feedsByFolder.get(folder.name) || [];
        if (folderFeeds.length === 0) continue;

        opml += `    <outline text="${escapeXml(folder.name)}">\n`;
        for (const feed of folderFeeds) {
            opml += `      <outline type="rss" text="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.xmlUrl)}"${feed.htmlUrl ? ` htmlUrl="${escapeXml(feed.htmlUrl)}"` : ''}/>\n`;
        }
        opml += `    </outline>\n`;
    }

    opml += `  </body>
</opml>`;

    return opml;
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
