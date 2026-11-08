import { CodeBlock } from "../../components/content/code-block";
import { Hero } from "../../components/landing/hero";
import { How } from "../../components/landing/how";
import { Install } from "../../components/landing/install";
import { Pricing } from "../../components/landing/pricing";
import { StatsProvider } from "../../components/stats/stats-provider";
import { readDoc } from "../../lib/content/doc-file";
import { docBySlug, type Doc } from "../../lib/content/docs";
import { Markdown } from "../../lib/content/markdown";
import { pageMetadata } from "../../lib/content/meta";
import { installLines } from "../../lib/landing/install-lines";

export const metadata = pageMetadata(
    "/",
    undefined,
    "Run code you don't trust in a throwaway cloud sandbox, from your AI agent. Pay per run in USDC.",
);

export default function HomePage() {
    const lines = installLines(readDoc(docBySlug("") as Doc).body);
    const tabs = lines.clients.map((client) => ({
        id: client.id,
        name: client.name,
        panel:
            "code" in client ? (
                <CodeBlock code={client.code} lang={client.lang} />
            ) : (
                <div className="text-(length:--ui-size) leading-(--ui-line)">
                    <Markdown source={client.steps} />
                </div>
            ),
    }));
    return (
        // One feed for the hero's price and the pricing band
        <StatsProvider>
            <main>
                <Hero installLine={lines.hero} />
                <How />
                <Install tabs={tabs} />
                <Pricing />
            </main>
        </StatsProvider>
    );
}
