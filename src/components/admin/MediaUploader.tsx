import { useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { uploadService, ACCEPT_IMAGE, ACCEPT_MEDIA, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '@/services/upload';
import type { MediaType, SiteMediaValue } from '@/services/siteContent';
import type { SiteMediaSlotHint } from '@/config/siteMediaSlots';

export interface PendingMedia {
  file: File;
  preview: string;
  kind: MediaType;
  /** Alt text for the eventual SiteMediaValue. Edited by the parent slot field, not here — this
   * component is also used for poster-frame sub-uploaders, which don't have their own alt text. */
  alt?: string;
}

interface MediaUploaderProps {
  /** Unique id — drives the hidden input / <Label htmlFor> pair. */
  id: string;
  label: string;
  hint?: SiteMediaSlotHint;
  value: SiteMediaValue | null;
  onChange: (value: SiteMediaValue | null) => void;
  pending: PendingMedia | null;
  onPendingChange: (pending: PendingMedia | null) => void;
  /** Defaults to true. Set false for image-only slots (e.g. poster frames). */
  allowVideo?: boolean;
  previewClassName?: string;
  disabled?: boolean;
}

const detectKind = (file: File): MediaType => {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  // Fallback for files with an empty `type` (some mobile browsers)
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && ['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  return 'image';
};

const MediaUploader = ({
  id,
  label,
  hint,
  value,
  onChange,
  pending,
  onPendingChange,
  allowVideo = true,
  previewClassName = 'aspect-[4/5] w-40',
  disabled = false,
}: MediaUploaderProps) => {
  // Revoke the object URL when it's replaced or the component unmounts —
  // AdminProducts' equivalent selection handler never does this.
  useEffect(() => {
    return () => {
      if (pending?.preview) URL.revokeObjectURL(pending.preview);
    };
  }, [pending?.preview]);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const kind = detectKind(file);

    if (kind === 'video' && !allowVideo) {
      toast.error('Video is not supported for this slot. Please choose an image.');
      return;
    }
    if (kind === 'video' && !['video/mp4', 'video/webm'].includes(file.type)) {
      toast.error('Only MP4 or WebM video is supported.');
      return;
    }
    if (kind === 'image' && file.size > MAX_IMAGE_BYTES) {
      toast.error(`Image must be ${MAX_IMAGE_BYTES / (1024 * 1024)}MB or smaller.`);
      return;
    }
    if (kind === 'video' && file.size > MAX_VIDEO_BYTES) {
      toast.error(`Video must be ${MAX_VIDEO_BYTES / (1024 * 1024)}MB or smaller.`);
      return;
    }

    onPendingChange({ file, preview: URL.createObjectURL(file), kind });
  };

  const clear = () => {
    onPendingChange(null);
    onChange(null);
  };

  const renderPreviewMedia = (src: string, kind: MediaType) =>
    kind === 'video' ? (
      <video src={src} muted loop playsInline autoPlay className="w-full h-full object-cover" />
    ) : (
      <img src={src} alt="" className="w-full h-full object-cover" />
    );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint && (
        <p className="text-xs text-muted-foreground">
          {hint.recommended} · {hint.aspect} · {hint.note}
        </p>
      )}

      <div className={`relative mx-auto border-2 border-dashed rounded-lg overflow-hidden ${previewClassName}`}>
        {pending ? (
          <div className="relative w-full h-full">
            {renderPreviewMedia(pending.preview, pending.kind)}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white text-xs font-medium pointer-events-none">
              New
            </div>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={() => onPendingChange(null)}
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : value?.url ? (
          <div className="relative w-full h-full">
            {renderPreviewMedia(value.url, value.type)}
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={clear}
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center hover:bg-muted/50 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <Input
              type="file"
              accept={allowVideo ? ACCEPT_MEDIA : ACCEPT_IMAGE}
              className="hidden"
              id={id}
              onChange={handleSelect}
              disabled={disabled}
            />
            <Label htmlFor={id} className="cursor-pointer text-sm text-primary hover:underline">
              Upload {allowVideo ? 'Image or Video' : 'Image'}
            </Label>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaUploader;

/**
 * Resolves a slot's final SiteMediaValue at submit time: uploads the
 * pending file if one was selected, otherwise passes through the current
 * value unchanged. Upload is deferred to here (never on selection) so a
 * cancelled form never orphans an object in storage.
 */
export async function resolveMedia(
  pending: PendingMedia | null,
  current: SiteMediaValue | null,
  folder = 'site',
): Promise<SiteMediaValue | null> {
  if (!pending) return current;
  const url = await uploadService.uploadMedia(pending.file, folder);
  return {
    type: pending.kind,
    url,
    poster_url: current?.poster_url,
    alt: pending.alt ?? current?.alt,
  };
}
