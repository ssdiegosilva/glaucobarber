"use client";

import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, Search, UserPlus, CalendarPlus, AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface CustomerHit {
  id:             string;
  name:           string;
  phone?:         string | null;
  postSaleStatus?: string | null;
  totalVisits?:   number | null;
}

interface ServiceOption {
  id:          string;
  name:        string;
  price:       number;
  durationMin: number | null;
}

interface BarberOption {
  id:   string;
  name: string;
  role: string;
}

interface Props {
  open:        boolean;
  onClose:     () => void;
  /** Pre-filled from slot click: YYYY-MM-DD */
  defaultDate: string;
  /** Pre-filled from slot click: HH:mm */
  defaultTime: string;
  /** Pre-filled professional name if applicable */
  defaultProfissional?: string | null;
  /** Pre-filled barber ID from slot click */
  defaultBarberId?: string | null;
  /** Available barbers in this barbershop */
  barbers?: BarberOption[];
  onCreated:   (appt: {
    id: string; customerName: string; serviceName?: string | null;
    scheduledAt: string; durationMin: number; status: string; price?: number | null;
    profissional?: string | null; barberId?: string | null;
  }) => void;
}

export function NewAppointmentDrawer({ open, onClose, defaultDate, defaultTime, defaultProfissional, defaultBarberId, barbers = [], onCreated }: Props) {
  const [query, setQuery]         = useState("");
  const [customers, setCustomers] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected]   = useState<CustomerHit | null>(null);

  const [services, setServices]       = useState<ServiceOption[]>([]);
  const [serviceId, setServiceId]     = useState("");
  const [barberId, setBarberId]       = useState(defaultBarberId ?? "");
  const [date, setDate]               = useState(defaultDate);
  const [time, setTime]               = useState(defaultTime);
  const [price, setPrice]             = useState("");
  const [duration, setDuration]       = useState("30");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [showPastConfirm, setShowPastConfirm] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync defaults when slot changes
  useEffect(() => {
    setDate(defaultDate);
    setTime(defaultTime);
    setBarberId(defaultBarberId ?? "");
  }, [defaultDate, defaultTime, defaultBarberId]);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setQuery(""); setCustomers([]); setSelected(null);
      setServiceId(""); setBarberId(""); setPrice(""); setDuration("30"); setError(null);
      setShowPastConfirm(false);
    }
  }, [open]);

  // Load services once
  useEffect(() => {
    if (services.length > 0) return;
    fetch("/api/services")
      .then((r) => r.json())
      .then((d) => setServices(d.services ?? []))
      .catch(() => null);
  }, [services.length]);

  // Debounced customer search
  function handleQueryChange(val: string) {
    setQuery(val);
    setSelected(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 2) { setCustomers([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(val)}`);
        const d   = await res.json();
        setCustomers(d.customers ?? []);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function selectCustomer(c: CustomerHit) {
    setSelected(c);
    setQuery(c.name);
    setCustomers([]);
  }

  function handleServiceChange(id: string) {
    setServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc) {
      setPrice(svc.price > 0 ? String(svc.price) : "");
      setDuration(svc.durationMin ? String(svc.durationMin) : "30");
    }
  }

  const isPastDateTime = (() => {
    if (!date || !time) return false;
    return new Date(`${date}T${time}`) < new Date();
  })();

  async function handleSubmit(skipPastCheck = false) {
    if (!selected) { setError("Selecione um cliente."); return; }
    if (!date || !time) { setError("Informe data e hora."); return; }
    const scheduledAt = new Date(`${date}T${time}`).toISOString();

    if (!skipPastCheck && new Date(`${date}T${time}`) < new Date()) {
      setShowPastConfirm(true);
      return;
    }

    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/appointments", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          customerId:  selected.id,
          serviceId:   serviceId || null,
          barberId:    barberId || null,
          scheduledAt,
          durationMin: Number(duration) || 30,
          price:       price ? Number(price) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar agendamento");
      const selectedBarber = barbers.find((b) => b.id === barberId);
      onCreated({
        id:           data.appointment.id,
        customerName: selected.name,
        serviceName:  services.find((s) => s.id === serviceId)?.name ?? null,
        scheduledAt,
        durationMin:  Number(duration) || 30,
        status:       "SCHEDULED",
        price:        price ? Number(price) : null,
        profissional: selectedBarber?.name ?? defaultProfissional ?? null,
        barberId:     barberId || null,
      });
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-gold-400" />
            Novo agendamento
          </SheetTitle>
          <SheetDescription>
            {defaultDate} às {defaultTime}
            {defaultProfissional && ` · ${defaultProfissional}`}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-6 mt-4 space-y-4">
          {/* Customer search */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Cliente</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Buscar por nome ou telefone…"
                className="w-full rounded-md border border-border bg-surface-800 pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>

            {/* Dropdown results */}
            {customers.length > 0 && !selected && (
              <div className="rounded-md border border-border bg-surface-800 shadow-lg overflow-hidden">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-700 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.phone ?? "sem telefone"}
                      {c.totalVisits ? ` · ${c.totalVisits} visitas` : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/8 px-3 py-2">
                <UserPlus className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{selected.name}</p>
                  {selected.phone && <p className="text-xs text-muted-foreground">{selected.phone}</p>}
                </div>
                <button onClick={() => { setSelected(null); setQuery(""); }} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
              </div>
            )}
          </div>

          {/* Service */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Serviço</label>
            <select
              value={serviceId}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Selecionar serviço (opcional)</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.price > 0 ? ` — ${formatBRL(s.price)}` : ""}{s.durationMin ? ` · ${s.durationMin}min` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Barber */}
          {barbers.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Barbeiro</label>
              <select
                value={barberId}
                onChange={(e) => setBarberId(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Selecionar barbeiro (opcional)</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Data</label>
              <input
                type="date"
                value={date}
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Hora</label>
              <input
                type="time"
                value={time}
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Duration + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Duração (min)</label>
              <input
                type="number"
                min="5"
                step="5"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Preço (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                placeholder="0,00"
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-800 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Past date warning */}
          {isPastDateTime && !showPastConfirm && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300">Essa data/horário já passou.</p>
            </div>
          )}

          {/* Past date confirmation */}
          {showPastConfirm && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-300">Data no passado</p>
                  <p className="text-xs text-red-400/80 mt-0.5">
                    Você está agendando para uma data que já passou. Tem certeza que deseja continuar?
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => { setShowPastConfirm(false); handleSubmit(true); }}
                >
                  Sim, agendar mesmo assim
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowPastConfirm(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 rounded-md border border-red-500/30 bg-red-500/8 px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={() => handleSubmit()} disabled={saving || !selected} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Agendar"}
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
