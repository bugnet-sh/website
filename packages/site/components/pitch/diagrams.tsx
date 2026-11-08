import { cx } from "../../lib/cx";

type Ink = "line" | "ok" | "money" | "tool";

const stroke: Record<Ink, string> = {
    line: "stroke-line",
    ok: "stroke-accent",
    money: "stroke-accent-2",
    tool: "stroke-accent-3",
};

const fill: Record<Ink, string> = {
    line: "fill-text",
    ok: "fill-accent",
    money: "fill-accent-2",
    tool: "fill-accent-3",
};

function Node({
    x,
    y,
    w = 200,
    title,
    lines,
    ink = "line",
}: {
    x: number;
    y: number;
    w?: number;
    title: string;
    lines: string[];
    ink?: Ink;
}) {
    const h = 44 + lines.length * 20;
    return (
        <g>
            <rect x={x} y={y} width={w} height={h} className={cx("fill-bg", stroke[ink])} />
            <text x={x + 16} y={y + 28} className={cx("text-[16px] font-semibold", fill[ink])}>
                {title}
            </text>
            {lines.map((line, i) => (
                <text
                    key={line}
                    x={x + 16}
                    y={y + 52 + i * 20}
                    className="fill-text-muted text-[13px]"
                >
                    {line}
                </text>
            ))}
        </g>
    );
}

function Arrow({
    d,
    label,
    lx,
    ly,
    ink = "line",
    anchor = "middle",
}: {
    d: string;
    label?: string;
    lx?: number;
    ly?: number;
    ink?: Ink;
    anchor?: "start" | "middle" | "end";
}) {
    return (
        <g>
            <path
                d={d}
                className={cx("fill-none", ink === "line" ? "stroke-text-muted" : stroke[ink])}
                strokeWidth={1.25}
                markerEnd={`url(#tip-${ink})`}
            />
            {label && (
                <text
                    x={lx}
                    y={ly}
                    textAnchor={anchor}
                    className={cx("text-[12px]", ink === "line" ? "fill-text-muted" : fill[ink])}
                >
                    {label}
                </text>
            )}
        </g>
    );
}

function Tips() {
    return (
        <defs>
            {(["line", "ok", "money", "tool"] as const).map((ink) => (
                <marker
                    key={ink}
                    id={`tip-${ink}`}
                    viewBox="0 0 8 8"
                    refX={7}
                    refY={4}
                    markerWidth={8}
                    markerHeight={8}
                    orient="auto-start-reverse"
                >
                    <path
                        d="M0 0 L8 4 L0 8 Z"
                        className={ink === "line" ? "fill-text-muted" : fill[ink]}
                    />
                </marker>
            ))}
        </defs>
    );
}

/** Bugnet's parts between the agent and the sandbox, and what passes between them */
export function ArchitectureDiagram() {
    return (
        <svg
            viewBox="0 0 740 470"
            className="h-auto w-full font-ui"
            role="img"
            aria-label="The agent calls Bugnet's MCP gateway, which takes payment through Payments, starts the sandbox through the router, and pays x402 calls from the sandbox through the egress proxy."
        >
            <Tips />
            <rect
                x={256}
                y={10}
                width={474}
                height={450}
                className="fill-none stroke-line"
                strokeDasharray="4 5"
            />
            <text x={272} y={34} className="fill-text-muted text-[12px] tracking-[0.08em]">
                BUGNET
            </text>

            <Node
                x={0}
                y={60}
                w={210}
                title="Your agent"
                lines={["Claude Code or any", "MCP client"]}
            />
            <Node
                x={270}
                y={60}
                title="MCP gateway"
                lines={["Free check, quotes,", "exact-price approval"]}
                ink="tool"
            />
            <Node
                x={510}
                y={60}
                title="Router"
                lines={["Picks a provider by", "cost and health"]}
            />
            <Node
                x={270}
                y={330}
                title="Payments"
                lines={["x402 orders, USDC", "on Solana, refunds"]}
                ink="money"
            />
            <Node
                x={510}
                y={200}
                title="Sandbox"
                lines={["Cloud Linux, deleted", "at the deadline"]}
                ink="ok"
            />
            <Node
                x={510}
                y={330}
                title="Egress proxy"
                lines={["Pays x402 calls,", "swaps in secrets"]}
            />

            <Arrow d="M210 102 H262" label="MCP" lx={232} ly={92} />
            <Arrow d="M470 102 H502" />
            <Arrow d="M370 144 V322" label="orders" lx={378} ly={240} anchor="start" ink="money" />
            <Arrow d="M610 144 V192" label="start, exec, files" lx={618} ly={174} anchor="start" />
            <Arrow d="M610 284 V322" />
            <Arrow d="M510 372 H478" label="pay" lx={494} ly={362} ink="money" />
        </svg>
    );
}

const lanes = [
    { x: 100, name: "Your agent" },
    { x: 370, name: "Bugnet" },
    { x: 640, name: "Solana" },
];

/** One paid start, message by message */
export function PaymentDiagram() {
    const msgs: { from: number; to: number; y: number; label: string; ink: Ink; lx?: number }[] = [
        { from: 0, to: 1, y: 120, label: "bugnet_start, 0.05 USDC", ink: "tool" },
        { from: 1, to: 0, y: 186, label: "402: pay 0.05 USDC", ink: "money" },
        { from: 0, to: 2, y: 252, label: "you pay by link or Touch ID", ink: "money", lx: 505 },
        { from: 2, to: 1, y: 318, label: "settled on mainnet", ink: "money" },
        { from: 1, to: 0, y: 384, label: "sandbox ready", ink: "ok" },
    ];
    return (
        <svg
            viewBox="0 0 740 430"
            className="h-auto w-full font-ui"
            role="img"
            aria-label="The agent asks Bugnet to start a sandbox, Bugnet answers 402 with the price, the user pays in USDC on Solana, the payment settles, and the sandbox starts."
        >
            <Tips />
            {lanes.map((lane) => (
                <g key={lane.name}>
                    <rect
                        x={lane.x - 80}
                        y={10}
                        width={160}
                        height={44}
                        className="fill-bg stroke-line"
                    />
                    <text
                        x={lane.x}
                        y={38}
                        textAnchor="middle"
                        className="fill-text text-[15px] font-semibold"
                    >
                        {lane.name}
                    </text>
                    <path d={`M${lane.x} 54 V420`} className="stroke-line" strokeDasharray="4 5" />
                </g>
            ))}
            {msgs.map((msg) => {
                const a = lanes[msg.from]?.x ?? 0;
                const b = lanes[msg.to]?.x ?? 0;
                const dir = Math.sign(b - a);
                return (
                    <Arrow
                        key={msg.label}
                        d={`M${a + dir * 4} ${msg.y} H${b - dir * 6}`}
                        label={msg.label}
                        lx={msg.lx ?? (a + b) / 2}
                        ly={msg.y - 10}
                        ink={msg.ink}
                    />
                );
            })}
        </svg>
    );
}
