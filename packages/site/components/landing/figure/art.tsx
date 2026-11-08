import { Dots, Halo, Line, Solid } from "../../iso/draw";
import {
    CABINET_ART,
    CART_ART,
    CHAMBER_ART,
    COIN_ART,
    CRADLE_ART,
    DIAL_PLANE,
    DRAWER_ART,
    LEDGE_ART,
    PLATE_ART,
    DRAIN_ART,
    ROOF_ART,
    type Recess,
    SIDE_ART,
    TERMINAL_ART,
} from "./geometry";
import { partsOf, type Rig } from "./parts";
import { LINES, poseAt, STILL } from "./tour";
import { DIAL, DROP, EX, EY, EZ, HEIGHT, LIFT, SCREEN, SPAN, TRAVEL, WIDTH } from "./view";

export const RIG: Rig = {
    ex: EX,
    ey: EY,
    ez: EZ,
    travel: TRAVEL,
    drop: DROP,
    lift: LIFT,
    hatch: CRADLE_ART.coverTravel,
    fall: COIN_ART.fall,
    shutter: CHAMBER_ART.shutter.travel,
    dial: {
        x: DIAL_PLANE.centre[0],
        y: DIAL_PLANE.centre[1],
        r: 12.6,
        from: -SPAN / 2,
        span: SPAN,
    },
};

const POSE = poseAt(STILL);
const PARTS = partsOf(POSE, RIG);

/** A moving part's hook for the live figure, in the pose the server draws. */
function hook(name: string) {
    const props: Record<string, string> = { "data-part": name };
    for (const [key, value] of Object.entries(PARTS[name] ?? {})) {
        if (value !== null) props[key === "clip-path" ? "clipPath" : key] = value;
    }
    return props;
}

function Hole({ recess, clip }: { recess: Recess; clip: string }) {
    return (
        <>
            <g clipPath={`url(#${clip})`}>
                <path className="sbx-dark" d={recess.back} />
                <path className="iso-top sbx-well" d={recess.tops} />
                <path className="iso-shade" data-shade="0" d={recess.sides} />
            </g>
            <Line d={recess.rim} tone="lo" />
        </>
    );
}

const PLATE = (
    <g key="plate">
        <Halo d={PLATE_ART.halo} />
        {PLATE_ART.feet.map((paths, index) => (
            <Solid key={index} paths={paths} tone="lo" />
        ))}
        <Solid paths={PLATE_ART.slab} tone="lo" />
        <Line d={PLATE_ART.groove} tone="faint" />
        <Line d={PLATE_ART.screwRings} tone="lo" />
        <Dots points={PLATE_ART.screws} />
        <Solid paths={PLATE_ART.label} tone="lo" crease="none" />
        <Line d={PLATE_ART.labelEdge} tone="faint" />
        <Line d={PLATE_ART.labelRule} tone="lo" free />
        <Dots points={PLATE_ART.labelScrews} size={0.45} />
    </g>
);

const C = CABINET_ART;
const CABINET = (
    <g key="cabinet">
        <Halo d={C.halo} />
        {C.feet.map((foot, index) => (
            <g key={index}>
                <Solid paths={foot.flange} tone="lo" />
                <Solid paths={foot.hex} tone="mid" />
                <Solid paths={foot.stem} tone="mid" crease="none" />
            </g>
        ))}
        <Solid paths={C.body} tone="mid" inner={<Line d={C.bodySeams} tone="faint" />} />
        <Dots points={C.faceScrews} />
        <Dots points={C.sideScrews} />
        <Line d={C.sideVents} tone="faint" />
        <Hole recess={C.opening} clip="sbx-opening" />
        <Line d={C.door} tone="lo" />
        {C.hinges.map((paths, index) => (
            <Solid key={index} paths={paths} tone="mid" />
        ))}
        <Line d={C.vents} tone="faint" />
        <Solid paths={C.latch} tone="mid" />
        <Line d={C.latchSlot} tone="lo" />
        <Solid paths={C.worktop} tone="mid" />
        <Solid paths={C.mount} tone="mid" />
        <Dots points={C.mountScrews} size={0.45} />
        <Solid paths={C.bezel} tone="hi" />
        <Line d={C.rim} tone="lo" />
        <Line d={C.faceRing} tone="faint" />
        <Line d={C.minor} tone="lo" />
        <Line d={C.major} tone="mid" />
        <path className="iso-line sbx-deadline" data-free="end" d={C.deadline} />
        <Dots points={[C.start]} size={0.7} tone="hi" />
        <g transform={DIAL_PLANE.matrix}>
            <path className="iso-line sbx-left" {...hook("remaining")} />
        </g>
        <Solid paths={DIAL_PLANE.hub} tone="mid" />
        <g transform={DIAL_PLANE.matrix}>
            <g {...hook("needle")}>
                <path
                    className="sbx-needle"
                    d={`M${DIAL.x - 0.9} ${-DIAL.z + 4}L${DIAL.x} ${-DIAL.z - 17.5}L${DIAL.x + 0.9} ${-DIAL.z + 4}Z`}
                />
            </g>
        </g>
    </g>
);

const T = TERMINAL_ART;
const LINE_STEP = 7.5;
const TERMINAL = (
    <g key="terminal">
        <Solid paths={T.plinth} tone="lo" />
        <Solid paths={T.body} tone="mid" inner={<Line d={T.band} tone="faint" />} />
        <Line d={T.vents} tone="faint" />
        <Line d={T.sideVents} tone="faint" />
        <Solid paths={T.plug} tone="mid" />
        <Line d={T.bezel} tone="faint" />
        <g clipPath="url(#sbx-screen)">
            <path className="iso-top" d={T.screen.tops} />
            <path className="iso-shade" data-shade="0" d={T.screen.sides} />
            <path className="sbx-glass-screen" d={T.screen.back} />
            <g transform={T.matrix}>
                <g className="sbx-screen" {...hook("screen")}>
                    <rect
                        className="sbx-glow"
                        x={SCREEN.x0 + 4}
                        y={-SCREEN.z1 + 4}
                        width={SCREEN.x1 - SCREEN.x0 - 8}
                        height={SCREEN.z1 - SCREEN.z0 - 8}
                    />
                    {LINES.map((line, index) => (
                        <text
                            key={index}
                            className="sbx-term"
                            x={SCREEN.x0 + 3.4}
                            y={-(SCREEN.z1 - 6.6 - index * LINE_STEP)}
                        >
                            <tspan data-part={`line-${index}`}>{POSE.lines[index]}</tspan>
                            <tspan
                                className="sbx-cursor"
                                data-part={`cursor-${index}`}
                                data-on={POSE.cursor === index ? "" : undefined}
                            >
                                _
                            </tspan>
                        </text>
                    ))}
                </g>
            </g>
        </g>
        <Line d={T.screen.rim} tone="lo" />
        <g className="sbx-led" {...hook("power")}>
            <Dots points={T.leds} size={0.7} tone="lo" />
        </g>
        <Solid paths={T.knob} tone="mid" />
        <Line d={T.knobRing} tone="lo" />
    </g>
);

function Cartridge({ art }: { art: (typeof CART_ART)["seated"] }) {
    return (
        <>
            <Solid paths={art.body} tone="hi" />
            <Line d={art.grip} tone="lo" />
            <Line d={art.label} tone="lo" />
            <Line d={art.rule} tone="lo" free />
            <Solid paths={art.notch} tone="mid" />
        </>
    );
}

const R = CRADLE_ART;
const CRADLE = (
    <g key="cradle">
        <Solid paths={R.plugCradle} tone="mid" />
        <path className="sbx-cable" d={R.cable} />
        <Solid paths={R.base} tone="mid" />
        <Dots points={R.holeScrews} size={0.45} />
        <Hole recess={R.hole} clip="sbx-hole" />
        <g {...hook("hatch-back")}>
            <Solid paths={R.covers[0]!} tone="mid" />
        </g>
        <g {...hook("hatch-front")}>
            <Solid paths={R.covers[1]!} tone="mid" />
        </g>
        <Solid paths={R.leftPost} tone="mid" />
        <g clipPath="url(#sbx-lift)">
            <g {...hook("lift")}>
                <Cartridge art={CART_ART.seated} />
            </g>
        </g>
        <Solid paths={R.pad} tone="mid" />
        <Solid paths={R.rightPost} tone="mid" />
        <Solid paths={R.bar} tone="mid" />
        <Dots points={R.barScrews} size={0.45} />
        <g className="sbx-led" {...hook("seated")}>
            <Dots points={[R.led]} size={0.8} tone="lo" />
        </g>
    </g>
);

const DRAIN = (
    <g key="drain">
        <Solid paths={DRAIN_ART.plate} tone="lo" />
        <path className="sbx-dark" d={DRAIN_ART.grate} />
        <Line d={DRAIN_ART.bars} tone="lo" />
        <Line d={DRAIN_ART.grate} tone="lo" />
        <Dots points={DRAIN_ART.screws} size={0.45} />
    </g>
);

const H = CHAMBER_ART;
const SH = H.shutter;
const CHAMBER = (
    <g key="chamber">
        <Solid paths={H.shell} tone="mid" inner={<Line d={H.shellSeam} tone="faint" />} />
        <Solid paths={H.roof} tone="mid" />
        <g clipPath="url(#sbx-window)">
            <g className="sbx-cavity">
                <path className="iso-shade" data-shade="1" d={H.cavity.back} />
                <path className="iso-shade" data-shade="0" d={H.cavity.left} />
                <path className="iso-top" d={H.cavity.floor} />
                <path className="sbx-grid" d={H.cavity.grid} />
                {DRAIN}
                {TERMINAL}
                {CRADLE}
            </g>
            <path className="sbx-glass" d={H.glass} />
            <Line d={H.streaks} tone="faint" />
        </g>
        <g transform={SH.matrix} clipPath="url(#sbx-shutter)">
            <g {...hook("shutter")}>
                <path className="sbx-curtain" d={SH.sheet} />
                <path className="iso-line" data-tone="lo" d={SH.slats} />
                <path className="sbx-foot" d={SH.foot} />
            </g>
        </g>
        <Line d={H.window} tone="lo" />
        <Dots points={H.bolts} size={0.5} />
        {H.guides.map((paths, index) => (
            <Solid key={index} paths={paths} tone="mid" />
        ))}
        <Solid paths={H.housing} tone="mid" inner={<Line d={H.housingSeam} tone="faint" />} />
        <Dots points={H.housingScrews} size={0.45} />
    </g>
);

const S = SIDE_ART;
const SIDE = (
    <g key="side">
        <Line d={S.panel} tone="faint" />
        <Solid paths={S.port} tone="mid" />
        <Dots points={S.portBolts} size={0.5} />
        <Solid paths={S.cap} tone="mid" />
        <Line d={S.capRing} tone="faint" />
        <Solid paths={S.flange} tone="mid" />
        <Dots points={S.flangeBolts} size={0.45} />
        <Solid paths={S.duct} tone="mid" crease="none" />
        {S.bands.map((paths, index) => (
            <Solid key={index} paths={paths} tone="mid" />
        ))}
    </g>
);

const F = ROOF_ART;
const ROOF = (
    <g key="roof">
        <Solid paths={F.hepa} tone="mid" inner={<Line d={F.hepaSeam} tone="faint" />} />
        <Line d={F.hepaFrame} tone="lo" />
        <Line d={F.pleats} tone="faint" />
        <Solid paths={F.collar} tone="mid" />
        <Solid paths={F.stack} tone="mid" crease="none" />
        <Solid paths={F.band} tone="mid" />
        <Solid paths={F.stackUp} tone="mid" inner={<Line d={F.stackSeam} tone="faint" />} />
        <Solid paths={F.lampBase} tone="mid" />
        <Solid paths={F.lamp} tone="mid" inner={<Line d={F.lampRing} tone="faint" />} />
    </g>
);

const L = LEDGE_ART;
const LEDGE = (
    <g key="ledge">
        <Solid paths={L.ruler} tone="lo" crease="none" />
        <Line d={L.rulerEdge} tone="faint" />
        <Line d={L.rulerTicks.minor} tone="lo" />
        <Line d={L.rulerTicks.major} tone="mid" />
        <Solid paths={L.lampPlate} tone="lo" crease="none" />
        <Dots points={L.lampScrews} size={0.45} />
        {L.lamps.map((lamp, index) => (
            <g key={index}>
                <Solid paths={lamp.base} tone="mid" />
                <g className="sbx-lamp" {...hook(index ? "inner-lamp" : "outer-lamp")}>
                    <Solid paths={lamp.lens} tone="mid" />
                </g>
            </g>
        ))}
        <Solid paths={L.acceptor} tone="mid" inner={<Line d={L.acceptorSeam} tone="faint" />} />
        <Dots points={L.sideScrews} size={0.45} />
        <Dots points={L.frontScrews} size={0.45} />
        <Solid paths={L.bezel} tone="hi" />
        <Hole recess={L.slot} clip="sbx-slot" />
        <Solid paths={L.returnButton} tone="mid" />
        <g className="sbx-lamp" {...hook("paid")}>
            <Solid paths={L.paidLamp} tone="mid" />
        </g>
    </g>
);

const COIN = (
    <g key="coin" clipPath="url(#sbx-coin)">
        <g className="sbx-coin" {...hook("coin")}>
            <Solid paths={COIN_ART.body} tone="hi" />
            <Line d={COIN_ART.rim} tone="lo" />
            <Line d={COIN_ART.mark} tone="mid" free />
        </g>
    </g>
);

const D = DRAWER_ART;
const DRAWER = (
    <g key="drawer">
        <g {...hook("drawer-window")}>
            <g {...hook("drawer")}>
                <Solid paths={D.floor} tone="lo" />
                <Solid paths={D.back} tone="mid" />
                <Solid paths={D.left} tone="mid" />
                <Solid paths={D.seat} tone="mid" />
                <g {...hook("drawer-cart")}>
                    <Cartridge art={CART_ART.inDrawer} />
                </g>
                <Solid paths={D.right} tone="mid" />
            </g>
        </g>
        <g {...hook("drawer")}>
            <Solid paths={D.panel} tone="mid" inner={<Line d={D.gasket} tone="faint" />} />
            <Dots points={D.panelScrews} size={0.45} />
            <Solid paths={D.holder} tone="lo" crease="none" />
            <Line d={D.holderEdge} tone="faint" />
            <Line d={D.holderRule} tone="lo" free />
            {D.posts.map((paths, index) => (
                <Solid key={index} paths={paths} tone="mid" />
            ))}
            <Solid paths={D.pull} tone="hi" />
        </g>
    </g>
);

const DEFS = (
    <defs key="defs">
        <clipPath id="sbx-window">
            <path d={H.windowClip} />
        </clipPath>
        <clipPath id="sbx-screen">
            <path d={T.screen.clip} />
        </clipPath>
        <clipPath id="sbx-shutter">
            <path d={SH.clip} />
        </clipPath>
        <clipPath id="sbx-lift">
            <path d={R.lift} />
        </clipPath>
        <clipPath id="sbx-coin">
            <path d={L.coinClip} />
        </clipPath>
        <clipPath id="sbx-opening">
            <path d={C.opening.clip} />
        </clipPath>
        <clipPath id="sbx-hole">
            <path d={R.hole.clip} />
        </clipPath>
        <clipPath id="sbx-slot">
            <path d={L.slot.clip} />
        </clipPath>
        <clipPath id="sbx-drawer">
            <path d={D.clip} />
        </clipPath>
        <clipPath id="sbx-drawer-open">
            <path d={D.clipOpen} />
        </clipPath>
    </defs>
);

const LABEL =
    "A sealed sandbox cabinet. A USDC coin drops into its slot and a code cartridge goes in through an airlock drawer. Inside the glass chamber a terminal runs the agent's commands while a ten-minute dial counts down. At the deadline a shutter comes down, and the chamber is left empty.";

export const ART = (
    <svg
        key="art"
        className="iso-svg sbx-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={LABEL}
        focusable="false"
    >
        {DEFS}
        {PLATE}
        {CABINET}
        {CHAMBER}
        {SIDE}
        {ROOF}
        {LEDGE}
        {COIN}
        {DRAWER}
    </svg>
);
