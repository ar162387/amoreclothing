
import { s3Client } from "@/integrations/supabase/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export const uploadService = {
    async uploadImage(file: File, folder: string = "products"): Promise<string | null> {
        try {
            const fileExt = file.name.split(".").pop();
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
            const filePath = `${folder}/${fileName}`;

            // Convert file to ArrayBuffer to avoid stream reader issues in some browser environments
            const fileBuffer = await file.arrayBuffer();

            const command = new PutObjectCommand({
                Bucket: "products",
                Key: filePath,
                Body: new Uint8Array(fileBuffer), // Send as Uint8Array
                ContentType: file.type,
            });

            await s3Client.send(command);

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const publicUrl = `${supabaseUrl}/storage/v1/object/public/products/${filePath}`;

            return publicUrl;
        } catch (error) {
            console.error("Error uploading file:", error);
            return null;
        }
    },
};
