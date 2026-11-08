/** How long an empty terminal waits, its cursor at the top, before the first line */
export const START_MS = 400;
/** The time between two typed characters, and the Enter that carries typing to the next line */
export const CHAR_MS = 45;
/** The time between two printed lines */
export const LINE_MS = 120;
/** The pause before someone starts typing, or before a command's output prints */
export const PAUSE_MS = 450;
/** How long a finished terminal stays lit before the next step plays */
export const DONE_MS = 1200;
/** How long the four steps rest unlit before the first plays again */
export const REST_MS = 1600;

/**
 * How a line appears: "type" is typed after a pause, its lead (a prompt or a bullet) at once;
 * "more" is typed on from the line above, its indent at once; "print" prints whole.
 */
export type Kind = "type" | "more" | "print";

/** A terminal line as the timeline sees it, with no characters for a blank line */
export type Line = { kind: Kind; chars: number; lead: number };

/**
 * One moment of a terminal and how long it lasts: the lines before `line` are drawn, `chars` of
 * line `line` show with the cursor after them, and the lines after it are not there yet.
 */
export type Shot = { line: number; chars: number; ms: number };

/** One moment of the loop: a shot of the playing step's terminal, or a rest with `step` -1 */
export type Frame = Shot & { step: number; bar?: number };

/** The wait between finishing line `a` and starting line `b`, the next line with characters */
function gap(lines: readonly Line[], a: number, b: number): number {
    const next = lines[b];
    if (!next) return DONE_MS;
    if (b > a + 1 || next.kind === "type") return PAUSE_MS;
    if (next.kind === "more") return CHAR_MS;
    return lines[a]!.kind === "print" ? LINE_MS : PAUSE_MS;
}

/** A terminal filling from empty: typed lines a character at a time, printed lines whole */
export function typing(lines: readonly Line[]): Shot[] {
    const drawn = lines.flatMap((line, i) => (line.chars > 0 ? [i] : []));
    if (drawn.length === 0) return [];
    const shots: Shot[] = [{ line: drawn[0]!, chars: 0, ms: START_MS }];
    drawn.forEach((i, k) => {
        const { kind, chars, lead } = lines[i]!;
        const wait = gap(lines, i, drawn[k + 1] ?? lines.length);
        const from = kind === "print" ? chars : Math.min(lead, chars);
        for (let n = from; n <= chars; n++) {
            shots.push({ line: i, chars: n, ms: n < chars ? CHAR_MS : wait });
        }
    });
    return shots;
}

/** The time a terminal takes to fill, without the hold once it is full */
export function typed(shots: readonly Shot[]): number {
    return shots.reduce((sum, shot) => sum + shot.ms, 0) - (shots.at(-1)?.ms ?? 0);
}

/** Each step's terminal fills in turn, its bar sweeping as long as the typing, then a rest */
export function timeline(terminals: readonly (readonly Line[])[]): Frame[] {
    const frames = terminals.flatMap((lines, step) => {
        const shots = typing(lines);
        const bar = typed(shots);
        return shots.map((shot, k) => ({ step, ...shot, ...(k === 0 && { bar }) }));
    });
    return [...frames, { step: -1, line: -1, chars: 0, ms: REST_MS }];
}
