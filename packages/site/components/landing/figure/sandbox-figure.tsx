import type { CSSProperties } from "react";
import "../../iso/iso.css";
import { ART, RIG } from "./art";
import { SandboxLive } from "./sandbox-live";
import "./sandbox-figure.css";
import { HEIGHT, WIDTH } from "./view";

/**
 * The share of the drawing, from its left and from its bottom, that always stays in the slot: the
 * screen, dial, coin slot and drawer sit there, and the slot cuts what lies above and right of it.
 */
const KEEP_X = 0.74;
const KEEP_Y = 0.78;

const SIZE = {
    "--sbx-ratio": WIDTH / HEIGHT,
    "--sbx-keep-x": KEEP_X,
    "--sbx-keep-y": KEEP_Y,
} as CSSProperties;

/**
 * The hero's sandbox cabinet. It fills a `relative overflow-hidden` slot, drawn larger than the
 * slot and anchored to its bottom left, so the slot cuts its top and right.
 */
export function SandboxFigure({ className }: { className?: string }) {
    return (
        <SandboxLive
            rig={RIG}
            className={className ? `iso sbx ${className}` : "iso sbx"}
            style={SIZE}
        >
            {ART}
        </SandboxLive>
    );
}
