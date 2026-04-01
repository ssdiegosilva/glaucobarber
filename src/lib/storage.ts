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

  const { data } = client.storage.from(bucket).getPublicUrl(key);
  return { path: key, url: data.publicUrl };
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

export async function signCampaignImage(path: string): Promise<string | null> {
  if (!path) return null;
  // Extract storage key from any Supabase URL, or use as-is if it's already a plain key
  const storagePath = extractSupabasePath(path) ?? (path.startsWith("http") ? null : path);
  if (!storagePath) return path; // external URL, return as-is
  const client = getServiceClient();
  const { data } = client.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}

// Extracts the storage key from a Supabase signed or public URL
// e.g. https://<ref>.supabase.co/storage/v1/object/sign/<bucket>/<key>?token=...
//   or https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<key>
function extractSupabasePath(url: string): string | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/[^/]+\/(.+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
