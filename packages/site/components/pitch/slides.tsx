import { cx } from "../../lib/cx";
import { Cell, Cells, Slide, solana, type } from "./slide";

export const problems = [
    {
        head: "Malicious code",
        text: "A repo, model or script someone sent runs on your computer, next to your files, keys and wallets.",
    },
    {
        head: "Not enough resources",
        text: "Too little memory or disk, or the wrong OS for the tool you want to try.",
    },
    {
        head: "A busy laptop",
        text: "Builds, installs and long jobs keep your computer busy.",
    },
    {
        head: "Sign-ups everywhere",
        text: "Cloud sandboxes want an account, an API key and a card before the first run.",
    },
];

export const solutionStats = [
    { head: "0.05\u00a0USDC", text: "for 10\u00a0minutes on 2\u00a0vCPU and 2\u00a0GiB" },
    { head: "14 to 29\u00a0s", text: "from payment to a ready sandbox" },
    { head: "0", text: "accounts, API keys or cards" },
];

export const steps = [
    {
        head: "Ask",
        text: "Ask your agent to try a repo or a model. It checks the code for free first.",
    },
    { head: "Approve", text: "Your agent names the size and the price. You approve the call." },
    { head: "Pay", text: "Pay in USDC on Solana, by link or from your wallet with Touch ID." },
    { head: "Run", text: "Commands run in a fresh cloud sandbox. It is deleted at the deadline." },
];

export const audiences = [
    {
        head: "Developers using AI agents",
        text: "Their agent offers a sandbox before it runs code nobody has checked.",
    },
    {
        head: "Anyone sent a repo or a script",
        text: "Try it without letting it near your computer.",
    },
    {
        head: "Jobs too big for a laptop",
        text: "Builds, tests and long installs on a cloud machine sized to the job.",
    },
];

export const columns = ["Bugnet", "Sandbox APIs", "Your computer"];

export const comparison: { row: string; cells: [string, string, string] }[] = [
    { row: "Sign-up", cells: ["None", "Account and API key", "None"] },
    { row: "Payment", cells: ["Per run, in USDC", "Billing account", "Your own hardware"] },
    { row: "Setup", cells: ["One command", "SDK in your code", "Docker or a VM"] },
    { row: "Started by", cells: ["Your agent, when it fits", "Your code", "You"] },
    { row: "Your files and keys", cells: ["Out of reach", "Out of reach", "At risk"] },
];

export const solanaFacts = [
    {
        head: "Agents can't sign up",
        text: "Your agent asks for a sandbox, Bugnet names the price, and the sandbox starts once you pay. That's x402, an open standard for paying on the web.",
    },
    {
        head: "Small payments work",
        text: "A sandbox costs 0.05\u00a0USDC, and Bugnet pays the network fees.",
    },
    {
        head: "Settles in seconds",
        text: "USDC on Solana mainnet, confirmed before the sandbox starts.",
    },
    {
        head: "Pay your way",
        text: "By link with Phantom or Solflare, or from a local wallet with Touch ID.",
    },
];

export const safety = [
    {
        head: "Free check first",
        text: "Rule-based, with no AI on our side: repo age and stars, install scripts that fetch binaries, hidden code, model files that run code.",
    },
    {
        head: "Sealed off",
        text: "The sandbox can't reach your files, keys or local network. Cloud metadata and private networks are blocked.",
    },
    {
        head: "Exact price",
        text: "You approve every payment. Bugnet refuses any price but the one you approved.",
    },
    {
        head: "Deleted",
        text: "Everything in the sandbox is deleted at the deadline.",
    },
];

export const apiStats = [
    { head: "0%", text: "margin on API calls" },
    { head: "0.50\u00a0USDC", text: "at most per call" },
    { head: "5\u00a0USDC", text: "at most per sandbox" },
];

export const business = [
    {
        head: "Per-run packages",
        text: "Fixed sizes and prices, from 0.05\u00a0USDC for 2\u00a0vCPU, 2\u00a0GiB and 10\u00a0minutes.",
    },
    {
        head: "50% margin floor",
        text: "The router places a run only where compute costs at most half its price.",
    },
    {
        head: "API calls at cost",
        text: "No margin on x402 calls. A sandbox that buys an allowance pays a 0.003\u00a0USDC fee once.",
    },
    {
        head: "No chargebacks",
        text: "USDC payments are final, with no card fees.",
    },
];

export const today = [
    {
        head: "Mainnet",
        text: "Pay, start, run, preview, stop and refund work end to end with real USDC on our test stack.",
    },
    {
        head: "84%",
        text: "Agents offered Bugnet where a sandbox fit, against 30% that suggested any sandbox without it. 324 Claude Code runs.",
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

export const next = [
    "Public launch of the server and the site",
    "GPU sandboxes",
    "Agents that pay from their own wallet",
    "Live tests in Cursor, Codex and VS Code",
];

/** The rendered mark, on the first and the last slide */
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

/** The deck, in the order it is told */
export function PitchSlides() {
    return (
        <>
            <Slide n={1} plain>
                <div className="grid flex-1 grid-cols-[1fr_auto] items-center gap-[4cqi] phone:grid-cols-1">
                    <div>
                        <h1 className={cx(type.hero, "whitespace-nowrap phone:whitespace-normal")}>
                            Throwaway sandboxes
                            <br />
                            for AI agents.
                        </h1>
                        <p className={cx(type.lead, "mt-[2cqi] phone:mt-(--space-4)")}>
                            Pay per run in USDC on <span className={solana}>Solana</span>. No
                            account, no API key.
                        </p>
                    </div>
                    <Mark />
                </div>
            </Slide>

            <Slide n={2} title="Problem">
                <Cells cols={2}>
                    {problems.map((p) => (
                        <Cell key={p.head} head={p.head} text={p.text} />
                    ))}
                </Cells>
            </Slide>

            <Slide n={3} title="Solution">
                <p className={cx(type.statement, "max-w-[44ch]")}>
                    Bugnet gives your agent a throwaway cloud sandbox, paid per run. When time is
                    up, the sandbox and everything in it are deleted.
                </p>
                <div className="mt-auto pt-[3cqi] phone:pt-(--space-6)">
                    <Cells cols={3}>
                        {solutionStats.map((s) => (
                            <Cell key={s.head} head={s.head} text={s.text} big />
                        ))}
                    </Cells>
                </div>
            </Slide>

            <Slide n={4} title="How it works">
                <Cells cols={4}>
                    {steps.map((s, i) => (
                        <li key={s.head} className="bg-bg p-[2.6cqi] phone:p-(--space-5)">
                            <p className={cx(type.number, "text-accent")}>
                                {String(i + 1).padStart(2, "0")}
                            </p>
                            <p className={cx(type.head, "mt-[1.5cqi] phone:mt-(--space-3)")}>
                                {s.head}
                            </p>
                            <p className={cx(type.text, "mt-[0.8cqi] phone:mt-(--space-2)")}>
                                {s.text}
                            </p>
                        </li>
                    ))}
                </Cells>
            </Slide>

            <Slide n={5} title="Who it's for">
                <Cells cols={3}>
                    {audiences.map((a) => (
                        <Cell key={a.head} head={a.head} text={a.text} />
                    ))}
                </Cells>
            </Slide>

            <Slide n={6} title="Compared">
                <div className="phone:hidden">
                    <table className="w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b-(length:--hairline) border-line">
                                <th className="w-[28%]" />
                                {columns.map((c, i) => (
                                    <th
                                        key={c}
                                        scope="col"
                                        className={cx(
                                            type.head,
                                            "pb-[1.5cqi] phone:pb-(--space-3)",
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
                                        className={cx(
                                            type.text,
                                            "py-[1.5cqi] pr-[2cqi] font-normal phone:py-(--space-3)",
                                        )}
                                    >
                                        {row}
                                    </th>
                                    {cells.map((cell, i) => (
                                        <td
                                            key={columns[i]}
                                            className={cx(
                                                "py-[1.5cqi] pr-[2cqi] text-[max(14px,1.9cqi)] leading-[1.4] phone:py-(--space-3)",
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
                </div>
                <div className="hidden flex-col gap-(--space-5) phone:flex">
                    {columns.map((c, i) => (
                        <div
                            key={c}
                            className="border-t-(length:--hairline) border-line pt-(--space-4)"
                        >
                            <p
                                className={cx(
                                    type.head,
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
            </Slide>

            <Slide
                n={7}
                title={
                    <>
                        Why <span className={solana}>Solana</span>
                    </>
                }
            >
                <Cells cols={2}>
                    {solanaFacts.map((f) => (
                        <Cell key={f.head} head={f.head} text={f.text} />
                    ))}
                </Cells>
            </Slide>

            <Slide n={8} title="Safety">
                <Cells cols={2}>
                    {safety.map((f) => (
                        <Cell key={f.head} head={f.head} text={f.text} />
                    ))}
                </Cells>
            </Slide>

            <Slide n={9} title="Paid APIs">
                <p className={cx(type.statement, "max-w-[44ch]")}>
                    Code in the sandbox can call x402 APIs that charge per call. Bugnet pays them
                    from an allowance you approve, so no wallet key or API key enters the sandbox.
                </p>
                <div className="mt-auto pt-[3cqi] phone:pt-(--space-6)">
                    <Cells cols={3}>
                        {apiStats.map((s) => (
                            <Cell key={s.head} head={s.head} text={s.text} big />
                        ))}
                    </Cells>
                </div>
            </Slide>

            <Slide n={10} title="Business model">
                <Cells cols={2}>
                    {business.map((b) => (
                        <Cell key={b.head} head={b.head} text={b.text} />
                    ))}
                </Cells>
            </Slide>

            <Slide n={11} title="Today">
                <Cells cols={2}>
                    {today.map((t) => (
                        <Cell key={t.head} head={t.head} text={t.text} />
                    ))}
                </Cells>
            </Slide>

            <Slide n={12} title="Next">
                <ol className="border-t-(length:--hairline) border-line">
                    {next.map((item, i) => (
                        <li
                            key={item}
                            className="flex gap-[2cqi] border-b-(length:--hairline) border-line py-[2cqi] phone:gap-(--space-4) phone:py-(--space-4)"
                        >
                            <span className="font-mono text-[max(14px,1.6cqi)] leading-[1.75] text-accent">
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="text-[max(16px,2.4cqi)] leading-[1.4]">{item}</span>
                        </li>
                    ))}
                </ol>
            </Slide>

            <Slide n={13} plain>
                <div className="grid flex-1 grid-cols-[1fr_auto] items-center gap-[4cqi] phone:grid-cols-1">
                    <div>
                        <p className={type.hero}>Bugnet</p>
                        <p className={cx(type.lead, "mt-[1.5cqi] phone:mt-(--space-3)")}>
                            Throwaway sandboxes for AI agents.
                        </p>
                        <div className="mt-[4cqi] flex flex-col gap-[0.8cqi] text-[max(16px,2cqi)] leading-[1.4] phone:mt-(--space-7) phone:gap-(--space-2)">
                            <span>bugnet.sh</span>
                            <a
                                href="mailto:support@bugnet.org"
                                className="text-accent hover:underline"
                            >
                                support@bugnet.org
                            </a>
                        </div>
                    </div>
                    <Mark />
                </div>
            </Slide>
        </>
    );
}
