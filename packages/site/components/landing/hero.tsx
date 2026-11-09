import { cx } from "../../lib/cx";
import { CodeBlock } from "../content/code-block";
import { Band, Frame } from "../shell/frame";
import { secondaryButton } from "../ui/button";
import { SandboxFigure } from "./figure/sandbox-figure";

/**
 * The first screen: the tagline and the MCP command at the top left, the drawing right. The band
 * is the screen under the header but never taller than --hero-max, so on a tall screen How it
 * works follows it in view (founder, 2026-11-09). The drawing's slot has no padding: it reaches
 * the band's top and the frame's right rail, which clip it. Tablets and phones stack the text,
 * the drawing and the command, the band filling the screen.
 */
export function Hero({ installLine }: { installLine: string }) {
    return (
        <Band
            as="header"
            rail={false}
            className="h-[min(calc(100dvh-var(--nav)),var(--hero-max))] min-h-(--hero-min) tablet:h-[calc(100dvh-var(--nav))]"
        >
            <Frame
                padded={false}
                className="grid h-full grid-cols-2 grid-rows-[auto_minmax(0,1fr)] tablet:grid-cols-1 tablet:grid-rows-[auto_minmax(0,1fr)_auto]"
            >
                <div className="@container col-start-1 row-start-1 flex flex-col px-(--pad) pt-(--band) tablet:pt-(--band) tablet:pb-(--space-6)">
                    {/* Two lines whatever the width: the longer line runs about 10.4 em, so the
                        size never passes the column's width over 10.8 */}
                    <h1 className="font-head text-[min(var(--hero-size),calc(100cqi/10.8))] leading-(--hero-line) font-extralight whitespace-nowrap">
                        Throwaway sandboxes
                        <br />
                        for AI agents.
                    </h1>
                    <p className="mt-(--space-4) text-(length:--lead-size) leading-(--lead-line) text-balance text-text-muted">
                        Pay per run in USDC on{" "}
                        <span className="bg-[linear-gradient(90deg,var(--solana-purple),var(--solana-green))] bg-clip-text text-transparent">
                            Solana
                        </span>
                        . No account, no API key.
                    </p>
                </div>
                {/* Stacked, the slot's top edge has no hairline to meet, so the cut fades out */}
                <div className="relative col-start-2 row-span-2 row-start-1 overflow-hidden tablet:col-start-1 tablet:row-span-1 tablet:row-start-2 tablet:[mask-image:linear-gradient(to_bottom,transparent,#000_var(--space-7))]">
                    <SandboxFigure />
                </div>
                <div className="col-start-1 row-start-2 flex flex-wrap items-center gap-x-(--space-5) gap-y-(--space-3) self-start px-(--pad) pt-(--space-7) pb-(--band) tablet:col-span-full tablet:row-start-3 tablet:border-t-(length:--hairline) tablet:border-line tablet:py-(--space-5) phone:flex-col phone:items-stretch">
                    {/* As wide as its line, so Copy sits beside the command; in the half-width
                        column it wraps at a space rather than hiding its end */}
                    <div className="max-w-full min-w-0">
                        <CodeBlock code={installLine} lang="sh" long="wrap" className="" />
                    </div>
                    <a
                        href="#install"
                        className={cx(
                            secondaryButton,
                            "tablet:ml-auto phone:ml-0 phone:self-start",
                        )}
                    >
                        More clients
                    </a>
                </div>
            </Frame>
        </Band>
    );
}
