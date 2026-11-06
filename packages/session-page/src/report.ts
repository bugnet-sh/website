// The browser's reportError reaches window.onerror and the console like an uncaught error would
export function reportError(err: unknown): void {
    if (typeof globalThis.reportError === "function") globalThis.reportError(err);
    else console.error(err);
}
