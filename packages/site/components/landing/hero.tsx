import { cx } from "../../lib/cx";
import { CodeBlock } from "../content/code-block";
import { Band, Frame } from "../shell/frame";
import { secondaryButton } from "../ui/button";
import { SandboxFigure } from "./figure/sandbox-figure";

/**
 * The first screen: the tagline left, the drawing right, the MCP command along the bottom. The
 * band, its hairline included, is exactly the screen under the header, so the command row ends
 * on the screen's bottom edge. The drawing's slot has no padding: it reaches the band's top and
 * the frame's right rail, which clip it. Tablets and phones stack the three.
 */
export function Hero({ installLine }: { installLine: string }) {
    return (
        <Band as="header" rail={false} className="h-[calc(100dvh-var(--nav))] min-h-(--hero-min)">
            <Frame
                padded={false}
                className="grid h-full grid-cols-2 grid-rows-[minmax(0,1fr)_auto] narrow:grid-cols-2 tablet:grid-cols-1 tablet:grid-rows-[auto_minmax(0,1fr)_auto]"
            >
                <div className="@container flex flex-col justify-center px-(--pad) py-(--band) tablet:pb-(--space-6)">
                    {/* Two lines whatever the width: the longer line runs about 10.4 em, so the
                        size never passes the column's width over 10.8 */}
                    <h1 className="font-head text-[min(var(--hero-size),calc(100cqi/10.8))] leading-(--hero-line) font-extralight whitespace-nowrap">
                        Throwaway sandboxes
                        <br />
                        for AI agents.
                    </h1>
                    <p className="mt-(--space-4) text-(length:--lead-size) leading-(--lead-line) text-text-muted">
                        Pay per run in USDC on{" "}
                        <span className="bg-[linear-gradient(90deg,var(--solana-purple),var(--solana-green))] bg-clip-text text-transparent">
                            Solana
                        </span>
                        . No account, no API key.
                    </p>
                </div>
                <div className="relative overflow-hidden">
                    <SandboxFigure />
                </div>
                <div className="col-span-full flex flex-wrap items-center gap-x-(--space-5) gap-y-(--space-3) border-t-(length:--hairline) border-line px-(--pad) py-(--space-5) phone:flex-col phone:items-stretch">
                    {/* As wide as its line, so Copy sits beside the command; scrolled if wider */}
                    <div className="max-w-full min-w-0">
                        <CodeBlock code={installLine} lang="sh" />
                    </div>
                    <a
                        href="#install"
                        className={cx(secondaryButton, "ml-auto phone:ml-0 phone:self-start")}
                    >
                        More clients
                    </a>
                </div>
            </Frame>
        </Band>
    );
}
