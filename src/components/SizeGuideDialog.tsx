import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { SizeGuide } from '@/services/products';

/**
 * Product-page size guide, fully admin-defined per product (see AdminProducts.tsx's Size Guide
 * editor): any number of heads (e.g. Shirt, Skirt / Trouser), each with any number of rows,
 * each holding a value per size. Columns are limited to the product's currently-available sizes.
 */

interface SizeGuideDialogProps {
  sizeGuide: SizeGuide;
  sizes: string[];
}

const SizeGuideDialog = ({ sizeGuide, sizes }: SizeGuideDialogProps) => {
  const heads = sizeGuide.filter((h) => h.label && h.rows.length > 0);
  const [activeId, setActiveId] = useState(heads[0]?.id);
  const active = heads.find((h) => h.id === activeId) ?? heads[0];

  if (heads.length === 0 || sizes.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="text-xs underline text-muted-foreground hover:text-foreground transition-colors">
          Size Guide
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-light">Size Guide</DialogTitle>
        </DialogHeader>

        {heads.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {heads.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setActiveId(h.id)}
                className={`px-4 py-2 text-xs tracking-widest uppercase border transition-colors ${
                  active?.id === h.id
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border hover:border-foreground'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-foreground font-medium"></TableHead>
                {sizes.map((size) => (
                  <TableHead key={size} className="text-foreground font-medium text-center">
                    {size}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {active?.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground uppercase text-xs tracking-wide">{row.label}</TableCell>
                  {sizes.map((size) => (
                    <TableCell key={size} className="text-center font-medium">
                      {row.values[size] || '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">Measurements are garment measurements, not body measurements.</p>
      </DialogContent>
    </Dialog>
  );
};

export default SizeGuideDialog;
