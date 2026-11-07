import { Logo } from "../brand/logo";
import { FooterWaves } from "../waves/waves";
import { Frame } from "./frame";
import { github, linkText, ShellAnchor, type ShellLink } from "./links";

const columns: ShellLink[][] = [
    [
        { label: "Home", href: "/" },
        { label: "Docs", href: "/docs/" },
        { label: "Stats", href: "/stats/" },
    ],
    [
        { label: "Terms", href: "/terms/" },
        { label: "Privacy", href: "/privacy/" },
        github,
        { label: "X", href: "https://x.com/bugnetsh", external: true },
    ],
];

/**
 * The closing band. Its hairline above is the one under the band before it. The link columns
 * hug the frame's right edge until phones, where everything stacks on the left.
 */
export function SiteFooter() {
    return (
        <footer>
            <Frame className="grid grid-cols-[1.8fr_1fr_1fr] gap-(--space-6) pt-(--space-7) pb-(--space-8) tablet:grid-cols-2 phone:grid-cols-1">
                <div className="tablet:col-span-2 phone:col-span-1">
                    <Logo />
                    <p className="mt-(--space-4) max-w-[34ch] text-(length:--ui-size) leading-(--ui-line) text-text-muted">
                        Pay-per-run sandboxes for AI agents, paid in USDC on Solana.
                    </p>
                    <p className="mt-(--space-3) text-(length:--fine-size) leading-(--fine-line) text-text-muted">
                        © 2026 Bugnet
                    </p>
                </div>
                {columns.map((column) => (
                    <ul
                        key={column[0]?.href}
                        className="flex flex-col gap-(--space-3) justify-self-end phone:justify-self-start"
                    >
                        {column.map((link) => (
                            <li key={link.href} className="flex">
                                <ShellAnchor
                                    link={link}
                                    className={`inline-flex items-center gap-(--space-1) ${linkText}`}
                                />
                            </li>
                        ))}
                    </ul>
                ))}
            </Frame>
            <Frame padded={false}>
                <FooterWaves />
            </Frame>
        </footer>
    );
}
