/** How long each step stays lit, its bar sweeping the top of its terminal */
export const STEP_MS = 2400;
/** How long the four steps rest unlit before the first lights again */
export const HOLD_MS = 1600;

/** One moment of the story: the lit step, or -1 for none, and how long it lasts */
export type Frame = { step: number; ms: number };

/** Each step lit in turn, then a rest with none lit */
export function timeline(steps: number): Frame[] {
    return [
        ...Array.from({ length: steps }, (_, step) => ({ step, ms: STEP_MS })),
        { step: -1, ms: HOLD_MS },
    ];
}
