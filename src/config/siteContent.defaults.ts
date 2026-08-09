import type { SiteContent } from "@/services/siteContent";
import heroMain from "@/assets/hero-main.jpg";
import collectionSummer from "@/assets/collection-summer.jpg";
import collectionEvening from "@/assets/collection-evening.jpg";
import contactHero from "@/assets/contact-hero.jpg";

// The complete, fully-typed content tree. Every field here is today's exact
// hardcoded copy/media, so a page with no (or a partial) DB row renders
// identically to how it looked before the CMS existed. See mergeSiteContent
// in src/lib/siteContent.ts for how a partial DB row is layered on top.
export const SITE_CONTENT_DEFAULTS: SiteContent = {
    home: {
        hero: {
            eyebrow: "New Collection",
            title: "Timeless Elegance",
            body: "Discover our debut collection of refined essentials, crafted for the modern woman.",
            media: [{ type: "image", url: heroMain, alt: "RAR Studio Collection" }],
        },
        products: {
            eyebrow: "Curated Selection",
            title: "Full Collection",
        },
        style: {
            eyebrow: "Explore",
            title: "Shop by Style",
            tiles: [
                {
                    eyebrow: "Effortless Style",
                    title: "Day to Evening",
                    href: "/",
                    media: [{ type: "image", url: collectionSummer, alt: "Day Collection" }],
                },
                {
                    eyebrow: "Sophisticated Elegance",
                    title: "Evening Wear",
                    href: "/",
                    media: [{ type: "image", url: collectionEvening, alt: "Evening Collection" }],
                },
            ],
        },
        philosophy: {
            eyebrow: "Our Philosophy",
            quote:
                '"True elegance is about feeling beautiful in your own skin. We create pieces that enhance, not overshadow."',
        },
        media_rotation_seconds: 6,
    },
    contact: {
        hero: {
            eyebrow: "Get in Touch",
            title: "Contact Us",
            body: "We'd love to hear from you. Send us a message and we'll respond as soon as possible.",
            media: { type: "image", url: contactHero, alt: "Contact RAR Studio" },
        },
        info: {
            email: "hello@rarstudio.co",
            phone: "+92 300 1234567",
            instagram_handle: "@rarstudio",
            instagram_url: "https://instagram.com",
            location: "Lahore, Pakistan",
            whatsapp_message: "Hello! I have a question about RAR Studio.",
        },
        form: {
            title: "Send a Message",
            success_message: "Message sent successfully! We'll get back to you soon.",
        },
    },
};
