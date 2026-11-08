import { cylinder, frontMatrix, iso, pathOf, type SolidPaths } from "../../iso/iso-kit";
import { Art, GlassBox } from "./art";
import { box, camera } from "./line-art";

// Each drawing stands alone in its cell: no line runs from one cell into the next

/** A coin, solid so no line shows through it; a dim one is a coin already paid out */
function Coin({ paths, dim = false }: { paths: SolidPaths; dim?: boolean }) {
    return (
        <g>
            <path d={paths.fill} className="art-ground" />
            <path d={paths.top} className="art-wash" />
            <path d={`${paths.outline}${paths.crease}`} className={dim ? "art-dim" : "art-lit"} />
        </g>
    );
}

/** A dashed run that ends in an arrowhead at (x, y), pointing left or right */
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

// No API key needed: the sandbox, and the paid APIs it can pick from, one of them picked

const C1 = camera(70, 124);
const sandbox = box(C1, [0, 0, 0], [40, 40, 40]);
const prompt = frontMatrix(40, C1);
const apis = ["search", "chat", "translate"];

export function FindArt() {
    return (
        <Art>
            <path d="M 106 120 H 130 V 92.5 H 152" className="art-dim art-dash" />
            <GlassBox paths={sandbox} />
            <g transform={prompt}>
                <path d="M 8 -20 l 5 -4 l -5 -4 M 16 -19 h 7" className="art-lit" />
            </g>
            {apis.map((api, i) => {
                const y = 52.5 + i * 28;
                const picked = i === 1;
                return (
                    <g key={api}>
                        <rect
                            x="152.5"
                            y={y}
                            width="110"
                            height="24"
                            className={picked ? "art-wash" : "art-ground"}
                        />
                        <rect
                            x="152.5"
                            y={y}
                            width="110"
                            height="24"
                            className={picked ? "art-lit art-halo" : "art-faint"}
                        />
                        <text
                            x="162"
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

// Paid call by call: the allowance as a stack of coins, approved once, paying out one coin a
// call along a short run that ends in its arrowhead

const C2 = camera(80, 140);
const stack = Array.from({ length: 5 }, (_, i) => cylinder(0, 0, 22, i * 4.5, 3.5, C2, 48));
const PAY_Y = 156;
// The top coin's far rim, where the approval's line comes down to meet the stack
const STACK_TOP = 140 - 4 * 4.5 - 3.5 - 11;
const sent = [140, 176, 212].map((x) => cylinder(0, 0, 7, 0, 2.5, camera(x, PAY_Y - 4), 24));

export function AllowanceArt() {
    return (
        <Art>
            <path d={`M 124 64.5 H 80 V ${STACK_TOP}`} className="art-dim art-dash" />
            {stack.map((coin, i) => (
                <Coin key={i} paths={coin} />
            ))}
            <Arrow from={108} to={246} y={PAY_Y} />
            {sent.map((coin, i) => (
                <Coin key={i} paths={coin} dim={i > 0} />
            ))}
            {/* One approval */}
            <rect x="124.5" y="53.5" width="22" height="22" className="art-wash" />
            <rect x="124.5" y="53.5" width="22" height="22" className="art-lit art-halo" />
            <path d="M 129.5 64.5 l 4 4 l 8 -9" className="art-lit" />
        </Art>
    );
}

// Capped and refunded: what was spent fills a glass column up to the ring of the limit, and what
// is left runs back to the coins it came from

const C3 = camera(182, 132);
const column = box(C3, [0, 0, 0], [28, 28, 78]);
const spent = box(C3, [2, 2, 0], [24, 24, 46]);
const at = (x: number, y: number, z: number) => iso([x, y, z], C3);
// The limit is a line round the column's two front faces, flush with the glass
const LIMIT = 60;
const ring = pathOf([at(0, 28, LIMIT), at(28, 28, LIMIT), at(28, 0, LIMIT)]);
const leftFoot = at(0, 28, 0);
const REFUND_Y = Math.round(leftFoot[1]) + 0.5;
const back = [0, 4.5].map((z) => cylinder(0, 0, 10, z, 3.5, camera(84, REFUND_Y + 2), 32));

export function LimitArt() {
    return (
        <Art>
            <path d={`${spent.left}${spent.right}${spent.top}`} className="art-wash" />
            <path d={spent.edges} className="art-dim" />
            <path d={spent.top} className="art-lit" />
            <GlassBox paths={column} />
            <path d={ring} className="art-lit art-halo" />
            <Arrow from={Math.round(leftFoot[0]) - 4} to={102} y={REFUND_Y} />
            {back.map((coin, i) => (
                <Coin key={i} paths={coin} />
            ))}
        </Art>
    );
}
