import { parseGetBody, PayloadError, type GetBody } from "./payload.ts";

export type ApiError = "not-found" | "rate-limited" | "offline" | "bad-payload";
export type GetResult = { ok: true; body: GetBody } | { ok: false; error: ApiError };
export type DeleteResult = { ok: true } | { ok: false; error: ApiError };

export interface Api {
    get(): Promise<GetResult>;
    remove(): Promise<DeleteResult>;
    live(seq: number, cursor: string | null, signal: AbortSignal): Promise<Response | ApiError>;
}

function statusError(status: number): ApiError {
    if (status === 404) return "not-found";
    if (status === 429) return "rate-limited";
    return "offline";
}

export function createApi(opts: { fetch: typeof fetch; id: string; key: string }): Api {
    const base = `/v1/s/${encodeURIComponent(opts.id)}`;

    // The key rides in the body only, so it never reaches a URL, a log or a Referer.
    function send(
        method: "POST" | "DELETE",
        url: string,
        body: Record<string, string>,
        headers: Record<string, string> = {},
        signal?: AbortSignal,
    ): Promise<Response> {
        return opts.fetch(url, {
            method,
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify(body),
            referrerPolicy: "strict-origin",
            credentials: "omit",
            cache: "no-store",
            redirect: "error",
            signal,
        });
    }

    return {
        async get() {
            let res: Response;
            try {
                res = await send("POST", base, { k: opts.key });
            } catch {
                return { ok: false, error: "offline" };
            }
            if (res.status !== 200) return { ok: false, error: statusError(res.status) };
            try {
                return { ok: true, body: parseGetBody(await res.json()) };
            } catch (err) {
                if (err instanceof PayloadError || err instanceof SyntaxError) {
                    return { ok: false, error: "bad-payload" };
                }
                return { ok: false, error: "offline" };
            }
        },

        async remove() {
            try {
                const res = await send("DELETE", base, { k: opts.key });
                if (res.ok) return { ok: true };
                return { ok: false, error: statusError(res.status) };
            } catch {
                return { ok: false, error: "offline" };
            }
        },

        async live(seq, cursor, signal) {
            try {
                const res = await send(
                    "POST",
                    `${base}/jobs/${seq}/live`,
                    { k: opts.key, cursor: cursor ?? "" },
                    { Accept: "text/event-stream" },
                    signal,
                );
                if (res.status === 200) return res;
                return statusError(res.status);
            } catch {
                return "offline";
            }
        },
    };
}
