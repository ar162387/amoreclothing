
import { supabase } from "@/integrations/supabase/client";

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
    created_at?: string;
    // Join fields
    collections?: {
        name: string;
    };
}

export interface CreateProductDTO {
    name: string;
    price: number;
    description?: string;
    collection_id?: string;
    image_front?: string;
    image_back?: string;
    images_other?: string[];
    sizes?: string[];
    available?: boolean;
    featured?: boolean;
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
