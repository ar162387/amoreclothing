/** Human-readable product routes stay unique and remain valid when names collide. */
export function productPath(product: { id: string; name: string }): string {
  const name = product.name
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product';

  return `/product/${name}-${product.id}`;
}

/** Supports both new named routes and legacy UUID-only product links. */
export function productIdFromRoute(value: string): string | null {
  const match = value.match(/(?:^|-)([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i);
  return match?.[1] ?? null;
}
