import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";

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
