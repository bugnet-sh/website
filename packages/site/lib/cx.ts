/** Joins the class names that are set, so a condition can leave one out. */
export function cx(...names: (string | false | null | undefined)[]): string {
    return names.filter(Boolean).join(" ");
}
