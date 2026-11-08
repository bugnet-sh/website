import type { Metadata } from "next";
import { SiteHeader } from "../components/shell/header";
import { Band, Frame } from "../components/shell/frame";

export const metadata: Metadata = {
    title: "Page not found",
    robots: { index: false },
};

const link =
    "text-text underline decoration-text-muted underline-offset-4 hover:text-accent hover:decoration-accent";

export default function NotFound() {
    return (
        <>
            <SiteHeader />
            <main>
                <Band rail={false}>
                    <Frame className="pt-(--band) pb-(--band)">
                        <h1 className="font-head text-(length:--title-size) leading-(--title-line) font-extralight">
                            Page not found
                        </h1>
                        <p className="mt-(--space-3) text-(length:--lead-size) leading-(--lead-line) text-text-muted">
                            Go to{" "}
                            <a href="/" className={link}>
                                Home
                            </a>{" "}
                            or the{" "}
                            <a href="/docs/" className={link}>
                                Docs
                            </a>
                            .
                        </p>
                    </Frame>
                </Band>
            </main>
        </>
    );
}
