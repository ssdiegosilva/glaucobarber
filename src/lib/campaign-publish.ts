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

/**
 * Publishes a carousel post (2–10 images) to Instagram.
 * Flow: create N item containers → create carousel container → publish.
 */
export async function publishCarouselToInstagram(
  token:      string,
  businessId: string,
  imageUrls:  string[],   // 2–3 signed URLs
  caption:    string,
): Promise<string> {
  if (imageUrls.length < 2) throw new Error("Carrossel requer ao menos 2 imagens");

  // Step 1: create one media container per image (is_carousel_item=true)
  const itemIds: string[] = [];
  for (const imageUrl of imageUrls) {
    const res  = await fetch(`https://graph.facebook.com/v21.0/${businessId}/media`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({ image_url: imageUrl, is_carousel_item: "true", access_token: token }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? "Erro ao criar item do carrossel");
    await waitForMediaReady(json.id, token);
    itemIds.push(json.id as string);
  }

  // Step 2: create carousel container
  const carouselRes  = await fetch(`https://graph.facebook.com/v21.0/${businessId}/media`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      media_type:   "CAROUSEL",
      children:     itemIds.join(","),
      caption,
      access_token: token,
    }),
  });
  const carouselJson = await carouselRes.json();
  if (!carouselRes.ok) throw new Error(carouselJson.error?.message ?? "Erro ao criar container carrossel");
  await waitForMediaReady(carouselJson.id, token);

  // Step 3: publish
  const publishRes  = await fetch(`https://graph.facebook.com/v21.0/${businessId}/media_publish`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({ creation_id: carouselJson.id, access_token: token }),
  });
  const publishJson = await publishRes.json();
  if (!publishRes.ok) throw new Error(publishJson.error?.message ?? "Erro ao publicar carrossel");
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
