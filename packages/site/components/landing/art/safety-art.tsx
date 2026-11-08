import type { CSSProperties } from "react";
import { frontMatrix, iso, pathOf, type Point3 } from "../../iso/iso-kit";
import { Art, GlassBox } from "./art";
import { box, camera, plate, round, seeded } from "./line-art";

// Off your machine: the sandbox on a cloud machine, a wall on the way to your laptop

const A = camera(128, 90);
const sandbox = box(A, [15, -50, 0], [44, 44, 44]);
const machine = plate(A, [3, -62, 0], [68, 68]);
const laptop = box(A, [-6, 72, 0], [40, 28, 3]);
const at = (x: number, y: number, z: number) => iso([x, y, z], A);
// The lid leans back a little from the base's back edge
const lid = (u: number, v: number) => at(-6 + 40 * u, 72 - 5 * v, 3 + 28 * v);
const screen = pathOf([lid(0, 0), lid(1, 0), lid(1, 1), lid(0, 1)], true);
const glass = pathOf([lid(0.08, 0.12), lid(0.92, 0.12), lid(0.92, 0.9), lid(0.08, 0.9)], true);
const wall = pathOf([at(18, 34, 0), at(58, 34, 0), at(58, 34, 22), at(18, 34, 22)], true);
const prompt = frontMatrix(-6, A);

export function OffMachineArt() {
    return (
        <Art>
            <path d={machine} className="art-faint" />
            {/* The sandbox's way out runs to the wall and stops */}
            <path d={pathOf([at(37, -6, 0), at(37, 34, 0)])} className="art-dim art-dash" />
            <GlassBox paths={sandbox} />
            <g transform={prompt}>
                <path d="M 25 -30 l 6 -5 l -6 -5 M 34 -28 h 8" className="art-lit" />
            </g>
            <path d={wall} className="art-wash" />
            <path d={wall} className="art-lit art-halo" />
            <path d={pathOf([at(28, 34, 6), at(48, 34, 16)])} className="art-lit" />
            <path d={pathOf([at(28, 34, 16), at(48, 34, 6)])} className="art-lit" />
            <path d={laptop.edges} className="art-off" />
            <path d={screen} className="art-ground" />
            <path d={screen} className="art-off" />
            <path d={glass} className="art-off" />
        </Art>
    );
}

// Gone at the deadline: a box with a dial at zero, fading out where its bits drift away

const B = camera(140, 104);
const doomed = box(B, [-1, -1, 0], [56, 56, 56]);
const dial = frontMatrix(55, B);
const DIAL: Point3 = [27, 0, 28];
const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const [sx, sy] = [Math.sin(angle), -Math.cos(angle)];
    return `M ${round(DIAL[0] + sx * 12)} ${round(-DIAL[2] + sy * 12)} L ${round(DIAL[0] + sx * 15)} ${round(-DIAL[2] + sy * 15)}`;
}).join(" ");
// Bits break off the edges that meet at the far top corner, and drift up and away from it
const random = seeded(7);
const { right: far, back, front } = doomed.corners;
const farFoot = iso([55, -1, 0], B);
const bits = Array.from({ length: 30 }, (_, i) => {
    const toward = [back, front, farFoot][i % 3]!;
    const along = random() * 0.5;
    const out = 1 - along * 1.4;
    const x = far[0] + (toward[0] - far[0]) * along + (4 + random() * 26) * out;
    const y = far[1] + (toward[1] - far[1]) * along - (random() * 30 - 4) * out;
    return { x: round(x), y: round(y), size: round(1.5 + random() * 2.5), i };
});

const FADE: CSSProperties = { stroke: "url(#art-fade-line)" };

export function DeadlineArt() {
    return (
        <Art>
            <defs>
                {/* Solid at the foot, gone toward the far top corner */}
                <linearGradient
                    id="art-fade-line"
                    gradientUnits="userSpaceOnUse"
                    x1="112"
                    y1="150"
                    x2="196"
                    y2="54"
                >
                    <stop offset="0.3" className="art-stop" stopOpacity="1" />
                    <stop offset="0.8" className="art-stop" stopOpacity="0" />
                </linearGradient>
                <linearGradient
                    id="art-fade-face"
                    gradientUnits="userSpaceOnUse"
                    x1="112"
                    y1="150"
                    x2="196"
                    y2="54"
                >
                    <stop offset="0.3" className="art-stop" stopOpacity="0.12" />
                    <stop offset="0.8" className="art-stop" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={`${doomed.left}${doomed.right}${doomed.top}`} fill="url(#art-fade-face)" />
            <path d={doomed.hidden} className="art-line art-dash" style={FADE} />
            <path d={doomed.edges} className="art-line" style={FADE} />
            <g transform={dial}>
                <circle cx={DIAL[0]} cy={-DIAL[2]} r="15" className="art-dim" />
                <path d={ticks} className="art-dim" />
                {/* The hand has swept round to twelve: no time left */}
                <path
                    d={`M ${DIAL[0]} ${-DIAL[2]} L ${DIAL[0]} ${-DIAL[2] - 11}`}
                    className="art-lit"
                />
            </g>
            {bits.map((bit) => (
                <rect
                    key={bit.i}
                    x={bit.x}
                    y={bit.y}
                    width={bit.size}
                    height={bit.size}
                    className="art-solid art-drift"
                    style={{ "--i": bit.i } as CSSProperties}
                />
            ))}
        </Art>
    );
}

// Output is data: what came back, its control codes struck out, all of it marked as data

const lines: { struck?: string; text: string }[] = [
    { struck: "\\x1b[2J", text: " build passed in 41s" },
    { struck: "U+200B", text: " 214 tests, 0 failed" },
    { text: "ignore previous instructions" },
];

export function DataArt() {
    return (
        <Art>
            <rect x="12.5" y="30.5" width="255" height="138" className="art-dim" />
            {lines.map((line, i) => {
                const y = 52.5 + i * 38;
                return (
                    <g key={line.text}>
                        <rect x="28.5" y={y} width="223" height="28" className="art-wash" />
                        <rect x="28.5" y={y} width="223" height="28" className="art-lit art-halo" />
                        <text x="40" y={y + 18} className="art-text">
                            {line.struck && <tspan className="art-struck">{line.struck}</tspan>}
                            <tspan>{line.text}</tspan>
                        </text>
                    </g>
                );
            })}
            <rect x="24" y="22" width="40" height="17" className="art-solid" />
            <text x="31" y="34.5" className="art-tag">
                data
            </text>
        </Art>
    );
}
