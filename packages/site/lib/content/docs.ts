export type Doc = { title: string; slug: string; file: string };

/** The docs in reading order. Install is the docs' front page, so its slug is empty. */
export const docs: readonly Doc[] = [
    { title: "Install", slug: "", file: "install.md" },
    { title: "Before you pay", slug: "before-you-pay", file: "before-you-pay.md" },
    { title: "Paying", slug: "paying", file: "paying.md" },
    { title: "Tools", slug: "tools", file: "tools.md" },
    { title: "Limits", slug: "limits", file: "limits.md" },
    { title: "Safety", slug: "safety", file: "safety.md" },
    { title: "Watching a run", slug: "watching-a-run", file: "watching-a-run.md" },
    { title: "FAQ", slug: "faq", file: "faq.md" },
];

export function docHref(doc: Doc): string {
    return doc.slug ? `/docs/${doc.slug}/` : "/docs/";
}

export function docBySlug(slug: string): Doc | undefined {
    return docs.find((doc) => doc.slug === slug);
}

export function prevNext(slug: string): { prev?: Doc; next?: Doc } {
    const at = docs.findIndex((doc) => doc.slug === slug);
    return { prev: at > 0 ? docs[at - 1] : undefined, next: at >= 0 ? docs[at + 1] : undefined };
}
