import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type FbPage = { id: string; name: string; access_token: string };

async function fetchAllPages(accessToken: string): Promise<FbPage[]> {
  const pages: FbPage[] = [];
  let url: string | null =
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token&limit=100`;

  while (url) {
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error?.message ?? "Token inválido");
    pages.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }
  return pages;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accessToken } = await req.json();
  if (!accessToken) return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });

  let pages: FbPage[];
  try {
    pages = await fetchAllPages(accessToken);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }

  if (pages.length === 0) {
    return NextResponse.json({
      error: "Nenhuma página do Facebook encontrada. O token precisa ter permissão pages_show_list.",
    }, { status: 404 });
  }

  const accounts: { pageId: string; pageName: string; instagramId: string; instagramName: string; pageToken: string }[] = [];

  await Promise.all(
    pages.map(async (page) => {
      try {
        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,name,username}&access_token=${page.access_token}`
        );
        const igJson = await igRes.json();
        const igAccount = igJson.instagram_business_account;
        if (igAccount?.id) {
          accounts.push({
            pageId:        page.id,
            pageName:      page.name,
            instagramId:   igAccount.id,
            instagramName: igAccount.username ?? igAccount.name ?? igAccount.id,
            pageToken:     page.access_token,
          });
        }
      } catch {
        // skip pages that fail individually
      }
    })
  );

  if (accounts.length === 0) {
    return NextResponse.json({
      error: `Encontrei ${pages.length} página(s) do Facebook mas nenhuma tem Instagram Business vinculado. Certifique-se que a página está conectada ao Instagram Business nas configurações do Facebook.`,
    }, { status: 404 });
  }

  return NextResponse.json({ accounts });
}
