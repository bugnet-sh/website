import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DitherLogo, MARK } from "./dither-logo";
import { LogoBoundary } from "./error-boundary";

const props = vi.fn();
vi.mock("./dither-veil", () => ({
    default: (p: Record<string, unknown>) => {
        props(p);
        return <canvas data-testid="canvas" />;
    },
}));

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    props.mockClear();
});

/** An Image that loads, or fails, as soon as its src is set. */
function stubImage(loads: boolean) {
    vi.stubGlobal(
        "Image",
        class {
            naturalWidth = MARK.width;
            naturalHeight = MARK.height;
            decoding = "";
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(_: string) {
                queueMicrotask(() => (loads ? this.onload?.() : this.onerror?.()));
            }
        },
    );
}

function withWebGL({ reduced = false, loads = true } = {}) {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        getExtension: () => null,
        drawImage: () => {},
    } as never);
    vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
    vi.stubGlobal("getComputedStyle", () => ({
        getPropertyValue: (name: string) => (name === "--accent" ? " #52ffb8" : ""),
    }));
    stubImage(loads);
}

async function settle() {
    await act(async () => {});
}

describe("DitherLogo", () => {
    it("is as large as public/mark.png says", () => {
        const here = dirname(fileURLToPath(import.meta.url));
        const png = readFileSync(join(here, "../../../public/mark.png"));
        expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([MARK.width, MARK.height]);
    });

    it("shows the plain render without WebGL2", () => {
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
        render(<DitherLogo />);
        expect(screen.getByTestId("plain-mark").getAttribute("src")).toBe(MARK.src);
        expect(screen.queryByTestId("canvas")).toBeNull();
    });

    it("dithers the render in white dots on the page ground, with the tokens' defaults", async () => {
        withWebGL();
        render(<DitherLogo />);
        await settle();
        expect(props).toHaveBeenLastCalledWith(
            expect.objectContaining({
                pattern: "bayer",
                pixelSize: 2,
                inkColor: "#0a0a0a",
                paperColor: "#ededed",
                brightness: -0.02,
                wander: true,
                clickBurst: false,
                intro: true,
                paused: false,
            }),
        );
        const { source } = props.mock.lastCall![0] as { source: HTMLCanvasElement };
        expect([source.width, source.height]).toEqual([MARK.width, MARK.height]);
    });

    it("draws one still frame under reduced motion", async () => {
        withWebGL({ reduced: true });
        render(<DitherLogo />);
        await settle();
        expect(props).toHaveBeenLastCalledWith(
            expect.objectContaining({ paused: true, intro: false }),
        );
    });

    it("keeps the plain render when the picture does not load", async () => {
        withWebGL({ loads: false });
        render(<DitherLogo />);
        await settle();
        expect(screen.getByTestId("plain-mark")).toBeTruthy();
        expect(screen.queryByTestId("canvas")).toBeNull();
    });

    it("goes back to the plain render when the WebGL context is lost", async () => {
        withWebGL();
        render(<DitherLogo />);
        await settle();
        const { onError } = props.mock.lastCall![0] as { onError: () => void };
        act(onError);
        expect(screen.getByTestId("plain-mark")).toBeTruthy();
        expect(screen.queryByTestId("canvas")).toBeNull();
    });
});

describe("LogoBoundary", () => {
    it("shows the fallback when a child throws", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        function Boom(): never {
            throw new Error("gl");
        }
        render(
            <LogoBoundary fallback={<p>plain</p>}>
                <Boom />
            </LogoBoundary>,
        );
        expect(screen.getByText("plain")).toBeTruthy();
    });
});
