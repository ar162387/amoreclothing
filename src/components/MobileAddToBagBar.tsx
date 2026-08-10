import { useState } from 'react';

interface MobileAddToBagBarProps {
  productName: string;
  price: string;
  available: boolean;
  sizes: string[];
  selectedSize: string;
  quantity: number;
  /** Sets the shared selectedSize state (same state the inline Size section reads/writes) — this bar
   * never keeps its own independent copy of it. */
  onSelectSize: (size: string) => void;
  /** Adds to cart with an explicit size and opens the cart drawer. */
  onAdd: (size: string) => void;
}

/** Bottom sticky "Add to Bag" bar for the mobile PDP. Must be the last child of a `relative` wrapper
 * that ends where the product content ends (before the page footer) — CSS `sticky bottom-0` then
 * naturally stops sticking once that wrapper's bottom edge scrolls past, instead of floating over
 * unrelated content below. See ProductDetail.tsx.
 *
 * Reads/writes the SAME `selectedSize` state as the inline Size section further down the page — there
 * is only ever one size selection, never two independent pickers to fall out of sync. Tapping "Add to
 * Bag" with no size chosen yet reveals the size row right here (so buying doesn't require scrolling all
 * the way down); picking a size there also updates the inline section's highlighted state, since it's
 * the same state.
 */
const MobileAddToBagBar = ({
  productName,
  price,
  available,
  sizes,
  selectedSize,
  quantity,
  onSelectSize,
  onAdd,
}: MobileAddToBagBarProps) => {
  const [pickingSize, setPickingSize] = useState(false);
  const hasSizes = sizes.length > 0;

  const handleAddClick = () => {
    if (!available) return;
    if (hasSizes && !selectedSize) {
      setPickingSize(true);
      return;
    }
    onAdd(selectedSize);
  };

  const handlePickSize = (size: string) => {
    setPickingSize(false);
    onSelectSize(size);
    onAdd(size);
  };

  const summary = [price, hasSizes && selectedSize ? `Size ${selectedSize}` : null, quantity > 1 ? `Qty ${quantity}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="sticky bottom-0 z-30 border-t border-border bg-background">
      {pickingSize ? (
        <div className="flex items-center gap-3 p-4">
          <span className="shrink-0 text-sm font-medium">Size</span>
          <div className="flex flex-1 gap-2 overflow-x-auto">
            {sizes.map((size) => (
              <button
                key={size}
                onClick={() => handlePickSize(size)}
                className="h-11 w-11 shrink-0 border border-border text-sm transition-colors hover:border-foreground"
              >
                {size}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPickingSize(false)}
            className="shrink-0 text-xs text-muted-foreground underline"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{productName}</p>
            <p className="truncate text-sm text-muted-foreground">{summary}</p>
          </div>
          <button
            onClick={handleAddClick}
            disabled={!available}
            className="shrink-0 bg-foreground px-6 py-3 text-sm tracking-widest uppercase text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {available ? 'Add to Bag' : 'Sold Out'}
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileAddToBagBar;
