import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Logo } from "../brand/logo";

/** Solana's gradient on the word, as the hero sets it */
export const solana =
    "bg-[linear-gradient(90deg,var(--solana-purple),var(--solana-green))] bg-clip-text text-transparent";

/** Type that scales with the slide, never under a size a phone can read */
export const type = {
    hero: "font-head text-[max(36px,5.4cqi)] leading-[1.08] font-extralight tracking-[-0.01em]",
    title: "font-head text-[max(30px,3.9cqi)] leading-[1.08] font-extralight tracking-[-0.01em] text-balance",
    lead: "text-[max(16px,1.7cqi)] leading-[1.45] text-text",
    text: "text-[max(14px,1.35cqi)] leading-[1.5] text-text-muted",
};

/** One slide: the screen's 16 by 9 box, the brand and the slide's number at its foot */
export function Slide({
    n,
    label,
    children,
    plain = false,
}: {
    n: number;
    label: string;
    children: ReactNode;
    plain?: boolean;
}) {
    return (
        <section
            data-slide
            aria-label={label}
            className="flex h-dvh items-center justify-center phone:h-auto"
        >
            {/* The box is the container, so its own padding is set on the child in cqi */}
            <div className="@container flex aspect-video w-[min(100vw,calc(100dvh*16/9))] flex-col phone:aspect-auto phone:w-full">
                <div className="flex flex-1 flex-col px-[5.5cqi] pt-[4.5cqi] pb-[2.8cqi] phone:px-(--pad) phone:pt-(--space-8) phone:pb-(--space-6)">
                    <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
                    {!plain && (
                        <div className="mt-[2cqi] flex items-center justify-between phone:mt-(--space-7)">
                            <span className="[--mark:max(16px,1.6cqi)] [--wordmark-line:1.2] [--wordmark-size:max(14px,1.35cqi)]">
                                <Logo />
                            </span>
                            <span className="font-mono text-[max(12px,1.1cqi)] text-text-muted">
                                {String(n).padStart(2, "0")}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

/** The deck's one layout: the point and its detail on the left, what shows it on the right */
export function Split({
    title,
    lead,
    points,
    children,
    weight = "even",
}: {
    title: ReactNode;
    lead: ReactNode;
    points?: ReactNode[];
    children: ReactNode;
    weight?: "even" | "visual";
}) {
    return (
        <div
            className={cx(
                "grid items-center gap-[5cqi] phone:grid-cols-1 phone:gap-(--space-7)",
                weight === "visual"
                    ? "grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]"
                    : "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
            )}
        >
            <div>
                <h2 className={type.title}>{title}</h2>
                <p className={cx(type.lead, "mt-[2cqi] max-w-[34ch] phone:mt-(--space-4)")}>
                    {lead}
                </p>
                {points && (
                    <ul className="mt-[2.6cqi] flex flex-col gap-[1.1cqi] phone:mt-(--space-5) phone:gap-(--space-3)">
                        {points.map((point, i) => (
                            <li
                                key={i}
                                className={cx(type.text, "flex gap-[1.2cqi] phone:gap-(--space-3)")}
                            >
                                <span
                                    aria-hidden="true"
                                    className="mt-[0.62em] size-[max(6px,0.45cqi)] shrink-0 bg-accent"
                                />
                                <span>{point}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="min-w-0">{children}</div>
        </div>
    );
}
