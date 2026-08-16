import { useEffect, useRef, useState } from 'react';
import type { SiteMediaValue } from '@/services/siteContent';

interface SiteMediaProps {
  media: SiteMediaValue;
  className?: string;
  alt?: string;
  /** Heroes and above-the-fold media should set this for eager loading. */
  priority?: boolean;
  /**
   * Whether this item is the one currently visible. Defaults to true.
   * Rotators pass false for off-screen items so their video pauses instead
   * of playing behind an opacity-0 layer.
   */
  active?: boolean;
}

const SiteMedia = ({ media, className, alt, priority = false, active = true }: SiteMediaProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Set imperatively rather than via the JSX `fetchPriority` prop: @types/react already
    // declares it (matching a future React version) but React 18's runtime doesn't recognize
    // the camelCase prop yet, so passing it in JSX just warns and never reaches the DOM. The
    // browser only reads the lowercase `fetchpriority` attribute anyway.
    imgRef.current?.setAttribute('fetchpriority', priority ? 'high' : 'auto');
  }, [priority]);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (!active) {
      el.pause();
      return;
    }

    // React doesn't always reflect `muted` to the DOM property on first
    // mount, and iOS refuses to autoplay an element it considers unmuted —
    // set it imperatively as well as via the JSX prop.
    el.muted = true;
    // Restart from the top each time this item becomes the active one in a
    // rotation, so the loop always begins clean rather than mid-clip.
    el.currentTime = 0;
    el.play().catch(() => {
      // Autoplay blocked (iOS Low Power Mode, Android Data Saver, etc).
      // The poster frame remains visible — that's the intended fallback.
    });
  }, [media.url, active]);

  if (media.type === 'video' && !reducedMotion) {
    return (
      <video
        key={media.url}
        ref={videoRef}
        className={className}
        src={media.url}
        poster={media.poster_url}
        autoPlay={active}
        muted
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
        aria-hidden="true"
      />
    );
  }

  // Video with reduced motion preferred, or an image: render a static image.
  const imageSrc = media.type === 'video' ? media.poster_url || media.url : media.url;

  return (
    <img
      key={imageSrc}
      ref={imgRef}
      src={imageSrc}
      alt={alt ?? media.alt ?? ''}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
    />
  );
};

export default SiteMedia;
