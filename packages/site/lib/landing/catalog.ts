import file from "../../content/catalog.json";
import type { PackageRow } from "../stats/types";

/**
 * The router's production catalog (bugnet-router/config/packages.json), copied here byte for byte
 * so Pricing shows the real prices even when the live stats feed is off. The live feed wins when
 * it answers; a test keeps this copy equal to the router's file when that repository sits beside
 * this one.
 */
type CatalogFile = {
    packages: {
        id: string;
        resources: {
            vcpu: number;
            memory_mib: number;
            disk_gib: number;
            gpu_count: number;
            gpu_memory_gib: number;
            gpu_model?: string;
        };
        minutes: number;
        price_micros: number;
        extension_of?: string;
    }[];
};

/** The catalog's start packages as the feed serves them; an extension is not sold on its own */
export function catalogPackages(catalog: CatalogFile = file): PackageRow[] {
    return catalog.packages
        .filter((p) => !p.extension_of)
        .map((p) => ({
            id: p.id,
            vcpu: p.resources.vcpu,
            memoryMiB: p.resources.memory_mib,
            diskGiB: p.resources.disk_gib,
            gpu:
                p.resources.gpu_count > 0
                    ? {
                          count: p.resources.gpu_count,
                          memoryGiB: p.resources.gpu_memory_gib,
                          model: p.resources.gpu_model ?? null,
                      }
                    : null,
            minutes: p.minutes,
            priceMicros: p.price_micros,
        }));
}
