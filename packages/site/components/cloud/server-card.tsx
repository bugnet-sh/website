import { useId, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { cheapest, longestRun, runText, type Server } from "../../lib/cloud/servers";
import { lengthText } from "../../lib/landing/price";
import { formatUsdc } from "../../lib/stats/format";
import { formatBytes, sizeText } from "../../lib/stats/labels";
import { ExternalArrow } from "../icons";
import { Cell, cells, inset } from "./cell";
import { LiveNumbers, type Live } from "./live";

const GiB = 1024 ** 3;

/** Eight specs: two rows of four, or four rows of two on phones, so no row ends short */
function facts(s: Server): { label: string; value: ReactNode }[] {
    return [
        { label: "CPU", value: `${s.size.vcpu} vCPU` },
        { label: "Memory", value: formatBytes(s.size.memoryMiB * 1024 ** 2) },
        { label: "Disk", value: formatBytes(s.size.diskGiB * GiB) },
        { label: "GPU", value: "None" },
        { label: "Location", value: s.provider.location },
        { label: "Longest run", value: runText(longestRun(s)) },
        { label: "Runs as", value: s.provider.user },
        {
            label: "Packages",
            value: (
                <ul className="flex flex-wrap gap-(--space-1)">
                    {s.packages.map((p) => (
                        <li
                            key={p.id}
                            className="bg-code-inline px-(--space-1) font-mono text-(length:--fine-size) leading-(--ui-line)"
                        >
                            {p.id}
                        </li>
                    ))}
                </ul>
            ),
        },
    ];
}

const label = "text-(length:--fine-size) leading-(--fine-line)";
const big = "text-(length:--cell-title-size) leading-(--cell-title-line) font-semibold";

/**
 * One provider's machine size. Every part sits on the same four columns: the name over three of
 * them and the price in the fourth, then the specs, then the provider's live numbers.
 */
export function ServerCard({ server, live }: { server: Server; live: Live }) {
    const titleId = useId();
    const from = cheapest(server);
    const { provider } = server;
    return (
        <article aria-labelledby={titleId} className="border-(length:--hairline) border-line">
            <div className="grid grid-cols-4 gap-x-(--hairline) phone:grid-cols-1">
                <div className={cx("col-span-3 min-w-0 py-(--space-4) phone:col-span-1", inset)}>
                    <a
                        href={provider.url}
                        target="_blank"
                        rel="noreferrer"
                        className={cx(
                            "flex w-fit items-center gap-(--space-1) font-semibold text-text hover:text-accent",
                            label,
                        )}
                    >
                        {provider.name} <span className="sr-only">(opens in a new tab)</span>
                        <ExternalArrow />
                    </a>
                    <h2
                        id={titleId}
                        className="mt-(--space-1) flex flex-wrap items-baseline gap-x-(--space-3)"
                    >
                        <span className="sr-only">{provider.name} </span>
                        <span className={big}>{sizeText({ ...server.size, gpu: null })}</span>{" "}
                        <span className="text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                            {server.size.name}
                        </span>
                    </h2>
                </div>
                <p className={cx("min-w-0 py-(--space-4) whitespace-nowrap phone:pt-0", inset)}>
                    <span className={cx("block text-text-muted", label)}>From</span>{" "}
                    <span className="mt-(--space-1) flex items-baseline gap-(--space-2)">
                        <span className={cx(big, "text-accent")}>
                            {formatUsdc(from.priceMicros)}
                        </span>{" "}
                        <span className="text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                            USDC {lengthText(from)}
                        </span>
                    </span>
                </p>
            </div>
            <dl className={cx(cells, "border-t-(length:--hairline) border-line")}>
                {facts(server).map((f) => (
                    <Cell key={f.label} label={f.label}>
                        {f.value}
                    </Cell>
                ))}
            </dl>
            <LiveNumbers live={live} />
        </article>
    );
}
