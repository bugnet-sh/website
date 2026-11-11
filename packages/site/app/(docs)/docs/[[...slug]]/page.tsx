import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OnThisPage } from "../../../../components/content/on-this-page";
import { PrevNext } from "../../../../components/docs/prev-next";
import { Sidebar } from "../../../../components/docs/sidebar";
import { Band, Frame } from "../../../../components/shell/frame";
import { CopyButton } from "../../../../components/stats/copy-button";
import { readDoc } from "../../../../lib/content/doc-file";
import { cleanMarkdown } from "../../../../lib/content/doc-markdown";
import { docBySlug, docHref, docs, type Doc } from "../../../../lib/content/docs";
import { Markdown } from "../../../../lib/content/markdown";
import { describe, pageMetadata } from "../../../../lib/content/meta";
import { tocOf } from "../../../../lib/content/toc";

type Props = { params: Promise<{ slug?: string[] }> };

export const dynamicParams = false;

export function generateStaticParams(): { slug: string[] }[] {
    return docs.map((doc) => ({ slug: doc.slug ? [doc.slug] : [] }));
}

async function docOf(params: Props["params"]): Promise<Doc> {
    const doc = docBySlug((await params).slug?.join("/") ?? "");
    if (!doc) notFound();
    return doc;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const doc = await docOf(params);
    return pageMetadata(docHref(doc), doc.title, describe(readDoc(doc).body));
}

// The rail the sidebar and On this page list stick to, under the sticky header
const rail =
    "sticky top-[calc(var(--nav)+var(--space-6))] max-h-[calc(100svh-var(--nav)-2*var(--space-6))] self-start";

export default async function DocPage({ params }: Props) {
    const doc = await docOf(params);
    const { body } = readDoc(doc);
    const toc = tocOf(body);
    return (
        <main>
            <Band rail={false}>
                <Frame className="grid grid-cols-[var(--sidebar)_minmax(0,1fr)_var(--toc)] gap-x-(--space-7) pt-(--band) pb-(--band) narrow:grid-cols-[var(--sidebar)_minmax(0,1fr)] tablet:grid-cols-1">
                    <aside
                        className={`${rail} flex flex-col tablet:static tablet:mb-(--space-6) tablet:max-h-none`}
                    >
                        <Sidebar current={doc.slug} />
                    </aside>
                    <div className="min-w-0">
                        <article className="max-w-(--article) text-(length:--prose-size) leading-(--prose-line) text-prose">
                            <Markdown
                                source={body}
                                look="article"
                                titleLabel={
                                    <span className="bg-code-inline px-(--space-2) py-(--space-1) text-(length:--fine-size) leading-(--fine-line) tracking-(--caps-tracking) text-text-muted uppercase">
                                        {doc.group}
                                    </span>
                                }
                                titleAction={
                                    <CopyButton
                                        text={cleanMarkdown(doc, body)}
                                        label="Copy Markdown"
                                        form="labelled"
                                    />
                                }
                            />
                        </article>
                        <div className="max-w-(--article)">
                            <PrevNext slug={doc.slug} />
                        </div>
                    </div>
                    <aside className={`${rail} overflow-y-auto scrollbar-hidden narrow:hidden`}>
                        {toc.length > 0 && <OnThisPage items={toc} />}
                    </aside>
                </Frame>
            </Band>
        </main>
    );
}
