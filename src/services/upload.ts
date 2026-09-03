import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Accept basically anything a DSLR/phone produces. Big originals are fine — if they're over
// Cloudinary's free-plan hard cap they get downscaled in the browser first (see shrinkForUpload).
export const MAX_IMAGE_BYTES = 60 * 1024 * 1024; // 60 MB
export const MAX_VIDEO_BYTES = 90 * 1024 * 1024; // 90 MB (Cloudinary free video cap is 100 MB)

// Cloudinary free plan rejects image uploads larger than 10 MB outright. Shrink anything above a
// safe margin BEFORE uploading; leave everything smaller untouched (no processing = instant).
const CLOUDINARY_IMAGE_LIMIT = 10 * 1024 * 1024;
const SHRINK_ABOVE_BYTES = 9 * 1024 * 1024;

// Downscale target — larger than any viewport this site renders on, including the full-screen
// viewer's 2560px zoom. Cloudinary still re-encodes/re-sizes per delivery on top of this.
const MAX_IMAGE_DIMENSION = 3200;

const UPLOAD_TIMEOUT_MS = 120 * 1000;

export const ACCEPT_IMAGE = "image/jpeg,image/png,image/webp,image/avif";
export const ACCEPT_VIDEO = "video/mp4,video/webm";
export const ACCEPT_MEDIA = `${ACCEPT_IMAGE},${ACCEPT_VIDEO}`;

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm"]);

/** Same downscale+re-encode as the worker, but on the main thread — fallback for browsers without
 * OffscreenCanvas / module workers. */
async function shrinkOnMainThread(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();

    const longest = Math.max(img.naturalWidth, img.naturalHeight) || MAX_IMAGE_DIMENSION;
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / longest);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    let blob: Blob | null = null;
    for (const q of [0.9, 0.82, 0.72, 0.6]) {
      blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
      if (blob && blob.size <= CLOUDINARY_IMAGE_LIMIT) break;
    }
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Only runs when a file is close to / over Cloudinary's 10 MB free-plan limit. Downscales to
 * <=3200px and re-encodes as JPEG, stepping quality down until it's under the limit. Done in a Web
 * Worker (see workers/imageResize.worker.ts) so it stays fast even if the tab is backgrounded;
 * falls back to a main-thread pass if workers/OffscreenCanvas aren't available.
 */
async function shrinkForUpload(file: File): Promise<File> {
  if (file.size <= SHRINK_ABOVE_BYTES || !IMAGE_MIME_TYPES.has(file.type)) return file;

  try {
    if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
      const worker = new Worker(new URL("../workers/imageResize.worker.ts", import.meta.url), {
        type: "module",
      });
      try {
        const blob = await new Promise<Blob>((resolve, reject) => {
          worker.onmessage = (e: MessageEvent<{ ok: boolean; blob?: Blob; error?: string }>) =>
            e.data.ok && e.data.blob ? resolve(e.data.blob) : reject(new Error(e.data.error));
          worker.onerror = (e) => reject(new Error(e.message));
          worker.postMessage({ file, maxDim: MAX_IMAGE_DIMENSION, limit: CLOUDINARY_IMAGE_LIMIT });
        });
        return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
      } finally {
        worker.terminate();
      }
    }
  } catch (error) {
    console.warn("worker shrink failed, falling back to main thread", error);
  }

  try {
    return await shrinkOnMainThread(file);
  } catch (error) {
    console.warn("shrinkForUpload failed; uploading original", error);
    return file;
  }
}

interface SignResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  transformation?: string;
}

/**
 * Signed Cloudinary upload: the browser asks our own `/api/cloudinary-sign` route (gated on a valid
 * Supabase session) for a short-lived signature, then POSTs the file straight to Cloudinary. No
 * Cloudinary secret and no long-lived unsigned preset ships in the client bundle.
 *
 * Returns Cloudinary's `secure_url` — the canonical delivery URL with NO transforms baked in.
 * Per-use resizing happens at render time via src/lib/cloudinary.ts.
 */
async function upload(file: File, folder: string): Promise<string> {
  const isVideo = VIDEO_MIME_TYPES.has(file.type);
  const resourceType = isVideo ? "video" : "image";

  let toUpload = file;
  if (!isVideo && file.size > SHRINK_ABOVE_BYTES) {
    const dismiss = toast.loading("Optimising image for upload…");
    try {
      toUpload = await shrinkForUpload(file);
    } finally {
      toast.dismiss(dismiss);
    }
    if (toUpload.size > CLOUDINARY_IMAGE_LIMIT) {
      throw new Error(
        "Could not get this image under Cloudinary's 10 MB limit. Try exporting it at a lower resolution.",
      );
    }
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("You must be signed in to upload media.");

  const signRes = await fetch("/api/cloudinary-sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ folder, resourceType }),
  });
  if (!signRes.ok) {
    const detail = await signRes.text().catch(() => "");
    throw new Error(`Could not authorize upload (${signRes.status}). ${detail}`.trim());
  }
  const sign = (await signRes.json()) as SignResponse;

  const form = new FormData();
  form.append("file", toUpload);
  form.append("api_key", sign.apiKey);
  form.append("timestamp", String(sign.timestamp));
  form.append("signature", sign.signature);
  form.append("folder", sign.folder);
  if (sign.transformation) form.append("transformation", sign.transformation);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  let cloudJson: { secure_url?: string; error?: { message?: string } };
  try {
    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${sign.cloudName}/${resourceType}/upload`,
      { method: "POST", body: form, signal: controller.signal },
    );
    cloudJson = await cloudRes.json();
    if (!cloudRes.ok || !cloudJson.secure_url) {
      throw new Error(cloudJson.error?.message ?? `Cloudinary upload failed (${cloudRes.status}).`);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Upload timed out. Check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
  return cloudJson.secure_url!;
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
