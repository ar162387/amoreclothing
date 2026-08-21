import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * Product-page size guide: separate measurement tables for the shirt and the skirt/trouser half
 * of a set, since a single "Bust/Waist/Hip" table (see SizeGuide.tsx, the general /size-guide
 * page) doesn't cover a two-piece garment. Values match the client-supplied reference charts.
 */

type Garment = 'shirt' | 'bottom';

const SIZES = ['S', 'M', 'L'] as const;

const SHIRT_ROWS: { label: string; values: Record<(typeof SIZES)[number], string> }[] = [
  { label: 'Length', values: { S: '68 cm', M: '70 cm', L: '72 cm' } },
  { label: 'Sleeve Length', values: { S: '61 cm', M: '63 cm', L: '65 cm' } },
  { label: 'Chest/Bust', values: { S: '100 cm', M: '106 cm', L: '112 cm' } },
  { label: 'Shoulder Width', values: { S: '44 cm', M: '46 cm', L: '48 cm' } },
  { label: 'Collar', values: { S: '38 cm', M: '40 cm', L: '42 cm' } },
];

const BOTTOM_ROWS: { label: string; values: Record<(typeof SIZES)[number], string> }[] = [
  { label: 'Length', values: { S: '58 cm', M: '60 cm', L: '62 cm' } },
  { label: 'Waist', values: { S: '68 cm', M: '72 cm', L: '76 cm' } },
  { label: 'Hip', values: { S: '94 cm', M: '98 cm', L: '102 cm' } },
  { label: 'Hem Width', values: { S: '110 cm', M: '114 cm', L: '118 cm' } },
];

const GARMENTS: { key: Garment; label: string; rows: typeof SHIRT_ROWS }[] = [
  { key: 'shirt', label: 'Shirt', rows: SHIRT_ROWS },
  { key: 'bottom', label: 'Skirt / Trouser', rows: BOTTOM_ROWS },
];

const SizeGuideDialog = () => {
  const [garment, setGarment] = useState<Garment>('shirt');
  const active = GARMENTS.find((g) => g.key === garment) ?? GARMENTS[0];

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

        <div className="flex gap-2 mb-2">
          {GARMENTS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGarment(g.key)}
              className={`px-4 py-2 text-xs tracking-widest uppercase border transition-colors ${
                garment === g.key
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border hover:border-foreground'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-foreground font-medium"></TableHead>
                {SIZES.map((size) => (
                  <TableHead key={size} className="text-foreground font-medium text-center">
                    {size}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="text-muted-foreground uppercase text-xs tracking-wide">{row.label}</TableCell>
                  {SIZES.map((size) => (
                    <TableCell key={size} className="text-center font-medium">
                      {row.values[size]}
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
