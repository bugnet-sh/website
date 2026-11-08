import type { ReactNode } from "react";
import { SiteHeader } from "../../../components/shell/header";

export default function DocsLayout({ children }: { children: ReactNode }) {
    return (
        <>
            <SiteHeader current="docs" />
            {children}
        </>
    );
}
