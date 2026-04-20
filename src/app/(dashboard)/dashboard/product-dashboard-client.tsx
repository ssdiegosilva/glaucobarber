"use client";

import Link from "next/link";
import { formatBRL, formatTime } from "@/lib/utils";
import { TrendingUp, TrendingDown, ShoppingBag, Users, BarChart3, DollarSign, MessageCircle, User } from "lucide-react";
import dynamic from "next/dynamic";

const SalesTrendChart = dynamic(() => import("./charts/sales-trend-chart"), { ssr: false });

// ── Types ──────────────────────────────────────────────────────

interface KPIs {
  revenueToday:     number;
  revenueYesterday: number;
  visitsToday:      number;
  visitsYesterday:  number;
  avgTicketToday:   number;
  revenueWeek:      number;
}

interface TopProduct {
  name:     string;
  quantity: number;
  revenue:  number;
}

interface TopCustomer {
  id:         string;
  name:       string;
  visitCount: number;
  totalSpent: number;
  phone:      string | null;
}

interface RecentSale {
  id:            string;
  visitedAt:     string;
  amount:        number | null;
  customerName:  string | null;
  customerPhone: string | null;
  items:         { name: string; quantity: number; price: number }[];
}

interface Props {
  kpis:         KPIs;
  chartData:    { day: string; revenue: number }[];
  topProducts:  TopProduct[];
  topCustomers: TopCustomer[];
  recentSales:  RecentSale[];
  tenantLabel:  string;
}

// ── Helpers ────────────────────────────────────────────────────

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : null;
  return Math.round(((current - previous) / previous) * 100);
}

const MEDAL_COLORS = ["text-amber-400", "text-zinc-400", "text-orange-600"];

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${num}`;
}

// ── Component ──────────────────────────────────────────────────

export function ProductDashboardClient({ kpis, chartData, topProducts, topCustomers, recentSales, tenantLabel }: Props) {
  const revPct   = pctChange(kpis.revenueToday, kpis.revenueYesterday);
  const visitPct = pctChange(kpis.visitsToday, kpis.visitsYesterday);

  const hasAnyData = recentSales.length > 0 || topProducts.length > 0 || chartData.some((d) => d.revenue > 0);

  // ── Global empty state ──
  if (!hasAnyData) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gold-500/10 flex items-center justify-center">
          <ShoppingBag className="h-8 w-8 text-gold-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Nenhuma venda registrada ainda</h2>
          <p className="text-sm text-muted-foreground mt-1">Registre sua primeira venda para ver o dashboard.</p>
        </div>
        <Link
          href="/visitas"
          className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-gold-400 transition-colors"
        >
          <ShoppingBag className="h-4 w-4" />
          Registrar primeira venda
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-8 space-y-6">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Faturamento hoje"
            value={formatBRL(kpis.revenueToday)}
            pct={revPct}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <KpiCard
            label="Vendas hoje"
            value={String(kpis.visitsToday)}
            pct={visitPct}
            icon={<ShoppingBag className="h-4 w-4" />}
          />
          <KpiCard
            label="Ticket médio"
            value={formatBRL(kpis.avgTicketToday)}
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <KpiCard
            label="Faturamento semana"
            value={formatBRL(kpis.revenueWeek)}
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </div>

        {/* ── Sales Trend Chart ── */}
        {chartData.length > 0 && (
          <section className="rounded-xl border border-border/60 bg-surface-800 p-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Vendas — Últimos 7 dias
            </h3>
            <SalesTrendChart data={chartData} />
          </section>
        )}

        {/* ── Two-column: Top Products + Frequent Customers ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Products */}
          <section className="rounded-xl border border-border/60 bg-surface-800 p-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Produtos mais vendidos (30d)
            </h3>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma venda nos últimos 30 dias</p>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3 px-2 py-1.5">
                    <span className={`text-sm font-bold w-5 text-center ${MEDAL_COLORS[i] ?? "text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.quantity} vendido{p.quantity !== 1 ? "s" : ""}</p>
                    </div>
                    <span className="text-sm font-medium text-foreground">{formatBRL(p.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Frequent Customers */}
          <section className="rounded-xl border border-border/60 bg-surface-800 p-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Clientes frequentes (30d)
            </h3>
            {topCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum cliente identificado ainda</p>
            ) : (
              <div className="space-y-2">
                {topCustomers.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-2 py-1.5">
                    <div className="w-7 h-7 rounded-full bg-surface-900 border border-border/60 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-semibold text-foreground">{c.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.visitCount} visita{c.visitCount !== 1 ? "s" : ""} · {formatBRL(c.totalSpent)}</p>
                    </div>
                    {c.phone && (
                      <a
                        href={waLink(c.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-green-500 hover:text-green-400 transition-colors"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Recent Sales ── */}
        <section className="rounded-xl border border-border/60 bg-surface-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vendas de hoje
            </h3>
            <Link
              href="/visitas"
              className="inline-flex items-center gap-1.5 text-[11px] text-gold-400 hover:text-gold-300 transition-colors font-medium"
            >
              <ShoppingBag className="h-3 w-3" />
              Registrar venda
            </Link>
          </div>

          {recentSales.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <p className="text-sm text-muted-foreground">Nenhuma venda hoje.</p>
              <Link
                href="/visitas"
                className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-black hover:bg-gold-400 transition-colors"
              >
                Registrar venda
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 py-2.5">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-surface-900 border border-border/60 flex items-center justify-center shrink-0">
                    {sale.customerName ? (
                      <span className="text-xs font-semibold text-foreground">{sale.customerName.charAt(0).toUpperCase()}</span>
                    ) : (
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{sale.customerName ?? "Anônimo"}</p>
                    {sale.items.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {sale.items.slice(0, 3).map((item, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-900 border border-border/40 text-muted-foreground">
                            {item.quantity > 1 ? `${item.quantity}x ` : ""}{item.name}
                          </span>
                        ))}
                        {sale.items.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{sale.items.length - 3}</span>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Amount + Time */}
                  <div className="text-right shrink-0">
                    {sale.amount != null && (
                      <p className="text-sm font-semibold text-foreground">{formatBRL(sale.amount)}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">{formatTime(sale.visitedAt)}</p>
                  </div>

                  {/* WhatsApp */}
                  {sale.customerPhone && (
                    <a
                      href={waLink(sale.customerPhone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-green-500 hover:text-green-400 transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────

function KpiCard({ label, value, pct, icon }: { label: string; value: string; pct?: number | null; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface-800 p-3.5 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-xl font-bold text-foreground leading-none">{value}</span>
        {pct != null && (
          <span className={`flex items-center gap-0.5 text-[11px] font-medium ${pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {pct >= 0 ? "+" : ""}{pct}%
          </span>
        )}
      </div>
    </div>
  );
}
