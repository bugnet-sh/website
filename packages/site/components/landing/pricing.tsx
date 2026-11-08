"use client";

import { useId } from "react";
import { cx } from "../../lib/cx";
import { packageFacts, priceText } from "../../lib/landing/price";
import { Rays } from "../backgrounds/rays";
import { Band, Frame } from "../shell/frame";
import { useStats } from "../stats/stats-provider";
import { isUnavailable, Unavailable } from "../stats/unavailable";
import { secondaryButton } from "../ui/button";
import { cellInset } from "./inset";
import { LandingTitle } from "./title";

/**
 * One cell per package on sale, from the live feed, so no price here is ever invented: four to a
 * row, two on tablets, one on phones. Each cell draws its own hairlines, so a last row that is
 * not full shows no line where no cell is.
 */
export function Pricing() {
    const stats = useStats();
    const id = useId();
    const packages = stats.data?.packages ?? [];
    return (
        <Band as="div" id="pricing" rail={false}>
            {/* White light rays fall from the band's top, through the cells; they take no clicks */}
            <Frame padded={false} className="relative overflow-hidden">
                <Rays className="pointer-events-none absolute inset-x-0 top-0 h-(--rays) [mask-image:linear-gradient(to_bottom,#000_40%,transparent)]" />
                <section aria-labelledby={id} className="relative">
                    <div className="flex flex-wrap items-end justify-between gap-(--space-4) px-(--pad) pt-(--band) pb-(--space-6)">
                        <LandingTitle id={id}>Pricing</LandingTitle>
                        <a href="/stats/#limits" className={secondaryButton}>
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
                                            "py-(--space-6) shadow-[0_0_0_var(--hairline)_var(--line)]",
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
