import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WavesBoundary } from "./error-boundary";
import { FooterWaves } from "./waves";

const props = vi.fn();
vi.mock("./sliced-waves", () => ({
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

function withWebGL(reduced = false) {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
    vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
    vi.stubGlobal("getComputedStyle", () => ({
        getPropertyValue: (name: string) => ` c${name}`,
    }));
}

describe("FooterWaves", () => {
    it("leaves a silent empty slot of the fixed height without WebGL", () => {
        const error = vi.spyOn(console, "error");
        const warn = vi.spyOn(console, "warn");
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
        render(<FooterWaves />);
        const slot = screen.getByTestId("waves-slot");
        expect(slot.className).toContain("h-(--waves)");
        expect(slot.childElementCount).toBe(0);
        expect(error).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
    });

    it("passes the three token colours and ignores the mouse", () => {
        withWebGL();
        render(<FooterWaves />);
        expect(props).toHaveBeenLastCalledWith(
            expect.objectContaining({
                color1: "c--accent",
                color2: "c--waves-mid",
                color3: "c--accent-2",
                mouseInteraction: false,
                intro: true,
                paused: false,
            }),
        );
    });

    it("draws one still frame under reduced motion", () => {
        withWebGL(true);
        render(<FooterWaves />);
        expect(props).toHaveBeenLastCalledWith(
            expect.objectContaining({ paused: true, intro: false }),
        );
    });
});

describe("WavesBoundary", () => {
    it("contains a child that throws", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        function Boom(): never {
            throw new Error("gl");
        }
        const { container } = render(
            <WavesBoundary>
                <Boom />
            </WavesBoundary>,
        );
        expect(container.innerHTML).toBe("");
    });
});
