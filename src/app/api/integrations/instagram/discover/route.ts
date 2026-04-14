import { NextRequest, NextResponse }    from "next/server";
import { auth }                         from "@/lib/auth";
import { fetchInstagramAccounts }       from "@/lib/integrations/instagram/oauth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.barbershopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accessToken } = await req.json();
  if (!accessToken) return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });

  try {
    const accounts = await fetchInstagramAccounts(accessToken);
    return NextResponse.json({ accounts });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 404 });
  }
}
