
import { supabase } from "@/integrations/supabase/client";

/** One measurement row within a size guide head, e.g. "Length" with a value per size letter.
 * `values` only needs keys for sizes the product actually has selected — the admin form enforces
 * that every currently-selected size has an entry before it lets you save. */
export interface SizeGuideRow {
    id: string;
    label: string;
    values: Record<string, string>;
}

/** One garment section of a product's size guide, e.g. "Shirt" or "Skirt / Trouser". A product can
 * have any number of heads, each with any number of rows — fully admin-defined per product. */
export interface SizeGuideHead {
    id: string;
    label: string;
    rows: SizeGuideRow[];
}

export type SizeGuide = SizeGuideHead[];

export interface Product {
    id: string;
    name: string;
    price: number;
    description: string | null;
    collection_id: string | null;
    image_front: string | null;
    image_back: string | null;
    images_other: string[] | null;
    sizes: string[] | null; // Available sizes
    available: boolean;
    featured: boolean;
    size_guide: SizeGuide;
    fabric_care_id: string | null;
    created_at?: string;
    // Join fields
    collections?: {
        name: string;
    };
    fabric_care?: {
        title: string;
        body: string;
    } | null;
}

export interface CreateProductDTO {
    name: string;
    price: number;
    description?: string;
    collection_id?: string | null;
    image_front?: string;
    image_back?: string;
    images_other?: string[];
    sizes?: string[];
    available?: boolean;
    featured?: boolean;
    size_guide?: SizeGuide;
    fabric_care_id?: string | null;
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> { }

export const productsService = {
    async getProducts() {
        return await supabase
            .from("products")
            .select(`
        *,
        collections (
          name
        ),
        fabric_care (
          title,
          body
        )
      `)
            .order("created_at", { ascending: false });
    },

    async getProductById(id: string) {
        return await supabase
            .from("products")
            .select(`
                *,
                collections (
                    name
                ),
                fabric_care (
                    title,
                    body
                )
            `)
            .eq("id", id)
            .single();
    },

    async createProduct(data: CreateProductDTO) {
        return await supabase
            .from("products")
            .insert(data)
            .select(`
                *,
                collections (
                    name
                )
            `)
            .single();
    },

    async updateProduct(id: string, data: UpdateProductDTO) {
        return await supabase
            .from("products")
            .update(data)
            .eq("id", id)
            .select(`
                *,
                collections (
                    name
                )
            `)
            .single();
    },

    async deleteProduct(id: string) {
        return await supabase.from("products").delete().eq("id", id);
    },
};
