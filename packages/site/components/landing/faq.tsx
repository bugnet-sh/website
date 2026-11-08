import { useId } from "react";
import { readDoc } from "../../lib/content/doc-file";
import { docBySlug, type Doc } from "../../lib/content/docs";
import { Markdown } from "../../lib/content/markdown";
import { landingFaq, type FaqItem } from "../../lib/landing/faq";
import { Link } from "../content/link";
import { Band, Frame } from "../shell/frame";
import { supportEmail } from "../shell/links";
import { FaqList } from "./faq-list";
import { LandingTitle } from "./title";

/**
 * The questions beside a heading that stays under the header while they scroll past, split by the
 * same 1 px grid gap as Contact below, so the two column lines meet; stacked on tablets and phones,
 * where nothing sticks.
 */
export function FaqBand({ items }: { items: FaqItem[] }) {
    const id = useId();
    return (
        <Band as="div" id="faq" rail={false}>
            <Frame padded={false}>
                <section
                    aria-labelledby={id}
                    className="grid grid-cols-3 gap-(--hairline) bg-line tablet:grid-cols-1 tablet:gap-0"
                >
                    <div className="bg-bg py-(--band) pr-(--space-6) pl-(--pad) tablet:pr-(--pad) tablet:pb-(--space-6)">
                        <div className="sticky top-[calc(var(--nav)+var(--space-6))] tablet:static">
                            <LandingTitle id={id}>FAQ</LandingTitle>
                            <p className="mt-(--space-4) text-(length:--lead-size) leading-(--lead-line) text-text-muted">
                                If you have more questions, read our{" "}
                                <Link href="/docs/">documentation</Link> or email us at{" "}
                                <Link href={`mailto:${supportEmail}`}>{supportEmail}</Link>.
                            </p>
                        </div>
                    </div>
                    <div className="col-span-2 bg-bg py-(--band) tablet:col-span-1 tablet:pt-0">
                        <FaqList
                            items={items.map((item) => ({
                                id: item.id,
                                question: item.question,
                                answer: <Markdown source={item.answer} />,
                            }))}
                        />
                    </div>
                </section>
            </Frame>
        </Band>
    );
}

/** The landing page's FAQ, read from the docs' FAQ page at build time. */
export function Faq() {
    return <FaqBand items={landingFaq(readDoc(docBySlug("faq") as Doc).body)} />;
}
