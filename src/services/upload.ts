import { supabase } from "@/integrations/supabase/client";

// Raw-camera-photo ceiling for what we'll even attempt to read into the browser — the real, much
// smaller limit that actually reaches the CDN is enforced by compressImage() below. 15-25MB straight
// off a phone/DSLR is normal and shouldn't be rejected outright; it just needs to be downsized first.
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30 MB
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB

// Longest edge for a product/site photo after compression. Media is served from Cloudinary, which
// does format (`f_auto`) and quality (`q_auto`) selection per-request on delivery — so this local
// pass is only about not *storing* a 20MB camera original in the first place (it would burn the
// Cloudinary storage quota for no benefit). 3200px is comfortably larger than any viewport this
// site renders on, including the full-screen viewer's ~2.2x pinch-zoom. Quality 0.92 is visually
// indistinguishable from the source on a screen and cuts a 15-25MB original to roughly 2-5MB.
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

interface SignResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
}

/**
 * Uploads one file to Cloudinary using a *signed* upload: the browser asks our own
 * `/api/cloudinary-sign` route (which is gated on a valid Supabase session) for a short-lived
 * signature, then POSTs the file straight to Cloudinary. No Cloudinary secret and no long-lived
 * unsigned preset ships in the client bundle.
 *
 * Returns Cloudinary's `secure_url` — the canonical delivery URL with NO transforms baked in
 * (e.g. https://res.cloudinary.com/<cloud>/image/upload/v123/products/abc.jpg). Per-use resizing
 * happens at render time via src/lib/cloudinary.ts, so the same stored URL serves a 96px thumb and
 * a 2560px zoom.
 */
async function upload(file: File, folder: string): Promise<string> {
  try {
    const isVideo = VIDEO_MIME_TYPES.has(file.type);
    const uploadFile = IMAGE_MIME_TYPES.has(file.type) ? await compressImage(file) : file;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("You must be signed in to upload media.");

    const signRes = await fetch("/api/cloudinary-sign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ folder }),
    });
    if (!signRes.ok) {
      const detail = await signRes.text().catch(() => "");
      throw new Error(`Could not authorize upload (${signRes.status}). ${detail}`);
    }
    const { cloudName, apiKey, timestamp, signature, folder: signedFolder } =
      (await signRes.json()) as SignResponse;

    const form = new FormData();
    form.append("file", uploadFile);
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("signature", signature);
    form.append("folder", signedFolder);

    const resourceType = isVideo ? "video" : "image";
    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      { method: "POST", body: form },
    );
    const cloudJson = (await cloudRes.json()) as { secure_url?: string; error?: { message?: string } };
    if (!cloudRes.ok || !cloudJson.secure_url) {
      throw new Error(cloudJson.error?.message ?? `Cloudinary upload failed (${cloudRes.status}).`);
    }
    return cloudJson.secure_url;
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
