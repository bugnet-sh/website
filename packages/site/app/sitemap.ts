import type { MetadataRoute } from "next";
import { docHref, docs } from "../lib/content/docs";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
    const paths = ["/", "/cloud/", "/stats/", ...docs.map(docHref), "/terms/", "/privacy/"];
    return [...new Set(paths)].map((path) => ({ url: `https://bugnet.sh${path}` }));
}
