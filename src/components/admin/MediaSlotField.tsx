import { AlertTriangle } from 'lucide-react';
import MediaUploader, { type PendingMedia } from '@/components/admin/MediaUploader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SiteMediaValue } from '@/services/siteContent';
import { SITE_MEDIA_SLOTS } from '@/config/siteMediaSlots';

interface MediaSlotFieldProps {
  /** Key into SITE_MEDIA_SLOTS, e.g. 'home.hero'. Also used as the base id. */
  slotId: string;
  value: SiteMediaValue | null;
  onValueChange: (value: SiteMediaValue | null) => void;
  pending: PendingMedia | null;
  onPendingChange: (pending: PendingMedia | null) => void;
  posterPending: PendingMedia | null;
  onPosterPendingChange: (pending: PendingMedia | null) => void;
  disabled?: boolean;
}

const MediaSlotField = ({
  slotId,
  value,
  onValueChange,
  pending,
  onPendingChange,
  posterPending,
  onPosterPendingChange,
  disabled,
}: MediaSlotFieldProps) => {
  const hint = SITE_MEDIA_SLOTS[slotId];
  const isVideo = pending?.kind === 'video' || (!pending && value?.type === 'video');
  const hasPoster = Boolean(posterPending || value?.poster_url);

  const posterValue: SiteMediaValue | null = value?.poster_url
    ? { type: 'image', url: value.poster_url }
    : null;

  const handlePosterChange = (v: SiteMediaValue | null) => {
    if (!value) return;
    onValueChange({ ...value, poster_url: v?.url });
  };

  // There's something on screen to describe once either a pending file or a saved value exists.
  // Editing a pending file's alt patches the pending object (nothing to upload yet); once it's
  // saved, further edits patch the persisted value directly.
  const altValue = pending?.alt ?? value?.alt ?? '';
  const handleAltChange = (alt: string) => {
    if (pending) onPendingChange({ ...pending, alt });
    else if (value) onValueChange({ ...value, alt });
  };

  return (
    <div className="space-y-3">
      <MediaUploader
        id={slotId}
        label={hint?.label ?? slotId}
        hint={hint}
        value={value}
        onChange={onValueChange}
        pending={pending}
        onPendingChange={onPendingChange}
        allowVideo
        previewClassName={hint?.previewClassName}
        disabled={disabled}
      />

      {(pending || value?.url) && (
        <div className="space-y-2">
          <Label htmlFor={`${slotId}.alt`}>Alt text</Label>
          <Input
            id={`${slotId}.alt`}
            value={altValue}
            onChange={(e) => handleAltChange(e.target.value)}
            placeholder="Describe the image for accessibility & search, e.g. &quot;Model wearing the RAR Studio silk blouse in cream&quot;"
            disabled={disabled}
          />
        </div>
      )}

      {isVideo && (
        <div className="pl-4 border-l-2 border-border space-y-2">
          <MediaUploader
            id={`${slotId}.poster`}
            label="Poster frame"
            value={posterValue}
            onChange={handlePosterChange}
            pending={posterPending}
            onPendingChange={onPosterPendingChange}
            allowVideo={false}
            previewClassName="aspect-video w-40"
            disabled={disabled}
          />
          {!hasPoster && (
            <p className="flex items-center gap-2 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              Videos should have a poster frame — some devices (e.g. iOS Low Power Mode) block
              autoplay and show this image instead.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MediaSlotField;
