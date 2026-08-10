/**
 * Pure pricing/shipping math shared by the client (Checkout.tsx, CartDrawer.tsx) and the
 * server (api/orders/create.ts, server/paymentApi.ts).
 *
 * Hard rule for every file in src/shared/: no `@/` VALUE imports (type-only `@/` imports are
 * fine — esbuild erases them before resolution, see src/lib/seo.ts), no `import.meta.env`, no
 * `process.env`, no Vite asset imports. Pure constants and pure functions only. This is what
 * lets api/*.ts import these via a relative path (`../src/shared/pricing`) even though `@/` does
 * not resolve there, and it's why this directory sits under `src/` — tsconfig.app.json includes
 * `["src"]`, so, unlike api/ itself, this file IS typechecked by `tsc`/`npm run lint`.
 */

export const CURRENCY = "PKR";
export const FREE_SHIPPING_THRESHOLD = 15000;
export const FLAT_SHIPPING_COST = 500;

/** How many PKR "cents" (paisa) make up one rupee — the single choke point for the
 * lowest-denomination amount Safepay's API expects. If sandbox recon (plan Step 0) reveals
 * Safepay actually wants whole rupees for PKR, this is the only constant that changes. */
export const MINOR_UNIT_FACTOR = 100;

export interface PriceLine {
  price: number;
  quantity: number;
}

export function calcSubtotal(lines: PriceLine[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

export function calcShipping(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_COST;
}

export interface Totals {
  subtotal: number;
  shipping: number;
  total: number;
}

export function calcTotals(lines: PriceLine[]): Totals {
  const subtotal = calcSubtotal(lines);
  const shipping = calcShipping(subtotal);
  return { subtotal, shipping, total: subtotal + shipping };
}

/** PKR -> minor units (paisa), the integer Safepay's create-session API expects.
 * Uses Math.round rather than truncation because floating point makes e.g. 19.99*100
 * evaluate to 1998.9999999999998, not 1999. */
export function toMinorUnits(amountPkr: number): number {
  return Math.round(amountPkr * MINOR_UNIT_FACTOR);
}

export function fromMinorUnits(amountMinor: number): number {
  return amountMinor / MINOR_UNIT_FACTOR;
}
