import { ArrowUpRight, Check, ChevronDown, Copy, Menu, Search, X } from "lucide-react";

// Sizes come from CSS tokens; the class outranks the width and height lucide writes as attributes

/** The mark after a link that leaves the site. */
export function ExternalArrow() {
    return <ArrowUpRight aria-hidden="true" className="block size-(--arrow) shrink-0" />;
}

export function MenuIcon() {
    return <Menu aria-hidden="true" className="block size-(--menu-icon)" />;
}

export function CloseIcon() {
    return <X aria-hidden="true" className="block size-(--menu-icon)" />;
}

/** The Docs menu's fold mark, turned over while the menu is open. */
export function ChevronIcon({ open }: { open: boolean }) {
    return (
        <ChevronDown
            aria-hidden="true"
            className={`block size-(--chevron) shrink-0 ${open ? "rotate-180" : ""}`}
        />
    );
}

/** The copy button's marks: copy, copied and failed. */
export function CopyIcon() {
    return <Copy aria-hidden="true" className="block size-(--copy-icon)" />;
}

export function CheckIcon() {
    return <Check aria-hidden="true" className="block size-(--copy-icon)" />;
}

/** The mark inside a ticked box; the box decides when it shows */
export function TickIcon({ className }: { className: string }) {
    return (
        <Check aria-hidden="true" strokeWidth={3} className={`size-(--check-mark) ${className}`} />
    );
}

/** The magnifier inside a search box, set in from its left edge */
export function SearchIcon() {
    return (
        <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-(--space-3) block size-(--search-icon) -translate-y-1/2 text-text-muted"
        />
    );
}

export function FailIcon() {
    return <X aria-hidden="true" className="block size-(--copy-icon)" />;
}

/** GitHub's mark, from its brand kit, filled in the current colour. */
export function GitHubIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="block size-(--social-icon) fill-current"
        >
            <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
        </svg>
    );
}

/** X's mark, filled in the current colour. */
export function XIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="block size-(--social-icon) fill-current"
        >
            <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
        </svg>
    );
}
