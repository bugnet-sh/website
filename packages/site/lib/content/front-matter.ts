const BLOCK = /^---\n([\s\S]*?)\n---\n*/;

export type FrontMatter = { title: string };

/** A docs file's front matter and body. Only `title` is read. */
export function frontMatter(source: string, file: string): FrontMatter & { body: string } {
    const match = BLOCK.exec(source);
    if (!match) throw new Error(`${file}: no front matter`);
    let title: string | undefined;
    for (const line of (match[1] ?? "").split("\n")) {
        const pair = /^(\w+):\s*(.*)$/.exec(line);
        if (pair?.[1] === "title") title = pair[2];
    }
    if (!title) throw new Error(`${file}: front matter has no title`);
    return { title, body: source.slice(match[0].length) };
}
