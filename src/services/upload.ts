
import { s3Client } from "@/integrations/supabase/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB

export const ACCEPT_IMAGE = "image/jpeg,image/png,image/webp,image/avif";
export const ACCEPT_VIDEO = "video/mp4,video/webm";
export const ACCEPT_MEDIA = `${ACCEPT_IMAGE},${ACCEPT_VIDEO}`;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"]);

// Fallback extension when the filename has no dot (or the browser stripped
// it), keyed by mime type so uploads never end up with a garbage key.
const MIME_EXTENSIONS: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
};

function resolveExtension(file: File): string {
    const nameParts = file.name.split(".");
    const fromName = nameParts.length > 1 ? nameParts.pop() : undefined;
    if (fromName && fromName.length <= 5) return fromName;
    return MIME_EXTENSIONS[file.type] || "bin";
}

async function upload(file: File, folder: string): Promise<string> {
    try {
        const fileExt = resolveExtension(file);
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${folder}/${fileName}`;

        // Convert file to ArrayBuffer to avoid stream reader issues in some browser environments
        const fileBuffer = await file.arrayBuffer();

        const command = new PutObjectCommand({
            Bucket: "products",
            Key: filePath,
            Body: new Uint8Array(fileBuffer), // Send as Uint8Array
            ContentType: file.type,
            CacheControl: "public, max-age=31536000, immutable",
        });

        await s3Client.send(command);

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/products/${filePath}`;

        return publicUrl;
    } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
    }
}

export const uploadService = {
    /** Image-only upload, kept for existing callers (e.g. AdminProducts). */
    async uploadImage(file: File, folder: string = "products"): Promise<string> {
        if (!IMAGE_MIME_TYPES.has(file.type)) {
            throw new Error("Only JPEG, PNG, WEBP or AVIF images are supported.");
        }
        if (file.size > MAX_IMAGE_BYTES) {
            throw new Error(`Image must be ${MAX_IMAGE_BYTES / (1024 * 1024)}MB or smaller.`);
        }
        return upload(file, folder);
    },

    /** Image or video upload, used by the site-content media uploader. */
    async uploadMedia(file: File, folder: string = "site"): Promise<string> {
        const isImage = IMAGE_MIME_TYPES.has(file.type);
        const isVideo = VIDEO_MIME_TYPES.has(file.type);

        if (!isImage && !isVideo) {
            throw new Error("Only JPEG, PNG, WEBP images or MP4/WebM video are supported.");
        }
        if (isImage && file.size > MAX_IMAGE_BYTES) {
            throw new Error(`Image must be ${MAX_IMAGE_BYTES / (1024 * 1024)}MB or smaller.`);
        }
        if (isVideo && file.size > MAX_VIDEO_BYTES) {
            throw new Error(`Video must be ${MAX_VIDEO_BYTES / (1024 * 1024)}MB or smaller.`);
        }

        return upload(file, folder);
    },
};
