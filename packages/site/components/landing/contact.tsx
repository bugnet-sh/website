import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useId } from "react";
import { cx } from "../../lib/cx";
import { Band, Frame } from "../shell/frame";
import { github, supportEmail } from "../shell/links";

/** A small row's arrow, which moves a little toward where its link goes on hover. */
const rowArrow =
    "block size-(--contact-row-arrow) shrink-0 transition-transform duration-300 motion-reduce:transition-none";

const row =
    "group flex min-h-(--contact-row) items-center justify-between gap-(--space-4) bg-bg pr-(--space-6) pl-(--pad) font-mono text-(length:--ui-size) leading-(--ui-line) hover:bg-surface-hover focus-visible:-outline-offset-(--ring) phone:pr-(--pad)";

/**
 * The last band: a large Contact us that emails support, and the docs and GitHub as two rows
 * beside it. The big link comes first on phones, where the rows stack under it.
 */
export function Contact() {
    const id = useId();
    return (
        <Band as="div" id="contact" rail={false}>
            <Frame padded={false}>
                <section
                    aria-labelledby={id}
                    className="grid grid-cols-3 gap-(--hairline) bg-line phone:grid-cols-1"
                >
                    <a
                        href={`mailto:${supportEmail}`}
                        className="group col-span-2 col-start-2 row-start-1 flex items-center justify-between gap-(--space-5) bg-bg py-(--space-7) pr-(--pad) pl-(--space-7) hover:text-accent focus-visible:-outline-offset-(--ring) phone:col-span-1 phone:col-start-auto phone:row-start-auto phone:pl-(--pad)"
                    >
                        <h2
                            id={id}
                            className="font-head text-(length:--hero-size) leading-(--hero-line) font-extralight"
                        >
                            Contact us
                        </h2>
                        <ArrowRight
                            aria-hidden="true"
                            strokeWidth={1.5}
                            className="block size-(--contact-arrow) shrink-0 transition-transform duration-300 group-hover:translate-x-(--space-2) group-focus-visible:translate-x-(--space-2) motion-reduce:transition-none"
                        />
                    </a>
                    <ul className="col-start-1 row-start-1 grid grid-rows-2 gap-(--hairline) phone:col-start-auto phone:row-start-auto">
                        <li className="grid">
                            <a href="/docs/" className={row}>
                                Read the docs
                                <ArrowRight
                                    aria-hidden="true"
                                    className={cx(rowArrow, "group-hover:translate-x-(--space-1)")}
                                />
                            </a>
                        </li>
                        <li className="grid">
                            <a href={github.href} target="_blank" rel="noreferrer" className={row}>
                                {/* The space is outside the span because name computation trims each child's text */}
                                <span>
                                    GitHub <span className="sr-only">(opens in a new tab)</span>
                                </span>
                                <ArrowUpRight
                                    aria-hidden="true"
                                    className={cx(
                                        rowArrow,
                                        "group-hover:translate-x-(--space-1) group-hover:-translate-y-(--space-1)",
                                    )}
                                />
                            </a>
                        </li>
                    </ul>
                </section>
            </Frame>
        </Band>
    );
}
