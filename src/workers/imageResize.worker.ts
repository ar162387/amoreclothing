/// <reference lib="webworker" />

/**
 * Off-main-thread image downscale for uploads. Runs in a Web Worker so it stays fast even when the
 * admin tab is backgrounded (main-thread canvas/timer work gets throttled hard when hidden — that
 * was the "upload takes minutes" symptom).
 *
 * Message in:  { file: File, maxDim: number, limit: number }
 * Message out: { ok: true, blob: Blob } | { ok: false, error: string }
 */

interface ResizeRequest {
  file: File;
  maxDim: number;
  limit: number;
}

self.onmessage = async (e: MessageEvent<ResizeRequest>) => {
  const { file, maxDim, limit } = e.data;
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height) || maxDim;
    const scale = Math.min(1, maxDim / longest);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      (self as unknown as Worker).postMessage({ ok: false, error: "no 2d context" });
      return;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    let blob: Blob | null = null;
    for (const quality of [0.9, 0.82, 0.72, 0.6]) {
      blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
      if (blob.size <= limit) break;
    }

    (self as unknown as Worker).postMessage({ ok: true, blob });
  } catch (error) {
    (self as unknown as Worker).postMessage({ ok: false, error: String(error) });
  }
};
