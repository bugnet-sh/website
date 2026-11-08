import type { Metadata } from "next";
import { AsciiField } from "../components/backgrounds/ascii-field";
import { Band, Frame } from "../components/shell/frame";
import { SiteHeader } from "../components/shell/header";
import { primaryButton, secondaryButton } from "../components/ui/button";

export const metadata: Metadata = {
    title: "Page not found",
    robots: { index: false },
};

/**
 * A full screen under the header, as the hero is: the ASCII field behind, fading out before every
 * edge, and the number, one line and the two ways back on top of it, at the frame's left edge.
 */
export default function NotFound() {
    return (
        <>
            <SiteHeader />
            <main>
                <Band
                    rail={false}
                    className="relative h-[calc(100dvh-var(--nav))] min-h-(--hero-min)"
                >
                    <AsciiField
                        shape="eclipse"
                        className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,#000_20%,#000_80%,transparent),linear-gradient(to_right,transparent,#000_15%,#000_85%,transparent)] [mask-composite:intersect]"
                    />
                    <Frame className="relative flex h-full flex-col justify-center">
                        <h1 className="font-head text-(length:--not-found-size) leading-none font-extralight">
                            404
                        </h1>
                        <p className="mt-(--space-4) text-(length:--lead-size) leading-(--lead-line) text-text-muted">
                            This page was thrown away.
                        </p>
                        <div className="mt-(--space-6) flex flex-wrap gap-(--space-3)">
                            <a href="/" className={primaryButton}>
                                Home
                            </a>
                            <a href="/docs/" className={secondaryButton}>
                                Docs
                            </a>
                        </div>
                    </Frame>
                </Band>
            </main>
        </>
    );
}
