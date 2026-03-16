
import { S3Client } from "@aws-sdk/client-s3";

const s3Endpoint = import.meta.env.VITE_SUPABASE_S3_ENDPOINT;
const s3KeyId = import.meta.env.VITE_SUPABASE_S3_KEY_ID;
const s3SecretKey = import.meta.env.VITE_SUPABASE_S3_SECRET_KEY;

if (!s3Endpoint || !s3KeyId || !s3SecretKey) {
    console.warn("Supabase S3 environment variables are missing.");
}

export const s3Client = new S3Client({
    forcePathStyle: true,
    region: "ap-southeast-2", // Supabase S3 compatibility typically uses us-east-1 for signature verification
    endpoint: s3Endpoint,
    credentials: {
        accessKeyId: s3KeyId,
        secretAccessKey: s3SecretKey,
    },
});
