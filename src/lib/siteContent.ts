import type { SiteContent, PartialSiteContent } from "@/services/siteContent";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Recursively merges `override` onto `defaults`, iterating the DEFAULTS'
 * keys — never the override's. This is what guarantees a page can never
 * render blank: any key missing, stale, or typo'd in the DB blob simply
 * falls back to its default, and the result always has every key of T.
 *
 * An empty string on the override is treated as "not set" so clearing a
 * field in the admin form restores the built-in default rather than
 * rendering blank text.
 */
export function mergeContent<T>(defaults: T, override: unknown): T {
    if (override === undefined || override === null || override === "") {
        return defaults;
    }

    if (Array.isArray(defaults)) {
        // An empty array is treated the same as "" / null — absent, falls
        // back to the default. A rotating media slot must never resolve to
        // zero items (the admin UI also guards against saving one), but
        // this is the last line of defense against a blank hero/tile.
        if (Array.isArray(override) && override.length > 0) return override as T;
        return defaults;
    }

    if (isPlainObject(defaults) && isPlainObject(override)) {
        const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
        for (const key of Object.keys(defaults as Record<string, unknown>)) {
            out[key] = mergeContent(
                (defaults as Record<string, unknown>)[key],
                (override as Record<string, unknown>)[key],
            );
        }
        return out as T;
    }

    return override as T;
}

export function mergeSiteContent(defaults: SiteContent, override: PartialSiteContent): SiteContent {
    return mergeContent(defaults, override);
}

/**
 * Strips empty-string / null / undefined leaves before an upsert, keeping
 * saved blobs small and preserving the "" === absent convention on both
 * read and write.
 */
export function pruneEmpty<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((item) => pruneEmpty(item)) as unknown as T;
    }
    if (isPlainObject(value)) {
        const out: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            if (val === "" || val === null || val === undefined) continue;
            out[key] = pruneEmpty(val);
        }
        return out as T;
    }
    return value;
}

/** Derives a wa.me-compatible digit string from a human-readable phone number. */
export function toWaNumber(phone: string): string {
    return phone.replace(/\D/g, "");
}
