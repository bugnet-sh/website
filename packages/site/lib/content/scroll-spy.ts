/**
 * The heading a reader is in: the last one whose top has reached the line, or the first while
 * none has.
 */
export function currentHeading(
    headings: readonly { id: string; top: number }[],
    line: number,
): string | undefined {
    let current = headings[0]?.id;
    for (const heading of headings) {
        if (heading.top > line) break;
        current = heading.id;
    }
    return current;
}
