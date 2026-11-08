import { cylinder, frontMatrix, iso, type SolidPaths } from "../../iso/iso-kit";
import { Art, GlassBox } from "./art";
import { ART_W, box, camera, plate } from "./line-art";

// The three drawings share one line at the same height, so side by side they read as one flow
// of payments across the band. The line runs far past the drawing, and each cell cuts it at its
// own edges, however wide the cell is
const FLOW = 160;
const FAR = 800;

function Flow({ from = -FAR, to = ART_W + FAR }: { from?: number; to?: number }) {
    return <path d={`M ${from} ${FLOW} H ${to}`} className="art-dim art-flow" />;
}

function Coin({ paths }: { paths: SolidPaths }) {
    return (
        <g>
            <path d={paths.fill} className="art-ground" />
            <path d={paths.top} className="art-wash" />
            <path d={`${paths.outline}${paths.crease}`} className="art-lit" />
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
            <Flow from={70} />
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

// Paid call by call: the allowance as a stack of coins, approved once, paying out along the line

const C2 = camera(96, 146);
const stack = Array.from({ length: 5 }, (_, i) => cylinder(0, 0, 22, i * 4.5, 3.5, C2, 48));
const sent = [160, 196, 232].map((x) => cylinder(0, 0, 7, 0, 2.5, camera(x, 155.5), 24));

export function AllowanceArt() {
    return (
        <Art>
            <Flow />
            <path d="M 140 70.5 H 96 V 104" className="art-dim art-dash" />
            {stack.map((coin, i) => (
                <Coin key={i} paths={coin} />
            ))}
            {sent.map((coin, i) => (
                <g key={i} opacity={1 - i * 0.3}>
                    <Coin paths={coin} />
                </g>
            ))}
            {/* One approval */}
            <rect x="140.5" y="59.5" width="22" height="22" className="art-wash" />
            <rect x="140.5" y="59.5" width="22" height="22" className="art-lit art-halo" />
            <path d="M 145.5 70.5 l 4 4 l 8 -9" className="art-lit" />
        </Art>
    );
}

// Capped and refunded: what was spent rises in a glass column under the limit, and what is left
// runs back along the line the other way

const C3 = camera(144, 135);
const column = box(C3, [0, 0, 0], [28, 28, 78]);
const spent = box(C3, [2, 2, 0], [24, 24, 46]);
const limit = plate(C3, [-7, -7, 60], [42, 42]);
const foot = iso([0, 28, 0], C3);

export function LimitArt() {
    return (
        <Art>
            <Flow to={144} />
            <path d={`M ${foot[0]} ${foot[1]} V 172 H ${-FAR}`} className="art-dim art-dash" />
            <path d="M 36 167 L 28 172 L 36 177" className="art-lit" />
            <path d={`${spent.left}${spent.right}${spent.top}`} className="art-wash" />
            {/* The level reached, a shade brighter than the sides */}
            <path d={spent.top} className="art-wash" />
            <path d={spent.edges} className="art-dim" />
            <path d={spent.top} className="art-lit" />
            <GlassBox paths={column} />
            <path d={limit} className="art-lit art-dash art-halo" />
        </Art>
    );
}
