import { expect, it } from "vitest";
import { priceText } from "./price";

it("shows a price with the decimals it needs and at least two", () => {
    expect(priceText(50_000)).toBe("0.05");
    expect(priceText(25_000)).toBe("0.025");
    expect(priceText(2_000_000)).toBe("2.00");
});
