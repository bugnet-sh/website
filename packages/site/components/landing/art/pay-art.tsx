import { cylinder, frontMatrix, iso, pathOf, type SolidPaths } from "../../iso/iso-kit";
import { Art, GlassBox } from "./art";
import { box, camera } from "./line-art";

/*
 * The three drawings share one ground: each one's lowest point sits on GROUND, and each is
 * centred across the 280 units of its box, so side by side they line up. Every line starts
 * under the solid it leaves (hidden by that solid's fill) and ends on an arrowhead or a part.
 * The offsets below are the kit's projection of each part, measured once.
 */
const GROUND = 156;

function Coin({ paths }: { paths: SolidPaths }) {
    return (
        <g>
            <path d={paths.fill} className="art-ground" />
            <path d={paths.top} className="art-wash" />
            <path d={`${paths.outline}${paths.crease}`} className="art-lit" />
        </g>
    );
}

/** A dashed run at height y from x `from` to an arrowhead whose tip is at x `to` */
function Arrow({ from, to, y }: { from: number; to: number; y: number }) {
    const back = to > from ? -6 : 6;
    return (
        <g>
            <path d={`M ${from} ${y} H ${to}`} className="art-dim art-dash" />
            <path
                d={`M ${to + back} ${y - 5} L ${to} ${y} L ${to + back} ${y + 5}`}
                className="art-lit"
            />
        </g>
    );
}

// No API key needed: the sandbox, and the paid APIs it can pick from, one of them picked.
// A 40-unit cube reaches 35.8 below its origin and 35.8 to each side; the middle of its right
// edge is 4 above the origin, level with the middle of the list

const C1 = camera(70, GROUND - 35.8);
const sandbox = box(C1, [0, 0, 0], [40, 40, 40]);
const prompt = frontMatrix(40, C1);
const LIST_X = 136;
const MID = Math.round(GROUND - 35.8 - 4);
const CHIP = 24;
const GAP = 4;
const apis = ["search", "chat", "translate"];
const chipY = (i: number) => MID - CHIP / 2 + (i - 1) * (CHIP + GAP) + 0.5;

export function FindArt() {
    return (
        <Art>
            <path d={`M ${70 + 35.8} ${MID} H ${LIST_X}`} className="art-dim art-dash" />
            <GlassBox paths={sandbox} />
            <g transform={prompt}>
                <path d="M 8 -20 l 5 -4 l -5 -4 M 16 -19 h 7" className="art-lit" />
            </g>
            {apis.map((api, i) => {
                const y = chipY(i);
                const picked = i === 1;
                return (
                    <g key={api}>
                        <rect
                            x={LIST_X + 0.5}
                            y={y}
                            width="110"
                            height={CHIP}
                            className={picked ? "art-wash" : "art-ground"}
                        />
                        <rect
                            x={LIST_X + 0.5}
                            y={y}
                            width="110"
                            height={CHIP}
                            className={picked ? "art-lit art-halo" : "art-faint"}
                        />
                        <text
                            x={LIST_X + 10}
                            y={y + 16}
                            className={picked ? "art-text art-text-lit" : "art-text"}
                        >
                            {api}
                        </text>
                    </g>
                );
            })}
        </Art>
    );
}

// Paid call by call: the allowance as a stack of coins, approved once, paying out a coin a call.
// A coin of radius 22 reaches 13.9 below its origin and 27.8 to each side; the stack's top rim
// is 37.5 above it

const STACK_X = 79;
const STACK_Y = GROUND - 13.9;
const C2 = camera(STACK_X, STACK_Y);
const stack = Array.from({ length: 5 }, (_, i) => cylinder(0, 0, 22, i * 4.5, 3.5, C2, 48));
const sent = [52, 86, 120].map((dx) =>
    cylinder(0, 0, 7, 0, 2.5, camera(STACK_X + dx, STACK_Y), 24),
);
const OK = { x: STACK_X + 45, y: 59, size: 22 };

export function AllowanceArt() {
    return (
        <Art>
            <path
                d={`M ${OK.x} ${OK.y + OK.size / 2} H ${STACK_X} V ${STACK_Y - 37.5}`}
                className="art-dim art-dash"
            />
            <Arrow from={STACK_X} to={STACK_X + 150} y={STACK_Y} />
            {stack.map((coin, i) => (
                <Coin key={i} paths={coin} />
            ))}
            {sent.map((coin, i) => (
                <Coin key={i} paths={coin} />
            ))}
            {/* One approval */}
            <rect
                x={OK.x + 0.5}
                y={OK.y + 0.5}
                width={OK.size}
                height={OK.size}
                className="art-wash"
            />
            <rect
                x={OK.x + 0.5}
                y={OK.y + 0.5}
                width={OK.size}
                height={OK.size}
                className="art-lit art-halo"
            />
            <path d={`M ${OK.x + 5.5} ${OK.y + 11.5} l 4 4 l 8 -9`} className="art-lit" />
        </Art>
    );
}

// Capped and refunded: what was spent fills a glass column to its level, under the ring of the
// limit, and what is left runs back to the coins it came from. A 28 by 28 column reaches 25
// below its origin and 25 to each side; its left foot is 12.5 below the origin

const COL_X = 180;
const COL_Y = GROUND - 25;
const C3 = camera(COL_X, COL_Y);
const column = box(C3, [0, 0, 0], [28, 28, 64]);
const LEVEL = 24;
const LIMIT = 48;
const spent = box(C3, [0, 0, 0], [28, 28, LEVEL]);
const at = (x: number, y: number, z: number) => iso([x, y, z], C3);
// The level's near edges are lit and its far ones faint, so they never cross the limit's ring
const levelNear = pathOf([at(0, 28, LEVEL), at(28, 28, LEVEL), at(28, 0, LEVEL)]);
const levelFar = pathOf([at(0, 28, LEVEL), at(0, 0, LEVEL), at(28, 0, LEVEL)]);
const ring = pathOf([at(0, 28, LIMIT), at(28, 28, LIMIT), at(28, 0, LIMIT)]);
const REFUND_Y = COL_Y + 12.5;
const COINS_X = 89;
const back = [0, 4.5].map((z) => cylinder(0, 0, 11, z, 3.5, camera(COINS_X, REFUND_Y), 32));

export function LimitArt() {
    return (
        <Art>
            <Arrow from={COL_X - 25} to={COINS_X + 20} y={REFUND_Y} />
            <path d={`${spent.left}${spent.right}`} className="art-wash" />
            <path d={spent.top} className="art-wash" />
            <path d={levelFar} className="art-faint" />
            <GlassBox paths={column} />
            <path d={levelNear} className="art-lit" />
            <path d={ring} className="art-lit art-halo" />
            {back.map((coin, i) => (
                <Coin key={i} paths={coin} />
            ))}
        </Art>
    );
}
