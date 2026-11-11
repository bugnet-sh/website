import type { ReactNode } from "react";
import { SiteFooter } from "../../../components/shell/footer";
import { SiteHeader } from "../../../components/shell/header";

export default function CloudLayout({ children }: { children: ReactNode }) {
    return (
        <>
            <SiteHeader current="cloud" />
            {children}
            <SiteFooter />
        </>
    );
}
