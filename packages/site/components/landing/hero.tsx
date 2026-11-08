import { CodeBlock } from "../content/code-block";
import { Band, Frame } from "../shell/frame";
import { github, ShellAnchor } from "../shell/links";
import { FromPrice } from "./from-price";

/** A 34 px button with a 40 px tap target, as the header's Get Started. */
const button =
    "relative inline-flex h-(--button) items-center gap-(--space-1) px-(--space-4) before:absolute before:inset-x-0 before:-inset-y-[calc((var(--hit)-var(--button))/2)] before:content-[''] text-(length:--ui-size) leading-(--ui-line) font-semibold";

export function Hero({ installLine }: { installLine: string }) {
    return (
        <Band as="header" rail={false}>
            <Frame className="py-(--band)">
                <h1 className="max-w-(--hero-measure) font-head text-(length:--hero-size) leading-(--hero-line) font-extralight">
                    Run code you don&apos;t trust in a throwaway cloud sandbox.
                </h1>
                <p className="mt-(--space-4) text-(length:--lead-size) leading-(--lead-line) text-text-muted">
                    From your AI agent. Pay per run in USDC. No account, no API key.
                </p>
                {/* As wide as its line, so Copy sits beside the command */}
                <div className="mt-(--space-6) w-fit max-w-full">
                    <CodeBlock code={installLine} />
                </div>
                <div className="mt-(--space-5) flex flex-wrap gap-(--space-3)">
                    <a href="/docs/#install" className={`${button} bg-accent text-accent-ink`}>
                        Get Started
                    </a>
                    <ShellAnchor
                        link={github}
                        className={`${button} border-(length:--hairline) border-line text-text hover:border-accent hover:text-accent`}
                    />
                </div>
                {/* The line's box is kept while the feed loads, so the price arriving moves nothing */}
                <div className="mt-(--space-4) h-(--ui-line)">
                    <FromPrice />
                </div>
            </Frame>
        </Band>
    );
}
