import type { Metadata } from "next";
import { ArticlePage } from "../../../components/content/article-page";
import { legalText } from "../../../lib/content/legal";

export const metadata: Metadata = {
    title: "Bugnet terms",
};

export default function TermsPage() {
    const { updated, body } = legalText("terms.md");
    return <ArticlePage updated={updated} source={body} />;
}
