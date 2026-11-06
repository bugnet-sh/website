import type { Frame, Stream } from "./payload.js";

export interface Line {
    s: Stream;
    t: string;
    open: boolean;
}

export interface OutputLimits {
    maxLines: number;
    maxChars: number;
    maxLineChars: number;
}

export const DEFAULT_LIMITS: OutputLimits = {
    maxLines: 5_000,
    maxChars: 2 * 1024 * 1024,
    maxLineChars: 16_384,
};

const ELLIPSIS = "…";

/**
 * Holds the tail of one command's output under hard caps, so a flood or a minified blob cannot
 * grow the page without bound. Dropped lines are counted, never kept.
 */
export class OutputBuffer {
    private readonly limits: OutputLimits;
    private store: Line[] = [];
    // Front of the live window; advancing it avoids the O(n) shift per dropped line.
    private start = 0;
    private chars = 0;
    private dropped = 0;
    private skipped = 0;
    private ver = 0;

    constructor(limits: OutputLimits = DEFAULT_LIMITS) {
        this.limits = limits;
    }

    get lines(): readonly Line[] {
        return this.start === 0 ? this.store : this.store.slice(this.start);
    }

    get droppedLines(): number {
        return this.dropped;
    }

    get skippedBytes(): number {
        return this.skipped;
    }

    get version(): number {
        return this.ver;
    }

    apply(frame: Frame): void {
        const pieces = frame.t.split("\n");
        const last = pieces.length - 1;
        if (last === 0 && pieces[0] === "" && !frame.cr) return;
        for (let i = 0; i <= last; i++) {
            const piece = pieces[i] ?? "";
            if (i === 0) {
                this.first(frame.s, piece, frame.cr, i < last);
            } else if (piece !== "" || i < last) {
                this.add({ s: frame.s, t: "", open: true }, piece);
                if (i < last) this.closeLast();
            }
        }
        this.trim();
        this.ver++;
    }

    skip(outBytes: number, errBytes: number): void {
        this.skipped += outBytes + errBytes;
        this.ver++;
    }

    text(): string {
        const out: string[] = [];
        for (let i = this.start; i < this.store.length; i++) out.push(this.store[i]!.t);
        return out.join("\n");
    }

    private first(s: Stream, piece: string, cr: boolean, closes: boolean): void {
        const tail = this.tail();
        if (cr) {
            if (tail === undefined) {
                this.add({ s, t: "", open: true }, piece);
            } else {
                this.chars -= tail.t.length;
                tail.s = s;
                tail.t = "";
                tail.open = true;
                this.extend(tail, piece);
            }
        } else if (tail !== undefined && tail.open && tail.s === s) {
            this.extend(tail, piece);
        } else {
            this.add({ s, t: "", open: true }, piece);
        }
        if (closes) this.closeLast();
    }

    private tail(): Line | undefined {
        return this.store.length > this.start ? this.store[this.store.length - 1] : undefined;
    }

    private closeLast(): void {
        const tail = this.tail();
        if (tail !== undefined) tail.open = false;
    }

    private add(line: Line, piece: string): void {
        this.store.push(line);
        this.extend(line, piece);
    }

    private extend(line: Line, piece: string): void {
        const max = this.limits.maxLineChars;
        // A cut line is one char over the cap and swallows the rest until its newline.
        if (line.t.length > max || piece === "") return;
        let next = line.t + piece;
        if (next.length > max) next = next.slice(0, max) + ELLIPSIS;
        this.chars += next.length - line.t.length;
        line.t = next;
    }

    private trim(): void {
        const { maxLines, maxChars } = this.limits;
        while (
            this.store.length - this.start > 1 &&
            (this.store.length - this.start > maxLines || this.chars > maxChars)
        ) {
            this.chars -= this.store[this.start]!.t.length;
            this.start++;
            this.dropped++;
        }
        if (this.start > 1024 && this.start * 2 > this.store.length) {
            this.store = this.store.slice(this.start);
            this.start = 0;
        }
    }
}
