import { ArticlePage } from "../../../components/content/article-page";
import { legalText } from "../../../lib/content/legal";
import { pageMetadata } from "../../../lib/content/meta";

export const metadata = pageMetadata("/privacy/", "Privacy", "How Bugnet handles personal data.");

export default function PrivacyPage() {
    const { updated, body } = legalText("privacy.md");
    return <ArticlePage updated={updated} source={body} />;
}
