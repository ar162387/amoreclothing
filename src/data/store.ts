// Store data - Frontend-only mock data for Amore

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  category: string;
  collection: string;
  sizes: string[];
  colors: string[];
  images: string[];
  inStock: boolean;
  featured: boolean;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  image: string;
  season: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: { productId: string; quantity: number; size: string; color: string }[];
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  shippingAddress: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  size: string;
  color: string;
}

// Mock Products
export const products: Product[] = [
  {
    id: '1',
    name: 'Silk Ruffle Blouse',
    price: 12500,
    description: 'Elegant cream silk blouse with delicate ruffle sleeves. Perfect for both formal occasions and sophisticated casual wear.',
    category: 'Tops',
    collection: 'essentials',
    sizes: ['XS', 'S', 'M', 'L'],
    colors: ['Cream', 'White'],
    images: ['product-1'],
    inStock: true,
    featured: true,
  },
  {
    id: '2',
    name: 'Tailored Wool Blazer',
    price: 24500,
    description: 'Impeccably tailored black wool blazer. A timeless investment piece that elevates any ensemble.',
    category: 'Outerwear',
    collection: 'essentials',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: ['Black', 'Navy'],
    images: ['product-2'],
    inStock: true,
    featured: true,
  },
  {
    id: '3',
    name: 'Wide-Leg Linen Trousers',
    price: 15800,
    description: 'Relaxed beige linen trousers with a sophisticated wide-leg silhouette. Effortlessly chic for any occasion.',
    category: 'Bottoms',
    collection: 'essentials',
    sizes: ['XS', 'S', 'M', 'L'],
    colors: ['Beige', 'White'],
    images: ['product-3'],
    inStock: true,
    featured: false,
  },
  {
    id: '4',
    name: 'Midi Wrap Dress',
    price: 18900,
    description: 'Graceful white midi wrap dress with flutter sleeves. The perfect balance of femininity and modern elegance.',
    category: 'Dresses',
    collection: 'essentials',
    sizes: ['XS', 'S', 'M', 'L'],
    colors: ['White', 'Blush'],
    images: ['product-4'],
    inStock: true,
    featured: true,
  },
  {
    id: '5',
    name: 'Cashmere Crewneck',
    price: 19500,
    description: 'Luxuriously soft camel cashmere sweater. An essential piece for refined comfort.',
    category: 'Knitwear',
    collection: 'essentials',
    sizes: ['S', 'M', 'L'],
    colors: ['Camel', 'Grey'],
    images: ['product-5'],
    inStock: true,
    featured: false,
  },
  {
    id: '6',
    name: 'Pleated Wool Skirt',
    price: 14500,
    description: 'Elegant grey wool pleated midi skirt. Timeless sophistication for the modern woman.',
    category: 'Bottoms',
    collection: 'essentials',
    sizes: ['XS', 'S', 'M', 'L'],
    colors: ['Grey', 'Black'],
    images: ['product-6'],
    inStock: true,
    featured: false,
  },
  {
    id: '7',
    name: 'Silk Evening Top',
    price: 11800,
    description: 'Stunning navy blue silk top with tie detail. Perfect for evening occasions.',
    category: 'Tops',
    collection: 'essentials',
    sizes: ['XS', 'S', 'M', 'L'],
    colors: ['Navy', 'Black'],
    images: ['product-7'],
    inStock: true,
    featured: true,
  },
];

export const collections: Collection[] = [
  {
    id: 'essentials',
    name: 'The Essentials',
    description: 'Timeless pieces crafted for the modern woman. Our debut collection celebrates understated luxury and effortless elegance.',
    image: 'collection-summer',
    season: 'All Seasons',
  },
];

// Mock Orders
export const orders: Order[] = [
  {
    id: 'ORD-001',
    customerName: 'Sarah Ahmed',
    customerEmail: 'sarah@example.com',
    customerPhone: '+92 300 1234567',
    items: [{ productId: '1', quantity: 1, size: 'M', color: 'Cream' }],
    total: 12500,
    status: 'confirmed',
    createdAt: '2025-01-03',
    shippingAddress: 'DHA Phase 5, Lahore',
  },
  {
    id: 'ORD-002',
    customerName: 'Fatima Khan',
    customerEmail: 'fatima@example.com',
    customerPhone: '+92 321 9876543',
    items: [
      { productId: '2', quantity: 1, size: 'S', color: 'Black' },
      { productId: '4', quantity: 1, size: 'S', color: 'White' },
    ],
    total: 43400,
    status: 'pending',
    createdAt: '2025-01-04',
    shippingAddress: 'Gulberg III, Lahore',
  },
];

// Size Guide Data
export const sizeGuide = {
  measurements: [
    { size: 'XXS', bust: '76-80', waist: '56-60', hip: '82-86' },
    { size: 'XS', bust: '80-84', waist: '60-64', hip: '86-90' },
    { size: 'S', bust: '84-88', waist: '64-68', hip: '90-94' },
    { size: 'M', bust: '88-92', waist: '68-72', hip: '94-98' },
    { size: 'L', bust: '92-96', waist: '72-76', hip: '98-102' },
    { size: 'XL', bust: '96-100', waist: '76-80', hip: '102-106' },
    { size: 'XXL', bust: '100-104', waist: '80-84', hip: '106-110' },
  ],
  tips: [
    'All measurements are in centimeters.',
    'Measure yourself without clothes or with light undergarments.',
    'If between sizes, we recommend sizing up for a more comfortable fit.',
    'Our pieces are designed with a relaxed, elegant fit.',
  ],
};

// Format price in PKR
export const formatPrice = (price: number): string => {
  return `PKR ${price.toLocaleString()}`;
};
