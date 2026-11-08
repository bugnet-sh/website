import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DitherLogo } from "./dither-logo";
import { LogoBoundary } from "./error-boundary";
import { logoSource } from "./logo-source";

const props = vi.fn();
vi.mock("./dither-veil", () => ({
    default: (p: Record<string, unknown>) => {
        props(p);
        return <canvas data-testid="canvas" />;
    },
}));
vi.mock("./logo-source", async (original) => ({
    ...(await original<typeof import("./logo-source")>()),
    logoSource: vi.fn(() => document.createElement("canvas")),
}));

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    props.mockClear();
});

function withWebGL(reduced = false) {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        getExtension: () => null,
    } as never);
    vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
    vi.stubGlobal("getComputedStyle", () => ({
        getPropertyValue: (name: string) => (name === "--accent" ? " #52ffb8" : ""),
    }));
}

function shapes(svg: Element | Document | null) {
    return [...(svg?.querySelectorAll("path, circle") ?? [])].map((el) =>
        ["d", "cx", "cy", "r", "fill-rule", "stroke-width", "stroke-linecap", "fill"].map((name) =>
            el.getAttribute(name),
        ),
    );
}

describe("DitherLogo", () => {
    it("shows the plain mark, shape for shape from logo.svg, without WebGL2", () => {
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
        const brand = new DOMParser().parseFromString(
            readFileSync(createRequire(import.meta.url).resolve("@bugnet/brand/logo.svg"), "utf8"),
            "image/svg+xml",
        );
        render(<DitherLogo />);
        const svg = screen.getByTestId("static-logo");
        expect(svg.getAttribute("viewBox")).toBe(brand.documentElement.getAttribute("viewBox"));
        expect(shapes(svg)).toEqual(shapes(brand));
        expect(screen.queryByTestId("canvas")).toBeNull();
    });

    it("dithers the mark in white only, with the text colour's default when it is unset", () => {
        withWebGL();
        render(<DitherLogo />);
        expect(logoSource).toHaveBeenLastCalledWith("#ededed", "#ededed");
        expect(props).toHaveBeenLastCalledWith(
            expect.objectContaining({
                inkColor: "transparent",
                rim: 0,
                maxDpr: 1.5,
                intro: true,
                paused: false,
            }),
        );
    });

    it("draws one still frame under reduced motion", () => {
        withWebGL(true);
        render(<DitherLogo />);
        expect(props).toHaveBeenLastCalledWith(
            expect.objectContaining({ paused: true, intro: false }),
        );
    });

    it("goes back to the plain mark when the WebGL context is lost", () => {
        withWebGL();
        render(<DitherLogo />);
        const { onError } = props.mock.lastCall![0] as { onError: () => void };
        act(onError);
        expect(screen.getByTestId("static-logo")).toBeTruthy();
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
