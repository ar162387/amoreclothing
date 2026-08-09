import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MediaUploader, { type PendingMedia } from '@/components/admin/MediaUploader';
import type { SiteMediaValue } from '@/services/siteContent';
import { SITE_MEDIA_SLOTS } from '@/config/siteMediaSlots';

export interface NewMediaEntry {
  id: string;
  file: PendingMedia;
  poster: PendingMedia | null;
}

interface RotatingMediaFieldProps {
  /** Key into SITE_MEDIA_SLOTS, e.g. 'home.hero'. */
  slotId: string;
  existing: SiteMediaValue[];
  onRemoveExisting: (index: number) => void;
  onUpdateExistingAlt: (index: number, alt: string) => void;
  newEntries: NewMediaEntry[];
  onAddNew: (pending: PendingMedia) => void;
  onRemoveNew: (id: string) => void;
  onSetNewPoster: (id: string, poster: PendingMedia | null) => void;
  onSetNewAlt: (id: string, alt: string) => void;
  maxItems?: number;
  disabled?: boolean;
}

const RotatingMediaField = ({
  slotId,
  existing,
  onRemoveExisting,
  onUpdateExistingAlt,
  newEntries,
  onAddNew,
  onRemoveNew,
  onSetNewPoster,
  onSetNewAlt,
  maxItems = 5,
  disabled = false,
}: RotatingMediaFieldProps) => {
  const hint = SITE_MEDIA_SLOTS[slotId];
  const totalCount = existing.length + newEntries.length;
  const canRemove = totalCount > 1;
  const canAddMore = totalCount < maxItems;
  const previewClassName = hint?.previewClassName ?? 'aspect-[4/5] w-40';

  return (
    <div className="space-y-3">
      <Label>{hint?.label ?? slotId}</Label>
      {hint && (
        <p className="text-xs text-muted-foreground">
          {hint.recommended} · {hint.aspect} · {hint.note}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Up to {maxItems} items ({totalCount}/{maxItems}) — with more than one, they rotate
        automatically on the site.
      </p>

      <div className="flex flex-wrap gap-4">
        {existing.map((item, index) => (
          <div key={`${item.url}-${index}`} className="space-y-2">
            <div className={`relative border rounded-lg overflow-hidden ${previewClassName}`}>
              {item.type === 'video' ? (
                <video src={item.url} poster={item.poster_url} muted loop playsInline autoPlay className="w-full h-full object-cover" />
              ) : (
                <img src={item.url} alt="" className="w-full h-full object-cover" />
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={() => onRemoveExisting(index)}
                disabled={disabled || !canRemove}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <Input
              value={item.alt ?? ''}
              onChange={(e) => onUpdateExistingAlt(index, e.target.value)}
              placeholder="Alt text"
              className="text-xs"
              disabled={disabled}
            />
          </div>
        ))}

        {newEntries.map((entry) => (
          <div key={entry.id} className="space-y-2">
            <div className={`relative border-2 border-dashed rounded-lg overflow-hidden ${previewClassName}`}>
              {entry.file.kind === 'video' ? (
                <video src={entry.file.preview} muted loop playsInline autoPlay className="w-full h-full object-cover" />
              ) : (
                <img src={entry.file.preview} alt="" className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white text-xs font-medium pointer-events-none">
                New
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={() => onRemoveNew(entry.id)}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <Input
              value={entry.file.alt ?? ''}
              onChange={(e) => onSetNewAlt(entry.id, e.target.value)}
              placeholder="Alt text"
              className="text-xs"
              disabled={disabled}
            />
            {entry.file.kind === 'video' && (
              <>
                <MediaUploader
                  id={`${slotId}.new.${entry.id}.poster`}
                  label="Poster frame"
                  value={null}
                  onChange={() => {}}
                  pending={entry.poster}
                  onPendingChange={(p) => onSetNewPoster(entry.id, p)}
                  allowVideo={false}
                  previewClassName="aspect-video w-32"
                  disabled={disabled}
                />
                {!entry.poster && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600 max-w-[8rem]">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    No poster — falls back to a blank frame if autoplay is blocked.
                  </p>
                )}
              </>
            )}
          </div>
        ))}

        {canAddMore && (
          <MediaUploader
            id={`${slotId}.add-slot`}
            label=""
            value={null}
            onChange={() => {}}
            pending={null}
            onPendingChange={(p) => {
              if (p) onAddNew(p);
            }}
            allowVideo
            previewClassName={previewClassName}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
};

export default RotatingMediaField;
