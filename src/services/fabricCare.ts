import { supabase } from "@/integrations/supabase/client";

export interface FabricCare {
    id: string;
    title: string;
    body: string;
    created_at?: string;
}

export interface CreateFabricCareDTO {
    title: string;
    body: string;
}

export type UpdateFabricCareDTO = Partial<CreateFabricCareDTO>;

export const fabricCareService = {
    async getAll() {
        return await supabase.from("fabric_care").select("*").order("title");
    },

    async create(data: CreateFabricCareDTO) {
        return await supabase.from("fabric_care").insert(data).select().single();
    },

    async update(id: string, data: UpdateFabricCareDTO) {
        return await supabase.from("fabric_care").update(data).eq("id", id).select().single();
    },

    async remove(id: string) {
        return await supabase.from("fabric_care").delete().eq("id", id);
    },
};
