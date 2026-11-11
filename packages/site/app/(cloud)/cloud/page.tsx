import { CodeBlock } from "../../../components/content/code-block";
import { CloudServers } from "../../../components/cloud/cloud-servers";
import { Band, Frame } from "../../../components/shell/frame";
import { StatsProvider } from "../../../components/stats/stats-provider";
import { secondaryButton } from "../../../components/ui/button";
import { readDoc } from "../../../lib/content/doc-file";
import { docBySlug, type Doc } from "../../../lib/content/docs";
import { pageMetadata } from "../../../lib/content/meta";
import { cx } from "../../../lib/cx";
import { installLines } from "../../../lib/landing/install-lines";

export const metadata = pageMetadata(
    "/cloud/",
    "Cloud",
    "Every server a Bugnet sandbox runs on: its provider, size, location and price.",
);

export default function CloudPage() {
    const { hero } = installLines(readDoc(docBySlug("install") as Doc).body);
    return (
        <main>
            <Band as="header" rail={false}>
                <Frame className="pt-(--band) pb-(--space-6)">
                    <h1 className="font-head text-(length:--title-size) leading-(--title-line) font-extralight">
                        Cloud
                    </h1>
                    <p className="mt-(--space-3) text-(length:--lead-size) leading-(--lead-line) text-text-muted">
                        Your agent picks a package. Bugnet starts it on one of these servers.
                    </p>
                    <div className="mt-(--space-5) flex flex-wrap items-center gap-x-(--space-5) gap-y-(--space-3) phone:flex-col phone:items-stretch">
                        <div className="max-w-full min-w-0">
                            <CodeBlock code={hero} lang="sh" long="wrap" className="" />
                        </div>
                        <a href="/docs/" className={cx(secondaryButton, "phone:self-start")}>
                            Quickstart
                        </a>
                    </div>
                </Frame>
            </Band>
            <StatsProvider>
                <CloudServers />
            </StatsProvider>
        </main>
    );
}
