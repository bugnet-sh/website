import { Markdown } from "../../lib/content/markdown";
import { tocOf } from "../../lib/content/toc";
import { Band, Frame } from "../shell/frame";
import { OnThisPage } from "./on-this-page";

/** One reading column, with the On this page list against the frame's right edge on desktop. */
export function ArticlePage({ updated, source }: { updated?: string; source: string }) {
    return (
        <main>
            <Band rail={false}>
                <Frame className="grid grid-cols-[minmax(0,1fr)_var(--toc)] gap-x-(--space-7) pt-(--band) pb-(--band) narrow:grid-cols-1">
                    <article className="max-w-(--article) text-(length:--ui-size) leading-(--prose-line)">
                        {updated && (
                            <p className="mb-(--space-3) text-(length:--fine-size) leading-(--fine-line) text-text-muted">
                                {updated}
                            </p>
                        )}
                        <Markdown source={source} />
                    </article>
                    <aside className="sticky top-[calc(var(--nav)+var(--space-6))] max-h-[calc(100svh-var(--nav)-2*var(--space-6))] self-start overflow-y-auto narrow:hidden">
                        <OnThisPage items={tocOf(source)} />
                    </aside>
                </Frame>
            </Band>
        </main>
    );
}
