import type { ReactNode } from "react";
import { ExternalArrow } from "../icons";

export type ShellLink = {
    label: string;
    href: string;
    /** Outside the site: it opens in a new tab and carries the arrow. */
    external?: boolean;
};

export type Page = "home" | "cloud" | "docs";

export const github: ShellLink = {
    label: "GitHub",
    href: "https://github.com/bugnet-sh/bugnet",
    external: true,
};

/** The one public address, for questions, abuse and security alike. */
export const supportEmail = "support@bugnet.org";

export const headerLinks: (ShellLink & { page?: Page })[] = [
    { label: "Home", href: "/", page: "home" },
    { label: "Cloud", href: "/cloud/", page: "cloud" },
    { label: "Docs", href: "/docs/", page: "docs" },
    github,
];

/** The type of every shell link; the current page's link reads as plain text colour. */
export const linkText =
    "text-(length:--ui-size) leading-(--ui-line) text-text-muted hover:text-text aria-[current=page]:text-text";

/**
 * A plain anchor: the pages it names are static files, and several do not exist yet, so a
 * Next `Link` would prefetch them into 404s.
 */
export function ShellAnchor({
    link,
    className,
    current,
    onClick,
}: {
    link: ShellLink;
    className?: string;
    current?: boolean;
    onClick?: () => void;
}): ReactNode {
    const outside = link.external ? { target: "_blank", rel: "noreferrer" } : {};
    return (
        <a
            href={link.href}
            className={className}
            aria-current={current ? "page" : undefined}
            onClick={onClick}
            {...outside}
        >
            {link.label}
            {/* The space is outside the span because name computation trims each child's text */}
            {link.external && (
                <>
                    {" "}
                    <span className="sr-only">(opens in a new tab)</span>
                    <ExternalArrow />
                </>
            )}
        </a>
    );
}
