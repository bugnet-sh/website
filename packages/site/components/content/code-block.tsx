import { CopyButton } from "../stats/copy-button";

/** A fenced block: one line per line, scrolled sideways when long, with Copy beside it. */
export function CodeBlock({ code }: { code: string }) {
    return (
        <div className="mt-(--space-4) flex items-start border-(length:--hairline) border-line bg-surface first:mt-0">
            <pre className="min-w-0 flex-1 overflow-x-auto py-(--space-3) pl-(--space-4) font-mono text-(length:--ui-size) leading-(--ui-line) whitespace-pre">
                <code>{code}</code>
            </pre>
            {/* Centred on the first line: 8 px + half a 28 px button = 12 px + half a 20 px line */}
            <div className="shrink-0 p-(--space-2)">
                <CopyButton text={code} label="Copy code" />
            </div>
        </div>
    );
}
