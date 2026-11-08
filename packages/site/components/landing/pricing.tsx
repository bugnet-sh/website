"use client";

import { useId } from "react";
import { cx } from "../../lib/cx";
import {
    packageFacts,
    pricingCells,
    lengthText,
    priceText,
    type PricingCell,
} from "../../lib/landing/price";
import { Band, Frame } from "../shell/frame";
import { useStats } from "../stats/stats-provider";
import { isUnavailable, Unavailable } from "../stats/unavailable";
import { secondaryButton } from "../ui/button";
import { cellInset } from "./inset";
import { LandingTitle } from "./title";

/** A cell's top line: the package's price for its length, or the model of a GPU not on sale yet */
function Head({ cell }: { cell: PricingCell }) {
    if (cell.kind === "soon") {
        return (
            <p className="font-mono text-(length:--stat-size) leading-(--stat-line) text-text-muted">
                {cell.model}
            </p>
        );
    }
    return (
        <p className="flex items-baseline gap-(--space-2)">
            <span className="font-mono text-(length:--stat-size) leading-(--stat-line) text-accent">
                {priceText(cell.p.priceMicros)}
            </span>
            <span className="text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                USDC {lengthText(cell.p)}
            </span>
        </p>
    );
}

const row =
    "flex h-(--row) items-center justify-between gap-(--space-3) border-t-(length:--hairline) border-line";

const facts = (cell: PricingCell) =>
    cell.kind === "package"
        ? packageFacts(cell.p)
        : [{ label: "VRAM", value: `${cell.memoryGiB} GiB` }];

/**
 * The packages on sale, from the live feed, so no price here is ever invented, then popular GPUs
 * coming soon to fill eight cells (founder, 2026-11-08): four to a row, two on tablets, one on
 * phones. Each cell draws its own hairlines, so a last row that is not full shows no line where no
 * cell is.
 */
export function Pricing() {
    const stats = useStats();
    const id = useId();
    const packages = stats.data?.packages ?? [];
    const cells = packages.length > 0 ? pricingCells(packages) : [];
    return (
        <Band as="div" id="pricing" rail={false}>
            <Frame padded={false}>
                <section aria-labelledby={id}>
                    <div className="flex flex-wrap items-end justify-between gap-(--space-4) px-(--pad) pt-(--band) pb-(--space-6)">
                        <LandingTitle id={id}>Pricing</LandingTitle>
                        <a href="/stats/#limits" className={secondaryButton}>
                            Live limits
                        </a>
                    </div>
                    <div className="relative min-h-(--box)">
                        {cells.length > 0 && (
                            <ul className="grid grid-cols-4 gap-(--hairline) narrow:grid-cols-2 phone:grid-cols-1">
                                {cells.map((cell, i) => (
                                    <li
                                        key={cell.kind === "package" ? cell.p.id : cell.model}
                                        className={cx(
                                            "py-(--space-6) shadow-[0_0_0_var(--hairline)_var(--line)]",
                                            cellInset(i, 4, 2),
                                        )}
                                    >
                                        <Head cell={cell} />
                                        <dl className="mt-(--space-4) text-(length:--ui-size) leading-(--ui-line)">
                                            {facts(cell).map((fact) => (
                                                <div key={fact.label} className={row}>
                                                    <dt className="text-text-muted">
                                                        {fact.label}
                                                    </dt>
                                                    <dd className="font-mono">{fact.value}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                        {cell.kind === "soon" && (
                                            <p
                                                className={cx(
                                                    row,
                                                    "text-(length:--ui-size) leading-(--ui-line) text-text-muted",
                                                )}
                                            >
                                                Coming soon
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {isUnavailable(stats) && (
                            <Unavailable text="Prices are unavailable right now." />
                        )}
                    </div>
                </section>
            </Frame>
        </Band>
    );
}
