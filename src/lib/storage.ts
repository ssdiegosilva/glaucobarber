import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET_CAMPAIGNS ?? "campaign-images";

function getServiceClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase service credentials missing");
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function uploadCampaignImage({
  barbershopId,
  campaignId,
  fileName,
  buffer,
  contentType,
}: {
  barbershopId: string;
  campaignId: string;
  fileName: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<{ path: string; url: string }> {
  const client = getServiceClient();
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "jpg";
  const key = `${barbershopId}/campaigns/${campaignId}-${Date.now()}.${ext}`;

  const { error } = await client.storage.from(bucket).upload(key, buffer, {
    upsert: true,
    cacheControl: "3600",
    contentType: contentType || "image/jpeg",
  });
  if (error) throw new Error(error.message);

  const { data, error: signError } = await client.storage.from(bucket).createSignedUrl(key, 60 * 60 * 24);
  if (signError || !data?.signedUrl) throw new Error(signError?.message || "Não foi possível gerar URL assinada");

  return { path: key, url: data.signedUrl };
}

export async function signCampaignImage(path: string, expiresSeconds = 60 * 60 * 24): Promise<string | null> {
  if (!path || path.startsWith("http")) return path;
  const client = getServiceClient();
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
