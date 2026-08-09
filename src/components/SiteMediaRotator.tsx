import { useEffect, useState } from 'react';
import SiteMedia from '@/components/SiteMedia';
import type { SiteMediaList } from '@/services/siteContent';

interface SiteMediaRotatorProps {
  items: SiteMediaList;
  /** Seconds each item is shown before crossfading to the next. Defaults to 6. */
  intervalSeconds?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
}

const TRANSITION_MS = 1000;

/**
 * Renders a single SiteMedia when there's only one item (byte-identical to
 * rendering <SiteMedia> directly). With more than one item, all layers stay
 * permanently mounted and stacked absolute-inset, crossfading via opacity —
 * this is what makes the CSS transition reliable (no enter-animation timing
 * tricks) and lets inactive videos simply pause instead of unmounting.
 */
const SiteMediaRotator = ({ items, intervalSeconds = 6, className, alt, priority }: SiteMediaRotatorProps) => {
  const list = items.filter((item) => item && item.url);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [list.map((i) => i.url).join('|')]);

  useEffect(() => {
    if (list.length <= 1) return;
    const ms = Math.max(1, intervalSeconds) * 1000;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % list.length);
    }, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length, intervalSeconds]);

  if (list.length === 0) return null;

  if (list.length === 1) {
    return <SiteMedia media={list[0]} className={className} alt={alt} priority={priority} />;
  }

  return (
    // `isolate` gives this wrapper its own stacking context, so the z-10/z-0
    // on the layers below are scoped to this component only. Without it,
    // those z-index values compare against whatever the *caller* renders
    // alongside this component (hero text, tile captions, etc.) and can
    // paint on top of them — exactly the bug this fixes. Applies everywhere
    // this component is used, not just the hero.
    <div className="relative isolate w-full h-full">
      {list.map((item, i) => (
        <div
          key={`${item.url}-${i}`}
          className={`absolute inset-0 transition-opacity ease-in-out ${
            i === index ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
          style={{ transitionDuration: `${TRANSITION_MS}ms` }}
        >
          <SiteMedia media={item} className={className} alt={alt} priority={priority && i === 0} active={i === index} />
        </div>
      ))}
    </div>
  );
};

export default SiteMediaRotator;
