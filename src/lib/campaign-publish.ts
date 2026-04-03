/**
 * Shared Instagram publish helpers used by both the manual publish route
 * and the campaigns cron job.
 */

async function waitForMediaReady(containerId: string, token: string, maxWaitMs = 30_000): Promise<void> {
  const interval = 2_000;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const res  = await fetch(`https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${token}`);
    const json = await res.json();
    const status = json.status_code as string | undefined;
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") throw new Error(`Media container status: ${status}`);
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Timeout aguardando processamento da imagem pelo Instagram");
}

export async function publishCampaignToInstagram(
  token:      string,
  businessId: string,
  imageUrl:   string,
  caption:    string,
): Promise<string> {
  const mediaRes  = await fetch(`https://graph.facebook.com/v21.0/${businessId}/media`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({ image_url: imageUrl, caption, access_token: token }),
  });
  const mediaJson = await mediaRes.json();
  if (!mediaRes.ok) throw new Error(mediaJson.error?.message ?? "Erro ao criar media container");

  await waitForMediaReady(mediaJson.id, token);

  const publishRes  = await fetch(`https://graph.facebook.com/v21.0/${businessId}/media_publish`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({ creation_id: mediaJson.id, access_token: token }),
  });
  const publishJson = await publishRes.json();
  if (!publishRes.ok) throw new Error(publishJson.error?.message ?? "Erro ao publicar");
  return publishJson.id as string;
}

export async function fetchInstagramPermalink(postId: string, token: string): Promise<string | null> {
  try {
    const res  = await fetch(`https://graph.facebook.com/v21.0/${postId}?fields=permalink&access_token=${token}`);
    const json = await res.json();
    return json.permalink ?? null;
  } catch {
    return null;
  }
}
