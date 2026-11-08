const PAGE = /^(\/[^?#]*?)([?#].*)?$/;

/** Links that leave the site open in a new tab and carry the arrow. */
export function isExternal(href: string): boolean {
    return /^https?:\/\//i.test(href);
}

/**
 * A link to a site page, with the trailing slash its exported folder is served at, so `/privacy`
 * in the legal text resolves without a redirect.
 */
export function siteHref(href: string): string {
    const match = href.startsWith("//") ? null : PAGE.exec(href);
    if (!match) return href;
    const [, path = "", rest = ""] = match;
    const last = path.slice(path.lastIndexOf("/") + 1);
    if (last === "" || last.includes(".")) return href;
    return `${path}/${rest}`;
}
