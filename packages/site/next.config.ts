import type { NextConfig } from "next";

const config: NextConfig = {
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
    poweredByHeader: false,
    // In production Caddy sends /api/stats* to the router. In dev the fake stats server on 8461
    // stands in. An export cannot rewrite, so production builds leave both keys out.
    ...(process.env.NODE_ENV === "development" && {
        // Otherwise /api/stats would be redirected to /api/stats/ before the rewrite, and the
        // stats server would get a path the router never serves
        skipTrailingSlashRedirect: true,
        rewrites: async () => [
            {
                source: "/api/stats/:path*",
                destination: "http://127.0.0.1:8461/api/stats/:path*",
            },
        ],
    }),
};

export default config;
