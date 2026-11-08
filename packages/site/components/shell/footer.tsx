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
 * The closing band, pushed to the bottom of a short page. Its hairline above is the one under the
 * band before it. The two link columns form one group against the frame's right edge; tablets
 * put them under the logo, and phones stack everything on the left.
 */
export function SiteFooter() {
    return (
        <footer className="mt-auto">
            <Frame className="grid grid-cols-[1fr_auto_auto] gap-x-(--space-8) gap-y-(--space-6) pt-(--space-7) pb-(--space-8) tablet:grid-cols-2 phone:grid-cols-1">
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
                    // Pushed down half the gap between the logo's line and a link's, so the first
                    // link centres on the logo; on phones each link is a whole tap target tall
                    <ul
                        key={column[0]?.href}
                        className="flex flex-col gap-(--space-3) pt-[calc((var(--wordmark-line)-var(--ui-line))/2)] tablet:pt-0 phone:gap-0"
                    >
                        {column.map((link) => (
                            <li key={link.href} className="flex">
                                <ShellAnchor
                                    link={link}
                                    className={`inline-flex items-center gap-(--space-1) phone:h-(--hit) ${linkText}`}
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
