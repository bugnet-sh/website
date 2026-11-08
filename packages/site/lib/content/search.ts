/** One h2 or h3 section of a docs page, or the page's lead, whose heading is the title. */
export type SearchEntry = {
    page: string;
    title: string;
    heading: string;
    id: string;
    text: string;
};

const LIMIT = 8;

export function entryHref(entry: SearchEntry): string {
    return entry.id ? `${entry.page}#${entry.id}` : entry.page;
}

/** 0 for a page title, 1 for a heading, 2 for body text; undefined when nothing matches. */
function rank(entry: SearchEntry, query: string): number | undefined {
    const has = (field: string) => field.toLowerCase().includes(query);
    // A section is found by its page's title through the page's lead, so a title query does not
    // fill every result with one page
    if (entry.heading === entry.title && has(entry.title)) return 0;
    if (has(entry.heading)) return 1;
    if (has(entry.text)) return 2;
    return undefined;
}

/** The best matches for a query, case-insensitive, in index order within each rank. */
export function search(entries: readonly SearchEntry[], query: string): SearchEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return entries
        .flatMap((entry) => {
            const r = rank(entry, q);
            return r === undefined ? [] : [{ entry, r }];
        })
        .sort((a, b) => a.r - b.r)
        .slice(0, LIMIT)
        .map(({ entry }) => entry);
}
