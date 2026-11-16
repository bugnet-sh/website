import type { Metadata } from "next";
import { Deck } from "../../../components/pitch/deck";
import { pitchSlides } from "../../../components/pitch/slides";
import { StatsProvider } from "../../../components/stats/stats-provider";
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
    // One feed for every live price in the deck
    return (
        <StatsProvider>
            <Deck>{pitchSlides()}</Deck>
        </StatsProvider>
    );
}
