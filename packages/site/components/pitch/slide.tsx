import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Logo } from "../brand/logo";

/** Solana's gradient on a word, as the hero sets it */
export const solana =
    "bg-[linear-gradient(90deg,var(--solana-purple),var(--solana-green))] bg-clip-text text-transparent";

/** Type that scales with the slide, never under a size a phone can read */
export const type = {
    hero: "font-head text-[max(36px,5cqi)] leading-[1.12] font-extralight",
    title: "font-head text-[max(28px,3.6cqi)] leading-[1.15] font-extralight",
    statement: "font-head text-[max(20px,2.8cqi)] leading-[1.3] font-extralight",
    number: "font-head text-[max(32px,4.8cqi)] leading-[1.1] font-extralight",
    lead: "text-[max(16px,1.9cqi)] leading-[1.5] text-text-muted",
    head: "text-[max(16px,2.05cqi)] leading-[1.3] font-semibold",
    text: "text-[max(14px,1.6cqi)] leading-[1.45] text-text-muted",
};

/** A 16 by 9 slide fitted to the screen, its title at the top and the brand at the foot */
export function Slide({
    n,
    title,
    children,
    plain = false,
}: {
    n: number;
    title?: ReactNode;
    children: ReactNode;
    plain?: boolean;
}) {
    const id = `slide-${n}`;
    return (
        <section
            data-slide
            aria-labelledby={title ? id : undefined}
            className="flex h-dvh items-center justify-center phone:h-auto"
        >
            {/* The box is the container, so its own padding is set on the child in cqi */}
            <div className="@container flex aspect-video w-[min(100vw,calc(100dvh*16/9))] flex-col border-(length:--hairline) border-line phone:aspect-auto phone:w-full phone:border-x-0 phone:border-t-0">
                <div className="flex flex-1 flex-col px-[5cqi] pt-[4cqi] pb-[2.5cqi] phone:px-(--pad) phone:pt-(--space-7) phone:pb-(--space-5)">
                    {title && (
                        <h2 id={id} className={type.title}>
                            {title}
                        </h2>
                    )}
                    <div
                        className={cx(
                            "flex min-h-0 flex-1 flex-col",
                            title !== undefined && "mt-[3cqi] phone:mt-(--space-6)",
                        )}
                    >
                        {children}
                    </div>
                    {!plain && (
                        <div className="mt-[2cqi] flex items-center justify-between phone:mt-(--space-6)">
                            <Logo />
                            <span className="font-mono text-[max(12px,0.9cqi)] text-text-muted">
                                {String(n).padStart(2, "0")}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

/** Cells in a hairline grid, as the landing's bands set them */
export function Cells({ cols, children }: { cols: 2 | 3 | 4; children: ReactNode }) {
    const grid = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[cols];
    return (
        <ul
            className={cx(
                "grid gap-(--hairline) border-(length:--hairline) border-line bg-line phone:grid-cols-1",
                grid,
            )}
        >
            {children}
        </ul>
    );
}

/** One cell: a short title, or a number, over one sentence */
export function Cell({
    head,
    text,
    big = false,
}: {
    head: ReactNode;
    text: string;
    big?: boolean;
}) {
    return (
        <li className="bg-bg p-[2.6cqi] phone:p-(--space-5)">
            <p className={big ? type.number : type.head}>{head}</p>
            <p className={cx(type.text, "mt-[1cqi] phone:mt-(--space-2)")}>{text}</p>
        </li>
    );
}
