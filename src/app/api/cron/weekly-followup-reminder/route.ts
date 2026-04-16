// ============================================================
// Weekly Cron – runs every Saturday at 21:00 (BRT ~18:00)
// Checks barbershops with services missing followUpDays
// and emails the owner a reminder to fill it in.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { after } from "next/server";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  after(async () => {
    const start = Date.now();
    const cronRun = await prisma.cronRun.create({ data: { cronName: "weekly-followup-reminder", status: "running" } });

    try {
      // Find all active services missing followUpDays, grouped by barbershop
      const servicesWithout = await prisma.service.findMany({
        where: { followUpDays: null, active: true, deletedAt: null },
        select: { id: true, name: true, barbershopId: true },
      });

      // Group by barbershop
      const byShop = new Map<string, string[]>();
      for (const svc of servicesWithout) {
        const list = byShop.get(svc.barbershopId) ?? [];
        list.push(svc.name);
        byShop.set(svc.barbershopId, list);
      }

      if (byShop.size === 0) {
        await prisma.cronRun.update({ where: { id: cronRun.id }, data: { status: "success", durationMs: Date.now() - start } });
        return;
      }

      // Get owner emails for those barbershops
      const shopIds = [...byShop.keys()];
      const owners = await prisma.membership.findMany({
        where: { barbershopId: { in: shopIds }, role: "OWNER", active: true },
        select: { barbershopId: true, user: { select: { email: true, name: true } }, barbershop: { select: { name: true } } },
      });

      const apiKey = process.env.RESEND_TOKEN_API;
      if (!apiKey) {
        await prisma.cronRun.update({ where: { id: cronRun.id }, data: { status: "failed", durationMs: Date.now() - start, error: "RESEND_TOKEN_API not set" } });
        return;
      }

      let sent = 0;
      let failed = 0;

      for (const owner of owners) {
        const serviceNames = byShop.get(owner.barbershopId) ?? [];
        if (serviceNames.length === 0) continue;

        const ownerName = owner.user.name?.split(" ")[0] ?? "Olá";
        const shopName = owner.barbershop.name;
        const serviceList = serviceNames.map((n) => `<li style="padding:6px 0;color:#f4f4f7;font-size:14px;border-bottom:1px solid #2a2a38;">${n}</li>`).join("");

        const html = buildEmailHtml(ownerName, shopName, serviceList, serviceNames.length);

        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Voltaki <noreply@voltaki.com>",
              to: owner.user.email,
              subject: `${shopName}: ${serviceNames.length} serviço${serviceNames.length > 1 ? "s" : ""} sem tempo de retorno`,
              html,
            }),
          });

          if (res.ok) sent++;
          else failed++;
        } catch {
          failed++;
        }
      }

      await prisma.cronRun.update({
        where: { id: cronRun.id },
        data: {
          status: failed > 0 ? "partial" : "success",
          durationMs: Date.now() - start,
          error: failed > 0 ? `${failed} email(s) failed, ${sent} sent` : null,
        },
      });
    } catch (err) {
      await prisma.cronRun.update({ where: { id: cronRun.id }, data: { status: "failed", durationMs: Date.now() - start, error: String(err) } });
    }
  });

  return NextResponse.json({ date: new Date().toISOString(), accepted: true });
}

function buildEmailHtml(ownerName: string, shopName: string, serviceListHtml: string, count: number) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lembrete — Voltaki</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0f0f14;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#171720;border-radius:12px;border:1px solid #2a2a38;overflow:hidden;">

          <!-- Gold top bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#C9A84C,#e6c96a,#C9A84C);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="padding:40px 40px 32px;">
              <img src="https://voltaki.com/logo-dark.png" alt="Voltaki" width="160" style="display:block;height:auto;" />
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background-color:#2a2a38;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f4f4f7;letter-spacing:-0.3px;">
                Fala ${ownerName}! 👋
              </h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#9090a8;">
                Passando pra lembrar: a <strong style="color:#f4f4f7;">${shopName}</strong> tem <strong style="color:#C9A84C;">${count} serviço${count > 1 ? "s" : ""}</strong> sem o tempo de retorno configurado.
              </p>

              <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#9090a8;text-transform:uppercase;letter-spacing:0.5px;">
                Serviços pendentes:
              </p>
              <ul style="margin:0 0 24px;padding:0;list-style:none;">
                ${serviceListHtml}
              </ul>

              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#9090a8;">
                Com o tempo de retorno preenchido, o <strong style="color:#f4f4f7;">pós-venda</strong> fica muito mais fácil — você vai saber exatamente quando cada cliente deveria voltar e pode fazer o follow-up na hora certa.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:8px;background-color:#C9A84C;">
                    <a href="https://glaucobarber.com/services"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#0f0f14;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">
                      Editar serviços
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#606078;">
                Basta abrir cada serviço e preencher o campo "Retorno (dias)" com o intervalo ideal entre visitas.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 40px;">
              <div style="height:1px;background-color:#2a2a38;margin-bottom:24px;"></div>
              <p style="margin:0;font-size:12px;color:#606078;line-height:1.6;">
                Voltaki · Seu cliente sempre volta<br />
                <a href="https://voltaki.com" style="color:#C9A84C;text-decoration:none;">voltaki.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
