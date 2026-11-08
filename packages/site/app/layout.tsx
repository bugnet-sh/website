import type { Metadata } from "next";
import type { ReactNode } from "react";
import { preload } from "react-dom";
import { SiteFooter } from "../components/shell/footer";
import "./globals.css";

// The same files tokens.css names, so each preload is the request the stylesheet then makes
const fonts = [
    new URL("@bugnet/brand/fonts/manrope-400.woff2", import.meta.url),
    new URL("@bugnet/brand/fonts/manrope-600.woff2", import.meta.url),
    new URL("@bugnet/brand/fonts/lexend-deca-200.woff2", import.meta.url),
    new URL("@bugnet/brand/fonts/obel-mono-400.woff2", import.meta.url),
];

export const metadata: Metadata = {
    metadataBase: new URL("https://bugnet.sh"),
    title: { default: "Bugnet", template: "%s | Bugnet" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
    for (const font of fonts) {
        preload(font.pathname, { as: "font", type: "font/woff2", crossOrigin: "" });
    }
    return (
        <html lang="en">
            <body>
                {/* Each route group's layout puts the header above its page */}
                {children}
                <SiteFooter />
            </body>
        </html>
    );
}
