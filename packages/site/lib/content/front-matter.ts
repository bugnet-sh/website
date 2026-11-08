const BLOCK = /^---\n([\s\S]*?)\n---\n*/;

export type FrontMatter = { title: string; sources: string[] };

/**
 * A docs file's front matter and body. Only the two keys the docs use are read: `title`, and
 * `sources` as a list of `- item` lines or `[]`.
 */
export function frontMatter(source: string, file: string): FrontMatter & { body: string } {
    const match = BLOCK.exec(source);
    if (!match) throw new Error(`${file}: no front matter`);
    let title: string | undefined;
    const sources: string[] = [];
    let inSources = false;
    for (const line of (match[1] ?? "").split("\n")) {
        const item = /^\s+-\s+(.+)$/.exec(line);
        if (inSources && item) {
            sources.push(item[1] ?? "");
            continue;
        }
        inSources = false;
        const pair = /^(\w+):\s*(.*)$/.exec(line);
        if (pair?.[1] === "title") title = pair[2];
        else if (pair?.[1] === "sources") inSources = pair[2] !== "[]";
    }
    if (!title) throw new Error(`${file}: front matter has no title`);
    return { title, sources, body: source.slice(match[0].length) };
}
