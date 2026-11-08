import type { Metadata } from "next";
import { Deck } from "../../../components/pitch/deck";
import { PitchSlides } from "../../../components/pitch/slides";
import { pageMetadata } from "../../../lib/content/meta";

export const metadata: Metadata = {
    ...pageMetadata(
        "/pitch/",
        "Pitch",
        "Throwaway sandboxes for AI agents. Pay per run in USDC on Solana. No account, no API key.",
    ),
    robots: { index: false },
};

export default function PitchPage() {
    return (
        <Deck>
            <PitchSlides />
        </Deck>
    );
}
