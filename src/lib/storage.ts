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
  expiresSeconds = 60 * 60 * 24 * 365, // 1 ano para evitar expiração curta
}: {
  barbershopId: string;
  campaignId: string;
  fileName: string;
  buffer: Buffer;
  contentType?: string;
  expiresSeconds?: number;
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

  const { data, error: signError } = await client.storage.from(bucket).createSignedUrl(key, expiresSeconds);
  if (signError || !data?.signedUrl) throw new Error(signError?.message || "Não foi possível gerar URL assinada");

  return { path: key, url: data.signedUrl };
}

export async function uploadCampaignImageFromUrl({
  barbershopId,
  campaignId,
  sourceUrl,
  fileName,
}: {
  barbershopId: string;
  campaignId: string;
  sourceUrl: string;
  fileName?: string;
}): Promise<{ path: string; url: string }> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error("Não foi possível baixar a imagem gerada");

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());

  const mimeExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extFromMime = mimeExt[contentType];
  const urlExt = sourceUrl.split(".").pop()?.split(/[#?]/)[0];
  const ext = extFromMime || urlExt || "jpg";

  return uploadCampaignImage({
    barbershopId,
    campaignId,
    fileName: fileName ?? `${campaignId}.${ext}`,
    buffer,
    contentType,
  });
}

export async function signCampaignImage(path: string, expiresSeconds = 60 * 60 * 24): Promise<string | null> {
  if (!path || path.startsWith("http")) return path;
  const client = getServiceClient();
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
