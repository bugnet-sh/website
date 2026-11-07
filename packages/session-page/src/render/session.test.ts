// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { copy } from "../copy.ts";
import { parseGetBody, type SessionRecord } from "../payload.ts";
import { makeScenarios } from "../testing/fixtures.ts";
import { createMapSection } from "./session.ts";

const now = new Date("2026-11-06T12:00:00Z");
const scenarios = makeScenarios(now);

function settlingRecord(get: number): SessionRecord {
    const body = parseGetBody(scenarios["ended-x402-settling"].gets[get]!.body);
    if (body.state !== "ended") throw new Error(`expected ended, got ${body.state}`);
    return body.record;
}

function sectionOf(record: SessionRecord) {
    const section = createMapSection(document, record, {
        now: () => now,
        clipboard: { writeText: vi.fn(async (_text: string) => {}) },
    });
    document.body.replaceChildren(section.root);
    const open = (id: string) =>
        section.root
            .querySelector(`button.map-row[data-node-id="${id}"]`)!
            .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const totals = () =>
        [...section.root.querySelectorAll(".map-table tfoot tr.total th")].map(
            (th) => th.textContent,
        );
    return { section, open, totals };
}

describe("createMapSection", () => {
    it("closes the open Allowance table with its totals", () => {
        const { open, totals, section } = sectionOf(settlingRecord(0));
        open("allowance");
        expect(totals()).toEqual([
            copy.totals.paidIn,
            copy.totals.spent("search-api.example"),
            copy.totals.settling(2),
        ]);
        section.destroy();
    });

    it("redraws the totals when only the calls they sum have changed", () => {
        const before = settlingRecord(0);
        const settled = settlingRecord(1);
        // The Allowance's own rows stay the same, so only its totals can show the change
        const after = {
            ...settled,
            events: settled.events.filter((e) => e.kind !== "allowance" || e.phase === "paid"),
        };
        const { open, totals, section } = sectionOf(before);
        open("allowance");
        section.update(after);
        expect(totals()).toEqual([copy.totals.paidIn, copy.totals.spent("search-api.example")]);
        section.destroy();
    });
});
