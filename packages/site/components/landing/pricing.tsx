"use client";

import { useId } from "react";
import { cx } from "../../lib/cx";
import { packageFacts, priceText } from "../../lib/landing/price";
import { AsciiField } from "../backgrounds/ascii-field";
import { Band, Frame } from "../shell/frame";
import { useStats } from "../stats/stats-provider";
import { isUnavailable, Unavailable } from "../stats/unavailable";
import { secondaryButton } from "../ui/button";
import { cellInset } from "./inset";
import { LandingTitle } from "./title";

/**
 * One cell per package on sale, from the live feed, so no price here is ever invented: four to a
 * row, two on tablets, one on phones. Each cell draws its own hairlines, so a last row that is
 * not full shows no line where no cell is. The ASCII field has a strip of its own between the
 * title and the cells, so no text sits on it.
 */
export function Pricing() {
    const stats = useStats();
    const id = useId();
    const packages = stats.data?.packages ?? [];
    return (
        <Band as="div" id="pricing" rail={false}>
            <Frame padded={false}>
                <section aria-labelledby={id}>
                    {/* Above the cells, so the backdrop can reach a little way over them */}
                    <div className="relative z-10 flex flex-wrap items-end justify-between gap-(--space-4) px-(--pad) pt-(--band) pb-(--space-6)">
                        {/* Fades out on every side, so it never ends on an edge; takes no clicks */}
                        <AsciiField className="pointer-events-none absolute opacity-(--pricing-field-opacity) inset-x-0 top-0 -bottom-(--pricing-bleed) [mask-image:linear-gradient(to_bottom,transparent,#000_25%,#000_80%,transparent),linear-gradient(to_right,transparent,#000_15%,#000_85%,transparent)] [mask-composite:intersect]" />
                        <div className="relative">
                            <LandingTitle id={id}>Pricing</LandingTitle>
                        </div>
                        <a href="/stats/#limits" className={`${secondaryButton} bg-bg`}>
                            Live limits
                        </a>
                    </div>
                    <div className="relative min-h-(--box)">
                        {packages.length > 0 && (
                            <ul className="grid grid-cols-4 gap-(--hairline) narrow:grid-cols-2 phone:grid-cols-1">
                                {packages.map((p, i) => (
                                    <li
                                        key={p.id}
                                        className={cx(
                                            "bg-bg py-(--space-5) shadow-[0_0_0_var(--hairline)_var(--line)]",
                                            cellInset(i, 4, 2),
                                        )}
                                    >
                                        <p className="flex items-baseline gap-(--space-2)">
                                            <span className="font-mono text-(length:--stat-size) leading-(--stat-line) text-accent-2">
                                                {priceText(p.priceMicros)}
                                            </span>
                                            <span className="text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                                                USDC
                                            </span>
                                        </p>
                                        <dl className="mt-(--space-4) text-(length:--ui-size) leading-(--ui-line)">
                                            {packageFacts(p).map((fact) => (
                                                <div
                                                    key={fact.label}
                                                    className="flex h-(--row) items-center justify-between gap-(--space-3) border-t-(length:--hairline) border-line"
                                                >
                                                    <dt className="text-text-muted">
                                                        {fact.label}
                                                    </dt>
                                                    <dd className="font-mono">{fact.value}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {isUnavailable(stats) && <Unavailable />}
                    </div>
                </section>
            </Frame>
        </Band>
    );
}
