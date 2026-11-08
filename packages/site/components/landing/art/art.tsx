import type { ReactNode } from "react";
import "./line-art.css";
import { ART_H, ART_W, type BoxPaths } from "./line-art";

/** A drawing's SVG: decoration, since the cell's title and sentence say the same in words */
export function Art({ children }: { children: ReactNode }) {
    return (
        <svg viewBox={`0 0 ${ART_W} ${ART_H}`} className="art" aria-hidden="true" focusable="false">
            {children}
        </svg>
    );
}

/** A glass box: faces washed in green, its hidden edges faint and its seen edges lit */
export function GlassBox({ paths }: { paths: BoxPaths }) {
    return (
        <g>
            <path d={`${paths.left}${paths.right}`} className="art-wash" />
            <path d={paths.top} className="art-wash" />
            <path d={paths.hidden} className="art-faint art-dash" />
            <path d={paths.edges} className="art-lit art-halo" />
        </g>
    );
}
