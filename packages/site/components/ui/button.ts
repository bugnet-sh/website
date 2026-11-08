/** A 34 px button with a 40 px tap target, as the header's Get Started. */
const button =
    "relative inline-flex h-(--button) shrink-0 items-center gap-(--space-1) px-(--space-4) before:absolute before:inset-x-0 before:-inset-y-[calc((var(--hit)-var(--button))/2)] before:content-[''] text-(length:--ui-size) leading-(--ui-line) font-semibold whitespace-nowrap";

/** The one action a band asks for: green fill. */
export const primaryButton = `${button} bg-accent text-accent-ink`;

/** Every other action: a violet outline that fills on hover, so green keeps meaning "go". */
export const secondaryButton = `${button} border-(length:--hairline) border-accent-3 text-accent-3 hover:bg-accent-3 hover:text-accent-3-ink`;
