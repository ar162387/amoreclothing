/** Converts merchant-entered names/slugs to the only public URL format we accept. */
export function slugifyProductName(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Slugs are persisted so renaming a product never silently changes its canonical URL. */
export function productPath(product: { slug?: string | null; name: string }): string {
  const slug = slugifyProductName(product.slug || product.name) || 'product';
  return `/product/${slug}`;
}

/** Supports both new named routes and legacy UUID-only product links. */
export function productIdFromRoute(value: string): string | null {
  const match = value.match(/(?:^|-)([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i);
  return match?.[1] ?? null;
}
