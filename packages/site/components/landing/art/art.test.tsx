import { cleanup, render } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ART_H, ART_W, box, camera, seeded } from "./line-art";
import { AllowanceArt, FindArt, LimitArt } from "./pay-art";
import { DataArt, DeadlineArt, OffMachineArt } from "./safety-art";

afterEach(cleanup);

const drawings: [string, ComponentType][] = [
    ["OffMachineArt", OffMachineArt],
    ["DeadlineArt", DeadlineArt],
    ["DataArt", DataArt],
    ["FindArt", FindArt],
    ["AllowanceArt", AllowanceArt],
    ["LimitArt", LimitArt],
];

describe.each(drawings)("%s", (_, Drawing) => {
    it("is decoration in the shared box, every square inside it", () => {
        const { container } = render(<Drawing />);
        const svg = container.querySelector("svg");
        expect(svg?.getAttribute("viewBox")).toBe(`0 0 ${ART_W} ${ART_H}`);
        expect(svg?.getAttribute("aria-hidden")).toBe("true");
        for (const rect of container.querySelectorAll("rect")) {
            const x = Number(rect.getAttribute("x"));
            const y = Number(rect.getAttribute("y"));
            expect(x).toBeGreaterThanOrEqual(0);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(x + Number(rect.getAttribute("width"))).toBeLessThanOrEqual(ART_W);
            expect(y + Number(rect.getAttribute("height"))).toBeLessThanOrEqual(ART_H);
        }
    });
});

it("draws a deleted sandbox's bits the same on every render", () => {
    const first = render(<DeadlineArt />).container.innerHTML;
    cleanup();
    expect(render(<DeadlineArt />).container.innerHTML).toBe(first);
    const a = seeded(7);
    const b = seeded(7);
    const draws = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(draws);
    for (const draw of draws) {
        expect(draw).toBeGreaterThanOrEqual(0);
        expect(draw).toBeLessThan(1);
    }
});

it("puts a box's front foot straight under its back corner, as the kit's camera sees it", () => {
    const { corners } = box(camera(100, 100), [0, 0, 0], [40, 40, 40]);
    expect(corners.foot[0]).toBeCloseTo(corners.back[0]);
    expect(corners.foot[1]).toBeGreaterThan(corners.front[1]);
    expect(corners.left[0]).toBeLessThan(corners.back[0]);
    expect(corners.right[0]).toBeGreaterThan(corners.back[0]);
});

it("keeps every paying drawing inside its own box, with no line running into the next cell", () => {
    for (const Art of [FindArt, AllowanceArt, LimitArt]) {
        const { container, unmount } = render(<Art />);
        for (const path of container.querySelectorAll("path")) {
            const xs = [...(path.getAttribute("d") ?? "").matchAll(/[MLH] (-?[\d.]+)/g)].map((m) =>
                Number(m[1]),
            );
            for (const x of xs) {
                expect(x).toBeGreaterThanOrEqual(0);
                expect(x).toBeLessThanOrEqual(280);
            }
        }
        unmount();
    }
});

it("ends the refund at the coins it goes back to, with its arrowhead inside the drawing", () => {
    const { container } = render(<LimitArt />);
    const heads = [...container.querySelectorAll("path.art-lit")]
        .map((path) => path.getAttribute("d") ?? "")
        .filter((d) => / L 102 /.test(d));
    expect(heads).toHaveLength(1);
});
