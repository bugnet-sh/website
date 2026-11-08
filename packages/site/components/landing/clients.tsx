import { useId } from "react";
import { cx } from "../../lib/cx";
import { clientHref, clients } from "../../lib/landing/clients";
import { Band, Frame } from "../shell/frame";
import { SectionTitle } from "../stats/panels";

/** Each breakpoint's first column pads to the frame's edge, as the stats headline's cells do. */
function inset(i: number): string {
    return cx(
        i % 7 === 0 ? "px-(--pad)" : "px-(--space-5)",
        i % 4 === 0 ? "narrow:px-(--pad)" : "narrow:px-(--space-5)",
        i % 2 === 0 ? "phone:px-(--pad)" : "phone:px-(--space-5)",
    );
}

/** One row of client names, each linking to its install section; 4 and then 2 to a row. */
export function Clients() {
    const id = useId();
    return (
        <Band rail={false}>
            <Frame padded={false}>
                <section aria-labelledby={id}>
                    <div className="px-(--pad) pt-(--space-6)">
                        <SectionTitle id={id}>Works with</SectionTitle>
                    </div>
                    <ul className="grid grid-cols-7 gap-(--hairline) bg-line narrow:grid-cols-4 phone:grid-cols-2">
                        {clients.map((client, i) => (
                            <li key={client.id} className="flex bg-bg">
                                <a
                                    href={clientHref(client.id)}
                                    className={cx(
                                        "flex-1 py-(--space-4) text-(length:--ui-size) leading-(--ui-line) whitespace-nowrap text-text hover:bg-surface-hover focus-visible:-outline-offset-(--ring)",
                                        inset(i),
                                    )}
                                >
                                    {client.name}
                                </a>
                            </li>
                        ))}
                        {/* Fills the last slot of a row of 4 or 2, so the grid's lines never show through */}
                        <li aria-hidden className="hidden bg-bg narrow:block" />
                    </ul>
                </section>
            </Frame>
        </Band>
    );
}
