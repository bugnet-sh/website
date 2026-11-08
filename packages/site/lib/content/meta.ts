import type { Metadata } from "next";

const MAX = 155;

/** What a link preview says, sized as a result snippet. */
export function pageMetadata(
    path: string,
    title: string | undefined,
    description: string,
): Metadata {
    return {
        ...(title !== undefined && { title }),
        description,
        alternates: { canonical: path },
        openGraph: {
            siteName: "Bugnet",
            type: "website",
            url: path,
            ...(title !== undefined && { title }),
            description,
            images: [{ url: "/og.png", width: 1200, height: 630, alt: "Bugnet" }],
        },
        twitter: {
            card: "summary_large_image",
            site: "@bugnetsh",
            ...(title !== undefined && { title }),
            description,
            images: ["/og.png"],
        },
    };
}

/** Markdown reduced to the words a reader sees. */
function plain(markdown: string): string {
    return markdown
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[`*_]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/** The first paragraph of a docs page, cut to 155 characters at a word boundary. */
export function describe(body: string): string {
    const first = body
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .find((block) => block !== "" && !/^(#|[-*>|]|\d+\.|```)/.test(block));
    const text = plain(first ?? "");
    if (text.length <= MAX) return text;
    const cut = text.slice(0, MAX + 1);
    return cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:.-]+$/, "");
}
