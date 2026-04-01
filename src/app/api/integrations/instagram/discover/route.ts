import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accessToken } = await req.json();
  if (!accessToken) return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });

  // 1. Get pages connected to this token
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token`
  );
  const pagesJson = await pagesRes.json();
  if (!pagesRes.ok || pagesJson.error) {
    return NextResponse.json({ error: pagesJson.error?.message ?? "Token inválido" }, { status: 400 });
  }

  const pages: { id: string; name: string; access_token: string }[] = pagesJson.data ?? [];
  if (pages.length === 0) {
    return NextResponse.json({ error: "Nenhuma página do Facebook encontrada para este token." }, { status: 404 });
  }

  // 2. For each page, check if there's a linked Instagram Business Account
  const accounts: { pageId: string; pageName: string; instagramId: string; instagramName: string; pageToken: string }[] = [];

  await Promise.all(
    pages.map(async (page) => {
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
    })
  );

  if (accounts.length === 0) {
    return NextResponse.json({
      error: "Nenhuma conta do Instagram Business vinculada às páginas deste token. Certifique-se que a página do Facebook está conectada ao Instagram Business.",
    }, { status: 404 });
  }

  return NextResponse.json({ accounts });
}
