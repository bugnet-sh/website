import type { ReactNode } from "react";

function cx(...names: (string | false | undefined)[]) {
    return names.filter(Boolean).join(" ");
}

/**
 * The centred content column: `--frame` wide at most, with a hairline rail each side so every
 * band's content shares one left and one right edge. On phones it is the full width, so the
 * rails go. Content that spans rail to rail, such as the footer's waves, asks for no padding.
 */
export function Frame({
    children,
    className,
    padded = true,
}: {
    children?: ReactNode;
    className?: string;
    padded?: boolean;
}) {
    return (
        <div
            className={cx(
                "mx-auto w-full max-w-(--frame) border-x-(length:--hairline) border-line phone:border-x-0",
                padded && "px-(--pad)",
                className,
            )}
        >
            {children}
        </div>
    );
}

/**
 * One full-width band of the page, with a hairline under it. Its children go in a `Frame`,
 * unless `rail` is false, for a band that builds its own frame.
 */
export function Band({
    as: Tag = "section",
    className,
    children,
    rail = true,
}: {
    as?: "section" | "header" | "footer" | "div";
    className?: string;
    children?: ReactNode;
    rail?: boolean;
}) {
    return (
        <Tag className={cx("border-b-(length:--hairline) border-line", className)}>
            {rail ? <Frame>{children}</Frame> : children}
        </Tag>
    );
}
