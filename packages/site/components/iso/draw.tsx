import type { ReactNode } from "react";
import type { Flat, LineTone, SolidPaths, Tone } from "./iso-kit";

// The anatomy kit's server-safe drawing components (kit/react/draw.tsx), as this site uses them

export function Solid({
    paths,
    tone = "mid",
    crease = "faint",
    lit = false,
    flat = false,
    inner,
}: {
    paths: SolidPaths;
    tone?: Tone;
    crease?: Tone | "none";
    lit?: boolean;
    flat?: boolean;
    inner?: ReactNode;
}) {
    return (
        <g className="iso-solid" data-lit={lit ? "" : undefined}>
            <path className="iso-fill" d={paths.fill} />
            {flat
                ? null
                : paths.shades.map((d, shade) =>
                      d ? (
                          <path key={shade} className="iso-shade" data-shade={shade} d={d} />
                      ) : null,
                  )}
            {flat || !paths.top ? null : <path className="iso-top" d={paths.top} />}
            {crease === "none" || !paths.crease ? null : (
                <path className="iso-line iso-crease" data-tone={crease} d={paths.crease} />
            )}
            {crease === "none" || !paths.bevel ? null : (
                <path className="iso-line iso-bevel" data-tone={crease} d={paths.bevel} />
            )}
            {inner}
            <path className="iso-line iso-edge" data-tone={lit ? "lit" : tone} d={paths.outline} />
        </g>
    );
}

export function Line({ d, tone = "lo", free }: { d: string; tone?: LineTone; free?: boolean }) {
    if (!d) return null;
    return <path className="iso-line" data-tone={tone} data-free={free ? "" : undefined} d={d} />;
}

const tenth = (value: number) => Math.round(value * 10) / 10;

export function Dots({
    points,
    size = 0.5,
    tone = "mid",
}: {
    points: Flat[];
    size?: number;
    tone?: Tone;
}) {
    return (
        <g className="iso-dots" data-tone={tone}>
            {points.map(([x, y], index) => (
                <circle key={index} cx={tenth(x)} cy={tenth(y)} r={size} />
            ))}
        </g>
    );
}

export function Halo({ d }: { d: string }) {
    return <path className="iso-halo" d={d} />;
}
