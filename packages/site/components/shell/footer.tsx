import { cx } from "../../lib/cx";
import { Logo } from "../brand/logo";
import { GitHubIcon, XIcon } from "../icons";
import { FooterWaves } from "../waves/waves";
import { Frame } from "./frame";
import { github, ShellAnchor, type ShellLink } from "./links";

const socials = [
    { label: "GitHub", href: github.href, Icon: GitHubIcon },
    { label: "X", href: "https://x.com/bugnetsh", Icon: XIcon },
];

const columns: { heading: string; links: ShellLink[] }[] = [
    {
        heading: "Site",
        links: [
            { label: "Home", href: "/" },
            { label: "How it works", href: "/#how" },
            { label: "Pricing", href: "/#pricing" },
            { label: "Stats", href: "/stats/" },
            { label: "Get started", href: "/docs/#install" },
        ],
    },
    {
        heading: "Developers",
        links: [
            { label: "Docs", href: "/docs/" },
            { label: "Install", href: "/#install" },
            { label: "x402", href: "https://x402.org", external: true },
        ],
    },
    {
        heading: "Legal",
        links: [
            { label: "Terms", href: "/terms/" },
            { label: "Privacy", href: "/privacy/" },
        ],
    },
];

const rows = Math.max(...columns.map((column) => column.links.length));

/** One cell of the link grid, a row tall with its hairline under it. */
const cell =
    "flex h-(--row) items-center gap-(--space-1) border-b-(length:--hairline) border-line text-(length:--fine-size) leading-(--fine-line) tracking-(--caps-tracking) uppercase";

/**
 * The last column's text always meets the frame's right edge, and the first column's meets the
 * left edge once the grid no longer sits beside the brand, as every band's text does.
 */
function inset(i: number): string {
    return cx(
        "pl-(--space-4) phone:pr-(--pad) phone:pl-(--pad)",
        i === columns.length - 1 ? "pr-(--pad)" : "pr-(--space-4)",
        i === 0 && "tablet:pl-(--pad)",
    );
}

/**
 * The closing band, pushed to the bottom of a short page. Its hairline above is the one under the
 * band before it. The brand sits left; the link grid sits against the frame's right rail, its
 * columns' hairlines running down to the waves, and shorter columns end in empty cells so every
 * row's line runs across the grid. Tablets put the grid under the brand; phones stack it.
 */
export function SiteFooter() {
    return (
        <footer className="mt-auto">
            <Frame padded={false} className="grid grid-cols-[1fr_auto] tablet:grid-cols-1">
                <div className="px-(--pad) pt-(--space-7) pb-(--space-8)">
                    <Logo />
                    <p className="mt-(--space-4) max-w-[34ch] text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                        Pay-per-run sandboxes for AI agents, paid in USDC on Solana.
                    </p>
                    <ul className="mt-(--space-5) flex gap-(--space-2)">
                        {socials.map(({ label, href, Icon }) => (
                            <li key={label}>
                                <a
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={`${label} (opens in a new tab)`}
                                    className="relative grid size-(--button) place-items-center border-(length:--hairline) before:absolute before:-inset-[calc((var(--hit)-var(--button))/2)] before:content-[''] border-line text-text-muted hover:border-accent-3 hover:text-accent-3"
                                >
                                    <Icon />
                                </a>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-(--space-5) text-(length:--fine-size) leading-(--fine-line) text-text-muted">
                        © 2026 Bugnet
                    </p>
                </div>
                <nav
                    aria-label="Footer"
                    className="grid grid-cols-3 border-l-(length:--hairline) border-line tablet:border-t-(length:--hairline) tablet:border-l-0 phone:grid-cols-1"
                >
                    {columns.map((column, i) => (
                        <div
                            key={column.heading}
                            className={cx(
                                "w-(--footer-col) tablet:w-auto",
                                i > 0 &&
                                    "border-l-(length:--hairline) border-line phone:border-l-0",
                            )}
                        >
                            <h2 className={cx(cell, inset(i), "font-semibold text-text-muted")}>
                                {column.heading}
                            </h2>
                            <ul>
                                {column.links.map((link) => (
                                    <li key={link.label} className="flex">
                                        <ShellAnchor
                                            link={link}
                                            className={cx(
                                                cell,
                                                inset(i),
                                                "flex-1 text-text hover:bg-surface-hover focus-visible:-outline-offset-(--ring) [&>svg]:ml-auto",
                                            )}
                                        />
                                    </li>
                                ))}
                                {Array.from({ length: rows - column.links.length }, (_, n) => (
                                    <li key={n} aria-hidden className={cx(cell, "phone:hidden")} />
                                ))}
                            </ul>
                        </div>
                    ))}
                </nav>
            </Frame>
            <Frame padded={false}>
                <FooterWaves />
            </Frame>
        </footer>
    );
}
