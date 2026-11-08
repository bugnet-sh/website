import { cx } from "../../lib/cx";

/**
 * A grid cell's inline padding: the first and last cell of each row pad to the frame's edge, as
 * every band's text does, and the cells between them pad less. Phones show one column.
 */
export function cellInset(i: number, columns: number, narrowColumns: number): string {
    return cx(
        i % columns === 0 ? "pl-(--pad)" : "pl-(--space-5)",
        i % columns === columns - 1 ? "pr-(--pad)" : "pr-(--space-5)",
        i % narrowColumns === 0 ? "narrow:pl-(--pad)" : "narrow:pl-(--space-5)",
        i % narrowColumns === narrowColumns - 1 ? "narrow:pr-(--pad)" : "narrow:pr-(--space-5)",
        "phone:pl-(--pad) phone:pr-(--pad)",
    );
}
