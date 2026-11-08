import { Logo } from "../brand/logo";
import { Frame } from "./frame";
import { headerLinks, linkText, ShellAnchor, type Page } from "./links";
import { Menu } from "./menu";

/** The site's top band: the logo, the page links and Get Started, folded into a menu on phones. */
export function SiteHeader({ current }: { current?: Page }) {
    return (
        // Not a Band: a border would sit below the row and make the band one pixel taller than
        // --nav, while an inset shadow draws the hairline inside the row, so the band stays --nav
        // tall and every item centred in the row still sits on a whole pixel
        <header className="sticky top-0 z-10 bg-bg shadow-[inset_0_calc(var(--hairline)*-1)_0_var(--line)]">
            <Frame className="flex h-(--nav) items-center">
                <a href="/" className="flex h-(--hit) shrink-0 items-center">
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
                        href="/docs/"
                        className="relative inline-flex h-(--button) items-center bg-accent before:absolute before:inset-x-0 before:-inset-y-[calc((var(--hit)-var(--button))/2)] before:content-[''] px-(--space-4) text-(length:--ui-size) leading-(--ui-line) font-semibold text-accent-ink"
                    >
                        Get Started
                    </a>
                </div>
            </Frame>
        </header>
    );
}
