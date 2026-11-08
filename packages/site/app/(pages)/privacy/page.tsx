import type { Metadata } from "next";
import { ArticlePage } from "../../../components/content/article-page";
import { legalText } from "../../../lib/content/legal";

export const metadata: Metadata = {
    title: "Bugnet privacy",
};

export default function PrivacyPage() {
    const { updated, body } = legalText("privacy.md");
    return <ArticlePage updated={updated} source={body} />;
}
