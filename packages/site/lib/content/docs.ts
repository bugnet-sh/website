export const docGroups = ["Start", "Paying", "Using Bugnet", "Safety", "Help"] as const;

export type DocGroup = (typeof docGroups)[number];

export type Doc = { title: string; slug: string; file: string; group: DocGroup };

/**
 * The docs in reading order, which is the sidebar's: each group's pages together, the groups in
 * `docGroups` order. Get started is the docs' front page, so its slug is empty.
 */
export const docs: readonly Doc[] = [
    { title: "Get started", slug: "", file: "get-started.md", group: "Start" },
    { title: "Install", slug: "install", file: "install.md", group: "Start" },
    { title: "Before you pay", slug: "before-you-pay", file: "before-you-pay.md", group: "Paying" },
    { title: "Paying", slug: "paying", file: "paying.md", group: "Paying" },
    { title: "Tools", slug: "tools", file: "tools.md", group: "Using Bugnet" },
    { title: "Limits", slug: "limits", file: "limits.md", group: "Using Bugnet" },
    {
        title: "Watching a run",
        slug: "watching-a-run",
        file: "watching-a-run.md",
        group: "Using Bugnet",
    },
    { title: "Safety", slug: "safety", file: "safety.md", group: "Safety" },
    { title: "FAQ", slug: "faq", file: "faq.md", group: "Help" },
    { title: "Roadmap", slug: "roadmap", file: "roadmap.md", group: "Help" },
];

/** The sidebar's groups, each with its pages in reading order. */
export function docsByGroup(): { group: DocGroup; docs: Doc[] }[] {
    return docGroups.map((group) => ({ group, docs: docs.filter((doc) => doc.group === group) }));
}

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
