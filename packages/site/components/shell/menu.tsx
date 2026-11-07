"use client";

import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import { CloseIcon, MenuIcon } from "../icons";
import { headerLinks, linkText, ShellAnchor, type Page } from "./links";

/**
 * The header links on phones: a button and the panel it opens under the header. The panel is
 * not a focus trap; focus that leaves it for anything but the button closes it.
 */
export function Menu({ current }: { current?: Page }) {
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const button = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLElement>(null);

    function closeToButton() {
        setOpen(false);
        button.current?.focus();
    }

    useEffect(() => {
        if (!open) return;
        function onKeyDown(event: KeyboardEvent) {
            if (event.key !== "Escape") return;
            setOpen(false);
            button.current?.focus();
        }
        function onPointerDown(event: PointerEvent) {
            const target = event.target as Node | null;
            if (panel.current?.contains(target) || button.current?.contains(target)) return;
            setOpen(false);
        }
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("pointerdown", onPointerDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [open]);

    // A null relatedTarget is the window losing focus, which should not fold the menu away
    function onBlur(event: FocusEvent<HTMLElement>) {
        const next = event.relatedTarget;
        if (next === null || event.currentTarget.contains(next) || next === button.current) return;
        setOpen(false);
    }

    return (
        <>
            <button
                ref={button}
                type="button"
                aria-label="Menu"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((was) => !was)}
                className="hidden size-(--hit) items-center justify-center text-text phone:flex"
            >
                {open ? <CloseIcon /> : <MenuIcon />}
            </button>
            {/* Positioned against the sticky header, so it hangs just under the header's hairline
                and covers the page instead of pushing it down */}
            <nav
                ref={panel}
                id={panelId}
                aria-label="Main"
                hidden={!open}
                onBlur={onBlur}
                className="absolute inset-x-0 top-full mt-(--hairline) hidden bg-bg phone:block"
            >
                <ul>
                    {headerLinks.map((link) => (
                        <li key={link.href}>
                            <ShellAnchor
                                link={link}
                                current={link.page !== undefined && link.page === current}
                                onClick={closeToButton}
                                className={`flex h-(--menu-row) items-center gap-(--space-1) border-b-(length:--hairline) border-line px-(--pad) ${linkText}`}
                            />
                        </li>
                    ))}
                </ul>
            </nav>
        </>
    );
}
