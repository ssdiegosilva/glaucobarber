// ============================================================
// Generic Tenant Storage — SaaS Core
// ============================================================
// Wraps Supabase Storage with tenant-isolated paths.
// Domain-specific modules (barbershop/storage.ts) can build
// on top of these generic functions.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { getVerticalConfig } from "./vertical";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getServiceClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase service credentials missing");
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET_CAMPAIGNS ?? getVerticalConfig().storage.bucketName;
}

// ── Generic upload ──────────────────────────────────────────

export async function uploadTenantFile({
  tenantId,
  folder,
  fileId,
  buffer,
  contentType,
}: {
  tenantId: string;
  folder: string;
  fileId: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<{ path: string; url: string }> {
  const client = getServiceClient();
  const bucket = getBucket();
  const ext = fileId.includes(".") ? fileId.split(".").pop() : "jpg";
  const key = `${tenantId}/${folder}/${fileId}-${Date.now()}.${ext}`;

  const { error } = await client.storage.from(bucket).upload(key, buffer, {
    upsert: true,
    cacheControl: "3600",
    contentType: contentType || "image/jpeg",
  });
  if (error) throw new Error(error.message);

  const { data } = client.storage.from(bucket).getPublicUrl(key);
  return { path: key, url: data.publicUrl };
}

// ── Generic upload from URL ─────────────────────────────────

export async function uploadTenantFileFromUrl({
  tenantId,
  folder,
  fileId,
  sourceUrl,
  fileName,
}: {
  tenantId: string;
  folder: string;
  fileId: string;
  sourceUrl: string;
  fileName?: string;
}): Promise<{ path: string; url: string }> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error("Não foi possível baixar o arquivo");

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

  return uploadTenantFile({
    tenantId,
    folder,
    fileId: fileName ?? `${fileId}.${ext}`,
    buffer,
    contentType,
  });
}

// ── Get public URL ──────────────────────────────────────────

export async function signTenantFile(path: string): Promise<string | null> {
  if (!path) return null;
  const storagePath = extractSupabasePath(path) ?? (path.startsWith("http") ? null : path);
  if (!storagePath) return path; // external URL, return as-is
  const client = getServiceClient();
  const { data } = client.storage.from(getBucket()).getPublicUrl(storagePath);
  return data.publicUrl;
}

// ── Delete ──────────────────────────────────────────────────

export async function deleteTenantFile(fileUrl: string): Promise<void> {
  const path = extractSupabasePath(fileUrl) ?? (fileUrl.startsWith("http") ? null : fileUrl);
  if (!path) return;
  const client = getServiceClient();
  await client.storage.from(getBucket()).remove([path]);
}

// ── Utils ───────────────────────────────────────────────────

function extractSupabasePath(url: string): string | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/[^/]+\/(.+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
