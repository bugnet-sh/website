import type { ReactNode } from "react";
import { SiteFooter } from "../../components/shell/footer";
import { SiteHeader } from "../../components/shell/header";

// The root layout cannot tell which route it wraps without a client hook, so each route group
// renders the header and names its page there
export default function HomeLayout({ children }: { children: ReactNode }) {
    return (
        <>
            <SiteHeader current="home" />
            {children}
            <SiteFooter />
        </>
    );
}
