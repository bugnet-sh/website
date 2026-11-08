"use client";

import { useId } from "react";
import { cx } from "../../lib/cx";
import { formatDuration } from "../../lib/stats/format";
import { formatBytes, limitRows, sizeText } from "../../lib/stats/labels";
import { Band } from "../shell/frame";
import { Tip } from "../ui/tip";
import { bodyCell, headCell, tableClass, Usdc } from "./cells";
import { SectionTitle } from "./panels";
import { useStats } from "./stats-provider";
import { isUnavailable, Unavailable } from "./unavailable";

const GiB = 1024 ** 3;

/** Band 6: the live limits a user meets, then the packages on sale. */
export function Limits() {
    const stats = useStats();
    const limitsId = useId();
    const buyId = useId();
    const limits = stats.data ? limitRows(stats.data.limits) : [];
    const packages = stats.data?.packages ?? [];
    return (
        <Band id="limits">
            <div className="relative min-h-(--box) py-(--space-6)">
                <SectionTitle id={limitsId}>Limits</SectionTitle>
                {limits.length > 0 && (
                    <table aria-labelledby={limitsId} className={cx(tableClass, "mt-(--space-4)")}>
                        <thead>
                            <tr>
                                <th scope="col" className={headCell()}>
                                    Limit
                                </th>
                                <th scope="col" className={headCell(true)}>
                                    Value
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {limits.map((limit) => (
                                // Positioned, so a tip opens under its own row
                                <tr key={limit.key} className="relative">
                                    <td className={cx(bodyCell(), "whitespace-normal!")}>
                                        {limit.label}
                                        {/* After the name, so every value meets the frame's edge */}
                                        {limit.tip && (
                                            <span className="ml-(--space-2) inline-flex align-middle">
                                                <Tip
                                                    text={limit.tip}
                                                    label={`About ${limit.label}`}
                                                />
                                            </span>
                                        )}
                                    </td>
                                    <td className={bodyCell(true)}>{limit.value}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {packages.length > 0 && (
                    <>
                        <h3
                            id={buyId}
                            className="mt-(--space-6) text-(length:--ui-size) leading-(--ui-line) font-semibold"
                        >
                            What you can buy
                        </h3>
                        {/* On phones the size wraps so all four columns fit; the box still scrolls if not */}
                        <div className="relative mt-(--space-4) overflow-x-auto">
                            <table aria-labelledby={buyId} className={tableClass}>
                                <thead>
                                    <tr>
                                        <th scope="col" className={headCell()}>
                                            Size
                                        </th>
                                        <th scope="col" className={headCell(true)}>
                                            Disk
                                        </th>
                                        <th scope="col" className={headCell(true)}>
                                            Length
                                        </th>
                                        <th scope="col" className={headCell(true)}>
                                            Price
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {packages.map((p) => (
                                        <tr key={p.id}>
                                            <td
                                                className={cx(
                                                    bodyCell(),
                                                    "phone:whitespace-normal!",
                                                )}
                                            >
                                                {sizeText(p)}
                                            </td>
                                            <td className={bodyCell(true)}>
                                                {formatBytes(p.diskGiB * GiB)}
                                            </td>
                                            <td className={bodyCell(true)}>
                                                {formatDuration(p.minutes * 60)}
                                            </td>
                                            <td className={bodyCell(true)}>
                                                <Usdc micros={p.priceMicros} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
                {isUnavailable(stats) && <Unavailable />}
            </div>
        </Band>
    );
}
