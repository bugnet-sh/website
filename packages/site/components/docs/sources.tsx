/** The files and sections a page was written from. */
export function Sources({ sources }: { sources: readonly string[] }) {
    if (!sources.length) return null;
    return (
        <section className="mt-(--space-7) text-(length:--fine-size) leading-(--fine-line) text-text-muted">
            <h2 className="font-semibold">Sources</h2>
            <ul className="mt-(--space-2) [&>li+li]:mt-(--space-1)">
                {sources.map((source) => (
                    <li key={source}>{source}</li>
                ))}
            </ul>
        </section>
    );
}
