
import { s3Client } from "@/integrations/supabase/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";

// Raw-camera-photo ceiling for what we'll even attempt to read into the browser — the real, much
// smaller limit that actually reaches S3 is enforced by compressImage() below. 15-25MB straight off a
// phone/DSLR is normal and shouldn't be rejected outright; it just needs to be downsized first.
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30 MB
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB

// Longest edge for a product/site photo after compression — comfortably larger than any screen this
// site displays it on, including the full-screen product viewer's ~2.2x pinch-zoom (a 3200px source
// still has ~1450px of real detail per screen-pixel at max zoom on a standard 1440px-wide display).
// These photos are professionally shot (paid models, paid photography) — bias toward "you can't tell
// it was compressed" over squeezing every last KB. Quality 0.92 is the JPEG range generally considered
// visually indistinguishable from the source on a screen; it still cuts a 15-25MB camera original down
// to roughly 2-5MB, which is the actual problem (uncapped raw photos tanking page load speed).
const MAX_IMAGE_DIMENSION = 3200;
const JPEG_QUALITY = 0.92;
// Below this, a source file is almost certainly already web-sized — skip re-encoding it.
const COMPRESS_SKIP_THRESHOLD_BYTES = 2.5 * 1024 * 1024; // 2.5 MB

/** Downscales/re-encodes an oversized image client-side before it ever leaves the browser, via a canvas
 * (no dependency needed). PNGs stay PNG (keeps transparency, still shrinks a lot from resizing alone);
 * everything else is re-encoded as JPEG at JPEG_QUALITY, which is where the real size reduction comes
 * from for camera photos. Falls back to the original file untouched on any failure or if compression
 * didn't actually help — this must never be the reason an upload fails. */
async function compressImage(file: File): Promise<File> {
  if (file.size <= COMPRESS_SKIP_THRESHOLD_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, outputType, outputType === "image/jpeg" ? JPEG_QUALITY : undefined),
    );
    if (!blob || blob.size >= file.size) return file;

    const newName = outputType === file.type ? file.name : file.name.replace(/\.\w+$/, ".jpg");
    return new File([blob], newName, { type: outputType });
  } catch (error) {
    console.error("Image compression failed, uploading the original file instead:", error);
    return file;
  }
}

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
        const uploadFile = IMAGE_MIME_TYPES.has(file.type) ? await compressImage(file) : file;

        const fileExt = resolveExtension(uploadFile);
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${folder}/${fileName}`;

        // Convert file to ArrayBuffer to avoid stream reader issues in some browser environments
        const fileBuffer = await uploadFile.arrayBuffer();

        const command = new PutObjectCommand({
            Bucket: "products",
            Key: filePath,
            Body: new Uint8Array(fileBuffer), // Send as Uint8Array
            ContentType: uploadFile.type,
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
