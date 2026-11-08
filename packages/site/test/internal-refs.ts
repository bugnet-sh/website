/**
 * Marks of the team's own files and notes, which readers cannot open: spec folders, the other
 * repositories, agent working files, spec section codes and working session names.
 * `bugnet-sh` is the public GitHub organisation, so it is not a session name.
 */
const marks: readonly RegExp[] = [
    /docs\/website\//,
    /docs\/sandbox-router\//,
    /docs\/mcp-gateway\//,
    /docs\/founder-decisions\//,
    /bugnet-gateway\//,
    /bugnet-router\//,
    /bugnet-payments\//,
    /\.superpowers/,
    /content\/legal\//,
    /\b(?:CP|SS|DP|XS)[ -]?\d/,
    /\bbugnet-(?!sh\b)[a-z0-9]{2}\b/,
];

/** Each internal mark found in the text, empty when there is none. */
export function internalRefs(text: string): string[] {
    return marks.flatMap((mark) => {
        const found = mark.exec(text);
        return found ? [found[0]] : [];
    });
}
