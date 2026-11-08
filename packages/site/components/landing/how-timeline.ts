/** The time between two lines of a terminal */
export const LINE_MS = 350;
/** How long a finished terminal stays still before the next step plays */
export const PAUSE_MS = 1200;
/** How long the four finished terminals stay still before the story clears and starts again */
export const HOLD_MS = 2500;

/** One moment of the story, with `bar` on a step's first moment set to the whole step's length */
export type Frame = { step: number; shown: number[]; ms: number; bar?: number };

/** The story's moments, each step in turn, then the hold and the clear */
export function timeline(counts: readonly number[]): Frame[] {
    const frames: Frame[] = [];
    counts.forEach((count, step) => {
        for (let line = 1; line <= count; line++) {
            frames.push({
                step,
                shown: counts.map((n, i) => (i < step ? n : i === step ? line : 0)),
                ms: line < count ? LINE_MS : PAUSE_MS,
                ...(line === 1 && { bar: (count - 1) * LINE_MS + PAUSE_MS }),
            });
        }
    });
    frames.push({ step: -1, shown: [...counts], ms: HOLD_MS });
    frames.push({ step: -1, shown: counts.map(() => 0), ms: LINE_MS });
    return frames;
}
