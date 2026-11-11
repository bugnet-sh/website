import { useId, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { cheapest, longestRun, runText, type Server } from "../../lib/cloud/servers";
import { lengthText, priceText } from "../../lib/landing/price";
import { formatBytes, sizeText } from "../../lib/stats/labels";
import { ExternalArrow } from "../icons";
import { LiveNumbers, type Live } from "./live";

const GiB = 1024 ** 3;
const inset = "px-(--space-5) phone:px-(--space-4)";

/**
 * Four specs to a row, three on tablets and two on phones. Packages fills what its row has left,
 * so no row ends short and the hairline grid shows no empty cell.
 */
function facts(s: Server): { label: string; value: ReactNode; mono?: boolean; span?: string }[] {
    return [
        { label: "CPU", value: `${s.size.vcpu} vCPU`, mono: true },
        { label: "Memory", value: formatBytes(s.size.memoryMiB * 1024 ** 2), mono: true },
        { label: "Disk", value: formatBytes(s.size.diskGiB * GiB), mono: true },
        { label: "GPU", value: "None" },
        { label: "Location", value: s.provider.location },
        { label: "Longest run", value: runText(longestRun(s)) },
        { label: "Runs as", value: s.provider.user, mono: true },
        {
            label: "Packages",
            span: "tablet:col-span-2 phone:col-span-1",
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

/** One provider's machine size: what it is, what it costs from, and how the provider is doing */
export function ServerCard({ server, live }: { server: Server; live: Live }) {
    const titleId = useId();
    const from = cheapest(server);
    const { provider } = server;
    return (
        <article aria-labelledby={titleId} className="border-(length:--hairline) border-line">
            <div
                className={cx(
                    "flex items-start justify-between gap-x-(--space-5) gap-y-(--space-2) py-(--space-4) phone:flex-col",
                    inset,
                )}
            >
                {/* The spaces between the parts are for screen readers; the flex gap draws them */}
                <h2
                    id={titleId}
                    className="flex min-w-0 flex-wrap items-center gap-x-(--space-3) gap-y-(--space-1)"
                >
                    <span className="border-(length:--hairline) border-line px-(--space-2) text-(length:--ui-size) leading-(--ui-line) font-semibold">
                        {provider.name}
                    </span>{" "}
                    <span className="text-(length:--cell-title-size) leading-(--cell-title-line) font-semibold">
                        {sizeText({ ...server.size, gpu: null })}
                    </span>{" "}
                    <span className="font-mono text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                        {server.size.name}
                    </span>
                </h2>
                <p className="flex shrink-0 items-baseline gap-(--space-2) whitespace-nowrap">
                    <span className="text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                        From
                    </span>{" "}
                    <span className="font-mono text-(length:--cell-title-size) leading-(--cell-title-line) text-accent">
                        {priceText(from.priceMicros)}
                    </span>{" "}
                    <span className="text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                        USDC {lengthText(from)}
                    </span>
                </p>
            </div>
            <dl className="grid grid-cols-4 gap-(--hairline) border-t-(length:--hairline) border-line bg-line tablet:grid-cols-3 phone:grid-cols-2">
                {facts(server).map((f) => (
                    <div
                        key={f.label}
                        className={cx("min-w-0 bg-bg py-(--space-3)", inset, f.span)}
                    >
                        <dt className="text-(length:--fine-size) leading-(--fine-line) text-text-muted">
                            {f.label}
                        </dt>
                        <dd
                            className={cx(
                                "mt-(--space-1) text-(length:--ui-size) leading-(--ui-line)",
                                f.mono && "font-mono",
                            )}
                        >
                            {f.value}
                        </dd>
                    </div>
                ))}
            </dl>
            <div
                className={cx(
                    "flex items-baseline gap-x-(--space-5) gap-y-(--space-2) border-t-(length:--hairline) border-line py-(--space-3) text-(length:--fine-size) leading-(--fine-line) phone:flex-col",
                    inset,
                )}
            >
                <LiveNumbers name={provider.name} live={live} />
                <a
                    href={provider.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-(--space-1) text-text-muted hover:text-text"
                >
                    {new URL(provider.url).host}{" "}
                    <span className="sr-only">(opens in a new tab)</span>
                    <ExternalArrow />
                </a>
            </div>
        </article>
    );
}
