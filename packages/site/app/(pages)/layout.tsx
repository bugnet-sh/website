import type { ReactNode } from "react";
import { SiteFooter } from "../../components/shell/footer";
import { SiteHeader } from "../../components/shell/header";

/** Pages the header does not list, so none of its links is marked current. */
export default function PagesLayout({ children }: { children: ReactNode }) {
    return (
        <>
            <SiteHeader />
            {children}
            <SiteFooter />
        </>
    );
}
