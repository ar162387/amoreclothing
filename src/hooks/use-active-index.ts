import { useEffect, useRef, useState } from 'react';

/**
 * Tracks which item (by index) is most visible inside a scroll container, via IntersectionObserver.
 * Used to keep a thumbnail rail's "active" highlight in sync with a vertically-scrolling image list —
 * see ProductFullscreenViewer. Images can be much taller than the viewport (full-width, natural aspect
 * ratio, no forced height), so this keeps a running ratio per item across callback batches — a single
 * IntersectionObserver callback only reports entries whose ratio just changed, not every observed
 * element, so picking the "best" from one batch alone would flicker between items.
 */
export function useActiveIndex(
  containerRef: React.RefObject<HTMLElement>,
  itemRefs: React.RefObject<(HTMLElement | null)[]>,
  itemCount: number,
) {
  const [activeIndex, setActiveIndex] = useState(0);
  const ratiosRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    const items = itemRefs.current;
    if (!container || !items || itemCount === 0) return;

    ratiosRef.current = new Map();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = items.indexOf(entry.target as HTMLElement);
          if (index === -1) return;
          ratiosRef.current.set(index, entry.isIntersecting ? entry.intersectionRatio : 0);
        });

        let bestIndex = -1;
        let bestRatio = 0;
        ratiosRef.current.forEach((ratio, index) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestIndex = index;
          }
        });
        if (bestIndex !== -1) setActiveIndex(bestIndex);
      },
      { root: container, threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
    );

    items.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [containerRef, itemRefs, itemCount]);

  return activeIndex;
}
