import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { internalRefs } from "../../test/internal-refs";
import { readDoc } from "./doc-file";
import { docBySlug, docs, type Doc } from "./docs";
import { tocOf } from "./toc";

// Tests run from the repository root, not the folder `next build` reads from
const dir = fileURLToPath(new URL("../../content/docs", import.meta.url));
const read = (doc: Doc) => readDoc(doc, dir);
const install = docBySlug("install") as Doc;

describe("docs content", () => {
    it("names none of the team's own files, notes or sessions, front matter included", () => {
        for (const doc of docs) {
            const file = readFileSync(join(dir, doc.file), "utf8");
            expect(internalRefs(file), doc.file).toEqual([]);
            expect(file, doc.file).toMatch(/^---\ntitle: [^\n]+\n---\n/);
            expect(read(doc).body, doc.file).not.toMatch(/<!--|PENDING/);
        }
    });

    it("has a section for each client the landing page links to", () => {
        const ids = tocOf(read(install).body).map((item) => item.id);
        expect(ids).toEqual(
            expect.arrayContaining([
                "claude-code",
                "claude-ai",
                "cursor",
                "vs-code",
                "codex-cli",
                "devin-desktop",
                "any-mcp-client",
                "bridge",
            ]),
        );
        expect(read(install).body).toMatch(/^# Install \{#install\}$/m);
    });

    it("sends readers to the stats page for the live limits", () => {
        expect(read(docBySlug("limits") as Doc).body).toContain("](/stats/#limits)");
    });
});
