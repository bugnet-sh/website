import { Frame } from "../../components/shell/frame";

// The landing page comes later; until then the home route is the shell alone, its frame's rails
// running from the header down to the footer
export default function HomePage() {
    return (
        <main className="flex flex-1 flex-col border-b-(length:--hairline) border-line">
            <Frame padded={false} className="flex-1" />
        </main>
    );
}
