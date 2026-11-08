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
 * A full screen under the header, as the hero is: the number, one line and the two ways back at
 * the frame's left edge, and the ASCII eclipse fading out before every edge. On wide screens it
 * sits right of the text, clear of it; tablets and phones put it under the buttons.
 */
export default function NotFound() {
    return (
        <>
            <SiteHeader />
            <main>
                <Band rail={false} className="h-[calc(100dvh-var(--nav))] min-h-(--hero-min)">
                    <Frame className="relative flex h-full flex-col justify-center tablet:justify-start tablet:pt-(--band)">
                        <AsciiField
                            shape="eclipse"
                            className="pointer-events-none absolute inset-y-0 right-0 left-[35%] [mask-image:linear-gradient(to_bottom,transparent,#000_20%,#000_80%,transparent),linear-gradient(to_right,transparent,#000_35%,#000_85%,transparent)] [mask-composite:intersect] tablet:relative tablet:inset-auto tablet:order-last tablet:-mx-(--pad) tablet:min-h-0 tablet:flex-1 tablet:[mask-image:linear-gradient(to_bottom,transparent,#000_20%,#000_80%,transparent),linear-gradient(to_right,transparent,#000_15%,#000_85%,transparent)]"
                        />
                        <div className="relative">
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
                        </div>
                    </Frame>
                </Band>
            </main>
        </>
    );
}
