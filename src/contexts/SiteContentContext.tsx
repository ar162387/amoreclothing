import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { siteContentService, SiteContent, PartialSiteContent, SitePage } from "@/services/siteContent";
import { SITE_CONTENT_DEFAULTS } from "@/config/siteContent.defaults";
import { mergeSiteContent } from "@/lib/siteContent";

const CACHE_KEY = "amore.siteContent.v1";

function readCache(): PartialSiteContent {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? (JSON.parse(raw) as PartialSiteContent) : {};
    } catch {
        return {};
    }
}

function writeCache(raw: PartialSiteContent) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
    } catch {
        // localStorage may be unavailable (private mode, quota) — safe to ignore.
    }
}

interface SiteContentContextType {
    content: SiteContent;
    loading: boolean;
    refresh: () => Promise<void>;
}

const SiteContentContext = createContext<SiteContentContextType>({
    content: SITE_CONTENT_DEFAULTS,
    loading: true,
    refresh: async () => { },
});

export const SiteContentProvider = ({ children }: { children: React.ReactNode }) => {
    const [raw, setRaw] = useState<PartialSiteContent>(() => readCache());
    const [loading, setLoading] = useState(true);

    const fetchContent = async () => {
        const { data, error } = await siteContentService.getAll();
        if (!error && data) {
            const next = data.reduce((acc, row) => {
                acc[row.page as SitePage] = row.content as never;
                return acc;
            }, {} as PartialSiteContent);
            setRaw(next);
            writeCache(next);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchContent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const content = useMemo(() => mergeSiteContent(SITE_CONTENT_DEFAULTS, raw), [raw]);

    return (
        <SiteContentContext.Provider value={{ content, loading, refresh: fetchContent }}>
            {children}
        </SiteContentContext.Provider>
    );
};

export const useSiteContent = () => useContext(SiteContentContext);

export const useSitePage = <P extends SitePage>(page: P): SiteContent[P] => {
    return useSiteContent().content[page];
};
