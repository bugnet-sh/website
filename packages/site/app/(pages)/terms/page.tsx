import { ArticlePage } from "../../../components/content/article-page";
import { legalText } from "../../../lib/content/legal";
import { pageMetadata } from "../../../lib/content/meta";

export const metadata = pageMetadata(
    "/terms/",
    "Terms",
    "Terms of service and acceptable use for Bugnet.",
);

export default function TermsPage() {
    const { updated, body } = legalText("terms.md");
    return <ArticlePage updated={updated} source={body} />;
}
