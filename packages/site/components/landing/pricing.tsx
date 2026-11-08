"use client";

import { useId } from "react";
import { cx } from "../../lib/cx";
import { packageFacts, priceText } from "../../lib/landing/price";
import { Band, Frame } from "../shell/frame";
import { useStats } from "../stats/stats-provider";
import { isUnavailable, Unavailable } from "../stats/unavailable";
import { secondaryButton } from "../ui/button";
import { cellInset } from "./inset";
import { LandingTitle } from "./title";

const gridCols = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"];

/**
 * One cell per package on sale, from the live feed, so no price here is ever invented. Each cell
 * draws its own hairlines, so a last row that is not full shows no line where no cell is.
 */
export function Pricing() {
    const stats = useStats();
    const id = useId();
    const packages = stats.data?.packages ?? [];
    const columns = Math.min(Math.max(packages.length, 1), 4);
    const narrowColumns = Math.min(columns, 2);
    return (
        <Band as="div" id="pricing" rail={false}>
            <Frame padded={false}>
                <section aria-labelledby={id}>
                    <div className="px-(--pad) pt-(--band) pb-(--space-6)">
                        <LandingTitle id={id}>Pricing</LandingTitle>
                    </div>
                    <div className="relative min-h-(--box)">
                        {packages.length > 0 && (
                            <ul
                                className={cx(
                                    "grid gap-(--hairline) phone:grid-cols-1",
                                    gridCols[columns],
                                    narrowColumns === 2 && "narrow:grid-cols-2",
                                )}
                            >
                                {packages.map((p, i) => (
                                    <li
                                        key={p.id}
                                        className={cx(
                                            "bg-bg py-(--space-5) shadow-[0_0_0_var(--hairline)_var(--line)]",
                                            cellInset(i, columns, narrowColumns),
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
                    <div className="flex flex-wrap items-center justify-between gap-(--space-4) px-(--pad) py-(--space-6)">
                        <p className="text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                            No subscription. More time with{" "}
                            <code className="bg-surface px-(--space-1) font-mono">
                                bugnet_extend
                            </code>
                            , at the same rate.
                        </p>
                        <a href="/stats/#limits" className={secondaryButton}>
                            Live limits
                        </a>
                    </div>
                </section>
            </Frame>
        </Band>
    );
}
