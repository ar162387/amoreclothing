import { supabase } from "@/integrations/supabase/client";

export type SitePage = "home" | "contact";
export type MediaType = "image" | "video";

export interface SiteMediaValue {
    type: MediaType;
    url: string;
    poster_url?: string;
    alt?: string;
}

/** 1-5 items. Slots with more than one item auto-rotate on the public site. */
export type SiteMediaList = SiteMediaValue[];

export interface HomeHero {
    eyebrow: string;
    title: string;
    body: string;
    media: SiteMediaList;
}

export interface HomeProductsSection {
    eyebrow: string;
    title: string;
}

export interface HomeStyleTile {
    eyebrow: string;
    title: string;
    href: string;
    media: SiteMediaList;
}

export interface HomeStyleSection {
    eyebrow: string;
    title: string;
    tiles: [HomeStyleTile, HomeStyleTile];
}

export interface HomePhilosophySection {
    eyebrow: string;
    quote: string;
}

export interface HomeContent {
    hero: HomeHero;
    products: HomeProductsSection;
    style: HomeStyleSection;
    philosophy: HomePhilosophySection;
    /** Seconds each rotating item stays on screen before crossfading. Applies to hero + both tiles. */
    media_rotation_seconds: number;
}

export interface ContactHero {
    eyebrow: string;
    title: string;
    body: string;
    media: SiteMediaValue;
}

export interface ContactInfo {
    email: string;
    phone: string;
    instagram_handle: string;
    instagram_url: string;
    location: string;
    whatsapp_message: string;
}

export interface ContactFormCopy {
    title: string;
    success_message: string;
}

export interface ContactContent {
    hero: ContactHero;
    info: ContactInfo;
    form: ContactFormCopy;
}

export interface SiteContent {
    home: HomeContent;
    contact: ContactContent;
}

// What the DB actually holds: any subtree may be missing, since content is
// merged against SITE_CONTENT_DEFAULTS on read. See src/lib/siteContent.ts.
export type DeepPartial<T> = T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export type PartialSiteContent = { [P in SitePage]?: DeepPartial<SiteContent[P]> };

export interface SiteContentRow {
    page: SitePage;
    content: unknown;
    updated_at?: string;
}

export const siteContentService = {
    async getAll() {
        return await supabase.from("site_content").select("*").order("page");
    },

    async getPage(page: SitePage) {
        return await supabase.from("site_content").select("*").eq("page", page).maybeSingle();
    },

    async upsertPage(page: SitePage, content: unknown) {
        return await supabase
            .from("site_content")
            .upsert({ page, content }, { onConflict: "page" })
            .select()
            .single();
    },
};
