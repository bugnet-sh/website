import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useId } from "react";
import { cx } from "../../lib/cx";
import { Band, Frame } from "../shell/frame";
import { github, supportEmail } from "../shell/links";
import "./contact.css";

/** An open book; a copy of its right page turns over while its row is hovered or focused */
function BookIcon() {
    const right = "M12 6 L21 4.5 V18.5 L12 20 Z";
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="block size-(--contact-row-icon) shrink-0 fill-none stroke-current"
            strokeWidth="1.5"
            strokeLinejoin="round"
        >
            <path d="M12 6 L3 4.5 V18.5 L12 20 Z" />
            <path d={right} />
            <path d={right} className="contact-page fill-bg" />
        </svg>
    );
}

/** GitHub's mark, which waves while its row is hovered or focused */
function GitHubMark() {
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="block size-(--contact-row-icon) shrink-0 overflow-visible fill-current"
        >
            <path
                className="contact-wave"
                d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
            />
        </svg>
    );
}

/** A small row's arrow, which moves a little toward where its link goes on hover. */
const rowArrow =
    "block size-(--contact-row-arrow) shrink-0 transition-transform duration-300 motion-reduce:transition-none";

const row =
    "contact-row group flex min-h-(--contact-row) items-center justify-between gap-(--space-4) bg-bg pr-(--space-6) pl-(--pad) font-mono text-(length:--contact-row-size) leading-(--contact-row-line) hover:bg-surface-hover focus-visible:-outline-offset-(--ring) phone:pr-(--pad)";

const label = "flex items-center gap-(--space-3)";

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
                                <span className={label}>
                                    <BookIcon />
                                    Read the docs
                                </span>
                                <ArrowRight
                                    aria-hidden="true"
                                    className={cx(rowArrow, "group-hover:translate-x-(--space-1)")}
                                />
                            </a>
                        </li>
                        <li className="grid">
                            <a href={github.href} target="_blank" rel="noreferrer" className={row}>
                                {/* The space is outside the span because name computation trims each child's text */}
                                <span className={label}>
                                    <GitHubMark />
                                    <span>
                                        GitHub <span className="sr-only">(opens in a new tab)</span>
                                    </span>
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
