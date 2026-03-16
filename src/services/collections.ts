
import { supabase } from "@/integrations/supabase/client";

export interface Collection {
    id: string;
    name: string;
    season: string;
    description: string | null;
    created_at?: string;
    product_count?: number; // Count of products in this collection
}

export interface CreateCollectionDTO {
    name: string;
    season: string;
    description?: string;
}

export interface UpdateCollectionDTO {
    name?: string;
    season?: string;
    description?: string;
}

export const collectionsService = {
    async getCollections() {
        const { data: collections, error: collectionsError } = await supabase
            .from("collections")
            .select("*")
            .order("created_at", { ascending: false });

        if (collectionsError || !collections) {
            return { data: null, error: collectionsError };
        }

        // Get product counts for each collection
        const collectionIds = collections.map((c) => c.id);
        const { data: productsData, error: productsError } = await supabase
            .from("products")
            .select("collection_id")
            .in("collection_id", collectionIds);

        if (productsError) {
            return { data: collections.map((c) => ({ ...c, product_count: 0 })), error: null };
        }

        // Count products per collection
        const productCounts = productsData?.reduce((acc, product) => {
            if (product.collection_id) {
                acc[product.collection_id] = (acc[product.collection_id] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>) || {};

        const collectionsWithCounts = collections.map((collection) => ({
            ...collection,
            product_count: productCounts[collection.id] || 0,
        }));

        return { data: collectionsWithCounts, error: null };
    },

    async createCollection(data: CreateCollectionDTO) {
        return await supabase.from("collections").insert(data).select().single();
    },

    async updateCollection(id: string, data: UpdateCollectionDTO) {
        return await supabase
            .from("collections")
            .update(data)
            .eq("id", id)
            .select()
            .single();
    },

    async deleteCollection(id: string) {
        return await supabase.from("collections").delete().eq("id", id);
    },
};
