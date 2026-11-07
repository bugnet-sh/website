import { Logo } from "../brand/logo";
import { Band, Frame } from "./frame";
import { headerLinks, linkText, ShellAnchor, type Page } from "./links";
import { Menu } from "./menu";

/** The site's top band: the logo, the page links and Get Started, folded into a menu on phones. */
export function SiteHeader({ current }: { current?: Page }) {
    return (
        <Band as="header" rail={false} className="sticky top-0 z-10 bg-bg">
            {/* The row, not the band, is --nav tall, so every item centred in it sits on a whole
                pixel; the hairline adds one below */}
            <Frame className="flex h-(--nav) items-center">
                <a href="/" className="flex shrink-0">
                    <Logo />
                </a>
                <nav aria-label="Main" className="ml-(--space-6) phone:hidden">
                    <ul className="flex items-center gap-(--space-5)">
                        {headerLinks.map((link) => (
                            <li key={link.href} className="flex">
                                <ShellAnchor
                                    link={link}
                                    current={link.page !== undefined && link.page === current}
                                    className={`inline-flex items-center gap-(--space-1) ${linkText}`}
                                />
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="ml-auto flex items-center gap-(--space-2)">
                    <Menu current={current} />
                    <a
                        href="/docs/#install"
                        className="inline-flex h-(--button) items-center bg-accent px-(--space-4) text-(length:--ui-size) leading-(--ui-line) font-semibold text-accent-ink"
                    >
                        Get Started
                    </a>
                </div>
            </Frame>
        </Band>
    );
}
