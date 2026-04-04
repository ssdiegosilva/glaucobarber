"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, relativeTime, getInitials } from "@/lib/utils";
import { Users, Star, Clock, Plus, Pencil, Loader2, Trash2 } from "lucide-react";
import { CustomerDrawer, type CustomerRow } from "./customer-drawer";

const STATUS_LABEL   = { ACTIVE: "Ativo", INACTIVE: "Inativo", VIP: "VIP", BLOCKED: "Bloqueado" };
const STATUS_VARIANT = { ACTIVE: "success", INACTIVE: "warning", VIP: "default", BLOCKED: "destructive" } as const;

const PS_LABEL:   Record<string, string> = { RECENTE: "Recente", EM_RISCO: "Em risco", INATIVO: "Inativo", REATIVADO: "Reativado", NAO_CONTATAR: "Não contatar" };
const PS_VARIANT: Record<string, string> = { RECENTE: "success", EM_RISCO: "warning", INATIVO: "destructive", REATIVADO: "default", NAO_CONTATAR: "outline" };

interface Customer {
  id:             string;
  name:           string;
  phone:          string | null;
  email:          string | null;
  notes:          string | null;
  status:         string;
  postSaleStatus: string | null;
  doNotContact:   boolean;
  tags:           string[];
  totalVisits:    number;
  totalSpent:     number;
  lastVisitAt:    string | null;
}

interface Props {
  customers:      Customer[];
  total:          number;
  page:           number;
  totalPages:     number;
  q?:             string;
  vipCount:       number;
  inactiveCount:  number;
  vipFilter?:     boolean;
}

export function ClientsClient({ customers: initial, total, page, totalPages, q, vipCount: initialVipCount, inactiveCount, vipFilter = false }: Props) {
  const [customers, setCustomers]     = useState(initial);
  const [vipCount, setVipCount]       = useState(initialVipCount);
  const [togglingVip, setTogglingVip] = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [drawerMode, setDrawerMode]   = useState<"create" | "edit">("create");
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<CustomerRow | null>(null);

  const skip = (page - 1) * 100;

  function openCreate() {
    setDrawerMode("create");
    setEditTarget(null);
    setDrawerOpen(true);
  }

  function openEdit(c: Customer) {
    setDrawerMode("edit");
    setEditTarget({ id: c.id, name: c.name, phone: c.phone, email: c.email, notes: c.notes, doNotContact: c.doNotContact, tags: c.tags });
    setDrawerOpen(true);
  }

  async function toggleVip(c: Customer) {
    setTogglingVip(c.id);
    const newStatus = c.status === "VIP" ? "ACTIVE" : "VIP";
    try {
      const res = await fetch(`/api/customers/${c.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) return;
      if (vipFilter && newStatus !== "VIP") {
        setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      } else {
        setCustomers((prev) => {
          const updated = prev.map((x) => x.id === c.id ? { ...x, status: newStatus } : x);
          return [...updated].sort((a, b) => {
            if (a.status === "VIP" && b.status !== "VIP") return -1;
            if (b.status === "VIP" && a.status !== "VIP") return 1;
            return 0;
          });
        });
      }
      setVipCount((prev) => newStatus === "VIP" ? prev + 1 : Math.max(prev - 1, 0));
    } finally {
      setTogglingVip(null);
    }
  }

  async function deleteCustomer(c: Customer) {
    if (!confirm(`Excluir "${c.name}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(c.id);
    try {
      const res = await fetch(`/api/customers/${c.id}`, { method: "DELETE" });
      if (!res.ok) return;
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      if (c.status === "VIP") setVipCount((prev) => Math.max(prev - 1, 0));
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(updated: CustomerRow) {
    if (drawerMode === "create") {
      // Add to top of list (it's a new customer with no visits yet)
      setCustomers((prev) => [{
        ...updated,
        status: "ACTIVE", postSaleStatus: null, totalVisits: 0, totalSpent: 0, lastVisitAt: null,
      } as Customer, ...prev]);
    } else {
      setCustomers((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c));
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Total"    value={total} />
        <StatCard
          icon={<Star className="h-4 w-4" />}
          label="VIP"
          value={vipCount}
          href={vipFilter ? `?${q ? `q=${q}` : ""}` : `?vip=1${q ? `&q=${q}` : ""}`}
          active={vipFilter}
          valueClass={vipFilter ? "text-yellow-400" : "text-foreground"}
        />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Inativos" value={inactiveCount} valueClass="text-yellow-400" />
      </div>

      {/* Search + New */}
      <div className="flex items-center gap-3 flex-wrap">
        <form method="GET" className="flex-1">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome..."
            className="w-full max-w-sm rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </form>
        <Button size="sm" onClick={openCreate} className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Novo cliente
        </Button>
      </div>

      {/* ── Mobile card list (hidden on md+) ──────────────── */}
      <div className="md:hidden space-y-2">
        {customers.map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500/15 border border-gold-500/20 text-xs font-bold text-gold-400 shrink-0">
              {getInitials(c.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground truncate text-sm">{c.name}</p>
                {c.status === "VIP" && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {c.postSaleStatus ? (
                  <span className="text-[11px] text-muted-foreground">{PS_LABEL[c.postSaleStatus] ?? c.postSaleStatus}</span>
                ) : null}
                {c.lastVisitAt && (
                  <span className="text-[11px] text-muted-foreground">{relativeTime(c.lastVisitAt)}</span>
                )}
                {c.phone && <span className="text-[11px] text-muted-foreground">{c.phone}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => toggleVip(c)}
                disabled={togglingVip === c.id}
                className={`rounded p-1.5 ${c.status === "VIP" ? "text-yellow-400" : "text-muted-foreground"}`}
              >
                {togglingVip === c.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Star className={`h-4 w-4 ${c.status === "VIP" ? "fill-yellow-400" : ""}`} />}
              </button>
              <button
                onClick={() => openEdit(c)}
                className="rounded p-1.5 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => deleteCustomer(c)}
                disabled={deletingId === c.id}
                className="rounded p-1.5 text-muted-foreground hover:text-destructive"
              >
                {deletingId === c.id
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination mobile */}
      {totalPages > 1 && (
        <div className="md:hidden flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {skip + 1}–{Math.min(skip + 100, total)} de {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={`?page=${page - 1}${q ? `&q=${q}` : ""}${vipFilter ? "&vip=1" : ""}`}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-800 transition-colors">
                Anterior
              </a>
            )}
            {page < totalPages && (
              <a href={`?page=${page + 1}${q ? `&q=${q}` : ""}${vipFilter ? "&vip=1" : ""}`}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-800 transition-colors">
                Próxima
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Desktop table (hidden on mobile) ──────────────── */}
      <div className="hidden md:block rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-border bg-surface-800/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[30%]">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[14%]">Telefone</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[9%]">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[10%]">Pós-venda</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[7%]">Visitas</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[10%]">Total gasto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[10%]">Última visita</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[10%]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-surface-800/30 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500/15 border border-gold-500/20 text-xs font-bold text-gold-400 shrink-0">
                        {getInitials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{c.name}</p>
                        {c.email && <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="block truncate">{c.phone ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[c.status as keyof typeof STATUS_VARIANT] as never}>
                      {STATUS_LABEL[c.status as keyof typeof STATUS_LABEL] ?? c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {c.postSaleStatus ? (
                      <Badge variant={PS_VARIANT[c.postSaleStatus] as never}>{PS_LABEL[c.postSaleStatus] ?? c.postSaleStatus}</Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground font-medium tabular-nums">{c.totalVisits}</td>
                  <td className="px-4 py-3 text-right text-foreground tabular-nums">{formatBRL(c.totalSpent)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {c.lastVisitAt ? relativeTime(c.lastVisitAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleVip(c)}
                        disabled={togglingVip === c.id}
                        className={`rounded p-1.5 transition-all ${
                          c.status === "VIP"
                            ? "text-yellow-400 hover:text-yellow-300"
                            : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-400"
                        }`}
                        title={c.status === "VIP" ? "Remover VIP" : "Marcar como VIP"}
                      >
                        {togglingVip === c.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Star className={`h-3.5 w-3.5 ${c.status === "VIP" ? "fill-yellow-400" : ""}`} />}
                      </button>
                      <button
                        onClick={() => openEdit(c)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-1.5 hover:bg-surface-700 text-muted-foreground hover:text-foreground"
                        title="Editar cliente"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteCustomer(c)}
                        disabled={deletingId === c.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-1.5 hover:bg-surface-700 text-muted-foreground hover:text-destructive"
                        title="Excluir cliente"
                      >
                        {deletingId === c.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {skip + 1}–{Math.min(skip + 100, total)} de {total}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <a href={`?page=${page - 1}${q ? `&q=${q}` : ""}${vipFilter ? "&vip=1" : ""}`}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-800 transition-colors">
                  Anterior
                </a>
              )}
              {page < totalPages && (
                <a href={`?page=${page + 1}${q ? `&q=${q}` : ""}${vipFilter ? "&vip=1" : ""}`}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-800 transition-colors">
                  Próxima
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <CustomerDrawer
        mode={drawerMode}
        customer={editTarget}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}

function StatCard({ icon, label, value, valueClass = "text-foreground", href, active }: {
  icon: React.ReactNode; label: string; value: number; valueClass?: string; href?: string; active?: boolean;
}) {
  const inner = (
    <div className={`rounded-lg border bg-card p-4 flex items-center gap-4 transition-colors ${
      href ? "cursor-pointer hover:border-yellow-500/40" : ""
    } ${active ? "border-yellow-500/50 bg-yellow-500/5" : "border-border"}`}>
      <div className={active ? "text-yellow-400" : "text-gold-400"}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold tabular-nums ${valueClass}`}>{value}</p>
        {active && <p className="text-[10px] text-yellow-500/70 mt-0.5">Filtro ativo · clique para limpar</p>}
      </div>
    </div>
  );
  if (href) return <a href={href} className="block">{inner}</a>;
  return inner;
}
