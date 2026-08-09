export interface SiteMediaSlotHint {
    id: string;
    label: string;
    aspect: string;
    recommended: string;
    note: string;
    /** Tailwind classes sizing the preview box in the admin form. */
    previewClassName: string;
}

const VIDEO_RULE =
    "MP4 (H.264) or WebM, ≤ 25MB, 6–12s seamless loop, no audio. A poster frame is required.";

export const SITE_MEDIA_SLOTS: Record<string, SiteMediaSlotHint> = {
    "home.hero": {
        id: "home.hero",
        label: "Home Hero",
        aspect: "Full-bleed, no fixed ratio",
        recommended: "2400 × 1600px min (3:2 or wider)",
        note: `Crops to the viewport. Headline sits left, so keep the subject right of centre. ${VIDEO_RULE}`,
        previewClassName: "aspect-[3/2] w-full max-w-xs",
    },
    "home.style.tiles.0": {
        id: "home.style.tiles.0",
        label: "Shop by Style — Tile 1",
        aspect: "4:5 portrait",
        recommended: "1200 × 1500px",
        note: `A dark gradient covers the bottom third and the caption sits bottom-left — keep that area clear. ${VIDEO_RULE}`,
        previewClassName: "aspect-[4/5] w-40",
    },
    "home.style.tiles.1": {
        id: "home.style.tiles.1",
        label: "Shop by Style — Tile 2",
        aspect: "4:5 portrait",
        recommended: "1200 × 1500px",
        note: `A dark gradient covers the bottom third and the caption sits bottom-left — keep that area clear. ${VIDEO_RULE}`,
        previewClassName: "aspect-[4/5] w-40",
    },
    "contact.hero": {
        id: "contact.hero",
        label: "Contact Hero",
        aspect: "Full-bleed, no fixed ratio",
        recommended: "2400 × 1200px min (2:1 or wider)",
        note: `Crops to the viewport. Headline is centred — keep the middle uncluttered. ${VIDEO_RULE}`,
        previewClassName: "aspect-[2/1] w-full max-w-xs",
    },
};
