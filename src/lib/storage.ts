// ============================================================
// Barbershop Storage — Domain-specific wrappers
// ============================================================
// These functions maintain the existing API surface used across
// the app. Internally they delegate to the generic SaaS core.
// ============================================================

import {
  uploadTenantFile,
  uploadTenantFileFromUrl,
  signTenantFile,
  deleteTenantFile,
} from "@/lib/core/storage";

// ── Campaign images ─────────────────────────────────────────

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
  return uploadTenantFile({
    tenantId: barbershopId,
    folder: "campaigns",
    fileId: campaignId,
    buffer,
    contentType,
  });
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
  return uploadTenantFileFromUrl({
    tenantId: barbershopId,
    folder: "campaigns",
    fileId: campaignId,
    sourceUrl,
    fileName,
  });
}

// ── Reference images ────────────────────────────────────────

export async function uploadBarbershopReferenceImage({
  barbershopId,
  fileName,
  buffer,
  contentType,
}: {
  barbershopId: string;
  fileName: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<{ path: string; url: string }> {
  return uploadTenantFile({
    tenantId: barbershopId,
    folder: "reference",
    fileId: `ref-${Date.now()}`,
    buffer,
    contentType,
  });
}

export async function uploadBarbershopReferenceImageFromUrl({
  barbershopId,
  sourceUrl,
  fileName,
}: {
  barbershopId: string;
  sourceUrl: string;
  fileName?: string;
}): Promise<{ path: string; url: string }> {
  return uploadTenantFileFromUrl({
    tenantId: barbershopId,
    folder: "reference",
    fileId: "reference",
    sourceUrl,
    fileName,
  });
}

// ── Shared utilities ────────────────────────────────────────

export async function signCampaignImage(path: string): Promise<string | null> {
  return signTenantFile(path);
}

export async function deleteCampaignImage(imageUrl: string): Promise<void> {
  return deleteTenantFile(imageUrl);
}

// ── Vitrine photos ───────────────────────────────────────────

export async function uploadVitrineFoto({
  barbershopId,
  postId,
  fotoId,
  buffer,
  contentType,
}: {
  barbershopId: string;
  postId: string;
  fotoId: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<{ path: string; url: string }> {
  return uploadTenantFile({
    tenantId: barbershopId,
    folder: "vitrine",
    fileId: `${postId}/${fotoId}`,
    buffer,
    contentType,
  });
}

export async function signVitrineFoto(path: string): Promise<string | null> {
  return signTenantFile(path);
}

export async function deleteVitrineFoto(path: string): Promise<void> {
  return deleteTenantFile(path);
}
