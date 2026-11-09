import type { ReactNode } from "react";
import "../../components/pitch/pitch.css";

/** The deck fills the screen, so it has neither the site's header nor its footer */
export default function PitchLayout({ children }: { children: ReactNode }) {
    return children;
}
