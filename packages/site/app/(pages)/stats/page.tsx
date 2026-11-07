import type { Metadata } from "next";
import { StatsHead } from "../../../components/stats/head";
import { Headline } from "../../../components/stats/headline";
import { MoneyChart } from "../../../components/stats/money-chart";
import { StatsProvider } from "../../../components/stats/stats-provider";

export const metadata: Metadata = {
    title: "Bugnet stats",
};

export default function StatsPage() {
    return (
        <main>
            <StatsProvider>
                <StatsHead />
                <Headline />
                <MoneyChart />
            </StatsProvider>
        </main>
    );
}
