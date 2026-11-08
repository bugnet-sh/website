import { cx } from "../../lib/cx";
import { CodeBlock } from "../content/code-block";
import { Band, Frame } from "../shell/frame";
import { secondaryButton } from "../ui/button";
import { SandboxFigure } from "./figure/sandbox-figure";
import { FromPrice } from "./from-price";

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
                className="grid h-full grid-cols-[minmax(0,5fr)_minmax(0,7fr)] grid-rows-[minmax(0,1fr)_auto] narrow:grid-cols-2 tablet:grid-cols-1 tablet:grid-rows-[auto_minmax(0,1fr)_auto]"
            >
                <div className="flex flex-col justify-center px-(--pad) py-(--band) tablet:pb-(--space-6)">
                    <h1 className="max-w-(--hero-measure) font-head text-(length:--hero-size) leading-(--hero-line) font-extralight">
                        Throwaway cloud sandboxes for AI agents.
                    </h1>
                    <p className="mt-(--space-4) text-(length:--lead-size) leading-(--lead-line) text-text-muted">
                        Pay per run in USDC on Solana. No account, no API key.
                    </p>
                    {/* The line's box is kept while the feed loads, so the price arriving moves nothing */}
                    <div className="mt-(--space-4) h-(--ui-line)">
                        <FromPrice />
                    </div>
                </div>
                <div className="relative overflow-hidden">
                    <SandboxFigure />
                </div>
                <div className="col-span-full flex flex-wrap items-center gap-x-(--space-5) gap-y-(--space-3) border-t-(length:--hairline) border-line px-(--pad) py-(--space-5) phone:flex-col phone:items-stretch">
                    {/* As wide as its line, so Copy sits beside the command, and scrolled when the row is narrower */}
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
