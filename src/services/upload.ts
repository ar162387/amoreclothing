import { supabase } from "@/integrations/supabase/client";

// Upper bound on what we'll even send. Cloudinary re-encodes and caps the stored file server-side
// (see IMAGE_INCOMING_TRANSFORM in api/cloudinary-sign.ts), so there is no browser-side compression
// step anymore — a 15-25MB camera original is fine, it just gets a slightly longer upload.
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30 MB
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB

// Give a big camera photo on a slow connection room to finish, but don't hang the "Uploading…"
// spinner forever if the request truly stalls.
const UPLOAD_TIMEOUT_MS = 90 * 1000;

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
  transformation?: string;
}

/**
 * Uploads one file to Cloudinary using a *signed* upload: the browser asks our own
 * `/api/cloudinary-sign` route (gated on a valid Supabase session) for a short-lived signature,
 * then POSTs the file straight to Cloudinary. No Cloudinary secret and no long-lived unsigned
 * preset ships in the client bundle.
 *
 * There is deliberately NO client-side resize/re-encode — that used to run a full canvas
 * decode+encode on the main thread and could take minutes on a large camera JPEG. Cloudinary
 * applies an incoming transform (`c_limit,w_3200/q_auto:good`) on its own servers, so the stored
 * original is still capped; the browser just does a plain multipart upload.
 *
 * Returns Cloudinary's `secure_url` — the canonical delivery URL with NO transforms baked in
 * (e.g. https://res.cloudinary.com/<cloud>/image/upload/v123/products/abc.jpg). Per-use resizing
 * happens at render time via src/lib/cloudinary.ts.
 */
async function upload(file: File, folder: string): Promise<string> {
  const isVideo = VIDEO_MIME_TYPES.has(file.type);
  const resourceType = isVideo ? "video" : "image";

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
  form.append("file", file);
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
      throw new Error("Upload timed out. Check your connection and try again with a smaller file.");
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
