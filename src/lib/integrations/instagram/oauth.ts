import { createHmac, randomBytes, timingSafeEqual } from "crypto";

function secret() {
  const s = process.env.INSTAGRAM_APP_SECRET;
  if (!s) throw new Error("INSTAGRAM_APP_SECRET not set");
  return s;
}

export function signHmac(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function verifyHmac(value: string, sig: string): boolean {
  const expected = Buffer.from(signHmac(value));
  const received = Buffer.from(sig);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/** Generates a signed state param: `barbershopId:nonce:hmac` */
export function generateState(barbershopId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const value = `${barbershopId}:${nonce}`;
  return `${value}:${signHmac(value)}`;
}

/** Parses and verifies a state param. Returns barbershopId or null. */
export function parseState(state: string): { barbershopId: string } | null {
  const lastColon = state.lastIndexOf(":");
  if (lastColon === -1) return null;
  const value = state.slice(0, lastColon);
  const sig   = state.slice(lastColon + 1);
  if (!verifyHmac(value, sig)) return null;
  const barbershopId = value.split(":")[0];
  if (!barbershopId) return null;
  return { barbershopId };
}

export type IgAccount = {
  pageId:        string;
  pageName:      string;
  instagramId:   string;
  instagramName: string;
  pageToken:     string;
};

/** Fetches all Instagram Business accounts linked to a user token via Facebook pages. */
export async function fetchInstagramAccounts(userToken: string): Promise<IgAccount[]> {
  const pages: { id: string; name: string; access_token: string }[] = [];
  let url: string | null =
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${userToken}&fields=id,name,access_token&limit=100`;

  while (url) {
    const res: Response = await fetch(url);
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error?.message ?? "Token inválido ou sem permissão pages_show_list");
    pages.push(...(json.data ?? []));
    url = json.paging?.next ?? null;
  }

  if (pages.length === 0) {
    throw new Error("Nenhuma página do Facebook encontrada. Certifique-se de ter ao menos uma página administrada.");
  }

  const accounts: IgAccount[] = [];
  await Promise.all(
    pages.map(async (page) => {
      try {
        const igRes  = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,name,username}&access_token=${page.access_token}`
        );
        const igJson = await igRes.json();
        const igAcc  = igJson.instagram_business_account;
        if (igAcc?.id) {
          accounts.push({
            pageId:        page.id,
            pageName:      page.name,
            instagramId:   igAcc.id,
            instagramName: igAcc.username ?? igAcc.name ?? igAcc.id,
            pageToken:     page.access_token,
          });
        }
      } catch {
        // skip pages that fail individually
      }
    })
  );

  if (accounts.length === 0) {
    const pageNames = pages.map((p) => `"${p.name}"`).join(", ");
    throw new Error(
      `Nenhuma conta Instagram Business encontrada. ` +
      `${pages.length} página(s) do Facebook verificada(s): ${pageNames}. ` +
      `Acesse as configurações da página no Facebook → Instagram → "Conectar conta" e certifique-se de que sua conta Instagram é do tipo Business ou Creator.`
    );
  }

  return accounts;
}
