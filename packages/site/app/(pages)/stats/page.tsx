import { StatsHead } from "../../../components/stats/head";
import { Headline } from "../../../components/stats/headline";
import { Limits } from "../../../components/stats/limits";
import { MoneyChart } from "../../../components/stats/money-chart";
import { Panels } from "../../../components/stats/panels";
import { PaymentsBreakdown } from "../../../components/stats/payments-breakdown";
import { PaymentsTable } from "../../../components/stats/payments-table";
import { Providers } from "../../../components/stats/providers";
import { SessionsTable } from "../../../components/stats/sessions-table";
import { StatsProvider } from "../../../components/stats/stats-provider";
import { pageMetadata } from "../../../lib/content/meta";
import { Usage } from "../../../components/stats/usage";

export const metadata = pageMetadata("/stats/", "Stats", "Live numbers from Bugnet.");

export default function StatsPage() {
    return (
        <main>
            <StatsProvider>
                <StatsHead />
                <Headline />
                <MoneyChart />
                <Panels>
                    <Usage />
                    <PaymentsBreakdown />
                </Panels>
                <Providers />
                <Limits />
            </StatsProvider>
            {/* Paged on their own, so they sit outside the summary that refreshes every 30 s */}
            <SessionsTable />
            <PaymentsTable />
        </main>
    );
}
