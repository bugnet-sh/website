import { useId, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { runText, type Server } from "../../lib/cloud/servers";
import { lengthText } from "../../lib/landing/price";
import { formatUsdc } from "../../lib/stats/format";
import { formatBytes, sizeText } from "../../lib/stats/labels";
import type { Gpu, ProviderRow } from "../../lib/stats/types";
import { ExternalArrow } from "../icons";
import { Skeleton } from "../ui/skeleton";
import { Cell, cells, inset, WaitingCell } from "./cell";
import { LiveNumbers } from "./live";

const GiB = 1024 ** 3;

const gpuText = (gpu: Gpu | null) =>
    gpu === null
        ? "None"
        : `${gpu.count > 1 ? `${gpu.count} × ` : ""}${gpu.model ?? "GPU"}, ${gpu.memoryGiB} GiB`;

/** Eight specs: two rows of four, or four rows of two on phones, so no row ends short */
function facts(s: Server): { label: string; value: ReactNode }[] {
    return [
        { label: "CPU", value: `${s.size.vcpu} vCPU` },
        { label: "Memory", value: formatBytes(s.size.memoryMiB * 1024 ** 2) },
        { label: "Disk", value: formatBytes(s.size.diskGiB * GiB) },
        { label: "GPU", value: gpuText(s.gpu) },
        { label: "Location", value: s.provider.location },
        { label: "Longest run", value: runText(s.longestRunMinutes) },
        { label: "Runs as", value: s.user },
        { label: "Size", value: s.size.name },
    ];
}

/** The last cell of a row that is not full takes the room left, so no empty cell shows */
const spans = ["", "col-span-1", "col-span-2", "col-span-3", "col-span-4"] as const;
const phoneSpans = ["", "phone:col-span-1", "phone:col-span-2"] as const;
function lastSpan(i: number, count: number): string {
    if (i !== count - 1) return "";
    const left = (count % 4 === 0 ? 0 : 4 - (count % 4)) + 1;
    const phoneLeft = (count % 2 === 0 ? 0 : 1) + 1;
    return cx(spans[left], phoneSpans[phoneLeft]);
}

const label = "text-(length:--fine-size) leading-(--fine-line)";
const big = "text-(length:--cell-title-size) leading-(--cell-title-line) font-semibold";

/**
 * One provider's machine size, as the router places packages on it now. Every part sits on the
 * same four columns: the name, then each package's price on this server, then the specs, then
 * the provider's live numbers. The head's fourth column says Unavailable, on the provider's line,
 * only while the server can't take a start.
 */
export function ServerCard({ server, row }: { server: Server; row: ProviderRow }) {
    const titleId = useId();
    const { provider } = server;
    const name = cx("flex w-fit items-center gap-(--space-1) font-semibold text-text", label);
    return (
        <article aria-labelledby={titleId} className="border-(length:--hairline) border-line">
            <div className="grid grid-cols-4 gap-x-(--hairline) phone:grid-cols-1">
                <div className={cx("col-span-3 min-w-0 py-(--space-4) phone:col-span-1", inset)}>
                    {provider.url ? (
                        <a
                            href={provider.url}
                            target="_blank"
                            rel="noreferrer"
                            className={cx(name, "hover:text-accent")}
                        >
                            {provider.name} <span className="sr-only">(opens in a new tab)</span>
                            <ExternalArrow />
                        </a>
                    ) : (
                        <p className={name}>{provider.name}</p>
                    )}
                    <h2 id={titleId} className={cx("mt-(--space-1)", big)}>
                        <span className="sr-only">{provider.name} </span>
                        {sizeText({ ...server.size, gpu: server.gpu })}
                    </h2>
                </div>
                {!server.available && (
                    <p className={cx("min-w-0 py-(--space-4) text-warn phone:pt-0", inset, label)}>
                        Unavailable
                    </p>
                )}
            </div>
            <dl
                aria-label="Prices"
                className={cx(cells, "border-t-(length:--hairline) border-line")}
            >
                {server.packages.map((p, i) => (
                    <Cell
                        key={p.id}
                        label={<span className="font-mono">{p.id}</span>}
                        className={lastSpan(i, server.packages.length)}
                    >
                        {/* A six-decimal price leaves no room for its unit in a phone's half cell, so the
                            unit drops under it */}
                        <span className="flex flex-wrap items-baseline gap-x-(--space-2)">
                            <span className="font-semibold text-accent">
                                {formatUsdc(p.priceMicros)}
                            </span>{" "}
                            <span className="whitespace-nowrap text-text-muted">
                                USDC {lengthText(p)}
                            </span>
                        </span>
                    </Cell>
                ))}
            </dl>
            <dl className={cx(cells, "border-t-(length:--hairline) border-line")}>
                {facts(server).map((f) => (
                    <Cell key={f.label} label={f.label}>
                        {f.value}
                    </Cell>
                ))}
            </dl>
            <LiveNumbers row={row} />
        </article>
    );
}

/**
 * A card still waiting for the feed, drawn on the same grid and at the same heights as a server's
 * card, with bars where its words will be: one row of prices, the specs and the live numbers.
 */
export function WaitingCard({ still }: { still: boolean }) {
    return (
        <div aria-hidden="true" className="border-(length:--hairline) border-line">
            <div className="grid grid-cols-4 gap-x-(--hairline) phone:grid-cols-1">
                <div className={cx("col-span-3 min-w-0 py-(--space-4) phone:col-span-1", inset)}>
                    <Skeleton line="fine" className="w-1/6" still={still} />
                    <Skeleton line="title" className="mt-(--space-1) w-1/3" still={still} />
                </div>
            </div>
            <div className={cx(cells, "border-t-(length:--hairline) border-line")}>
                <WaitingCell still={still} />
                <WaitingCell className={lastSpan(1, 2)} still={still} />
            </div>
            <div className={cx(cells, "border-t-(length:--hairline) border-line")}>
                {Array.from({ length: 8 }, (_, i) => (
                    <WaitingCell key={i} still={still} />
                ))}
            </div>
            <div className={cx(cells, "border-t-(length:--hairline) border-line")}>
                {Array.from({ length: 4 }, (_, i) => (
                    <WaitingCell key={i} className="bg-surface" still={still} />
                ))}
            </div>
        </div>
    );
}
